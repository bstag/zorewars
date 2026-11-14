import { observeRustHistory, rustHistoryExecutor } from '../src/engine/ring-duel.js';
import { HISTORY_WORDS } from '../src/engine/rust-history-layout.js';
import { LIVE_STEPS } from '../src/engine/gpu/live-layout.js';

const BLOCK_STEPS = 2048;
const MAX_LOG_BYTES = 24 * 1024 * 1024;
const MAX_CHECKPOINT_BYTES = 8 * 1024 * 1024;
const CHECKPOINT_INTERVAL = 8192;
const coreFields = ['op', 'mod', 'aMode', 'bMode', 'a', 'b', 'owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle'];
const roundFields = ['steps', 'cycle', 'turn', 'budget', 'aliveCount', 'done', 'winner', 'curPc', 'curH'];
const warriorFields = ['alive', 'diedAt', 'peak', 'foreignSteps', 'foreignFirst', 'lastDeath', 'deaths'];
const queueFields = ['head', 'size', 'h', 'lastH'];
const fields = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));

function capture(vm, bytes) {
  return {
    bytes, state: fields(vm, roundFields),
    core: Object.fromEntries(coreFields.map(key => [key, vm[key].slice()])),
    warriors: vm.warriors.map(w => ({
      state: structuredClone(fields(w, warriorFields)), pspace: w.pspace.slice(),
      queue: { ...fields(w.queue, queueFields), buf: w.queue.buf.slice(), heads: w.queue.heads.slice() },
    })),
    contacts: structuredClone(vm.contacts),
  };
}

function restore(vm, checkpoint) {
  Object.assign(vm, checkpoint.state);
  for (const key of coreFields) vm[key].set(checkpoint.core[key]);
  vm.warriors.forEach((warrior, side) => {
    const { state, pspace, queue } = checkpoint.warriors[side];
    Object.assign(warrior, structuredClone(state));
    warrior.pspace.set(pspace);
    Object.assign(warrior.queue, fields(queue, queueFields));
    warrior.queue.buf.set(queue.buf);
    warrior.queue.heads.set(queue.heads);
  });
  vm.contacts = structuredClone(checkpoint.contacts);
  vm.contactSeen = new Set(vm.contacts.map(({ attacker, victim }) => attacker * 64 + victim));
}

// Retain Rust's shared-buffer output in bounded blocks. The observer sees
// borrowed memory, which the next execution call will reuse.
export function recordArenaReplay(vm) {
  const blocks = [], checkpoints = [];
  const checkpointSize = coreFields.reduce((n, key) => n + vm[key].byteLength, 0)
    + vm.warriors.reduce((n, w) => n + w.pspace.byteLength + w.queue.buf.byteLength + w.queue.heads.byteLength, 0);
  let length = 0, checkpointBytes = 0, valid = true, sealed = false;
  observeRustHistory(vm, (start, words, count) => {
    if (!valid || sealed) return;
    if (start !== length || (length + count) * HISTORY_WORDS * 4 > MAX_LOG_BYTES) {
      valid = false;
      blocks.length = checkpoints.length = 0;
      return;
    }
    for (let copied = 0; copied < count;) {
      const blockIndex = Math.floor(length / BLOCK_STEPS);
      const offset = length % BLOCK_STEPS;
      const n = Math.min(count - copied, BLOCK_STEPS - offset);
      const block = blocks[blockIndex] ??= new Uint32Array(BLOCK_STEPS * HISTORY_WORDS);
      block.set(words.subarray(copied * HISTORY_WORDS, (copied + n) * HISTORY_WORDS), offset * HISTORY_WORDS);
      copied += n;
      length += n;
    }
  });
  return {
    checkpoint() {
      if (!valid || sealed || length !== vm.steps || vm.steps < (checkpoints.at(-1)?.state.steps ?? 0) + CHECKPOINT_INTERVAL
        || checkpointSize > MAX_CHECKPOINT_BYTES) return;
      while (checkpointBytes + checkpointSize > MAX_CHECKPOINT_BYTES) checkpointBytes -= checkpoints.shift().bytes;
      checkpoints.push(capture(vm, checkpointSize));
      checkpointBytes += checkpointSize;
    },
    result() {
      if (!vm.done) return null;
      sealed = true;
      if (!valid || !length || length !== vm.steps) {
        blocks.length = checkpoints.length = 0;
        return null;
      }
      return {
        length,
        checkpointCount: checkpoints.length,
        bytes: blocks.length * BLOCK_STEPS * HISTORY_WORDS * 4 + checkpointBytes,
        seek(targetVM, targetCycle) {
          // A checkpoint in the middle of the target cycle would skip steps
          // the caller expects to be able to replay.
          const checkpoint = checkpoints.findLast(c => c.state.cycle < targetCycle);
          if (checkpoint) restore(targetVM, checkpoint);
          return installRecordedExecution(targetVM, blocks, length);
        },
      };
    },
  };
}

function installRecordedExecution(vm, blocks, length) {
  const original = vm.execute;
  const apply = rustHistoryExecutor(vm);
  let lastStep = null;
  let closed = false;
  vm.execute = (warrior, pc, queue) => {
    const index = vm.steps - 1;
    return apply(blocks[Math.floor(index / BLOCK_STEPS)], (index % BLOCK_STEPS) * HISTORY_WORDS, warrior, pc, queue);
  };
  return {
    backend: 'replay',
    get lastStep() { return lastStep; },
    advance(limit, { cancelled = () => false } = {}) {
      if (closed || cancelled()) return 0;
      limit = Math.min(LIVE_STEPS, limit);
      let steps = 0;
      while (!vm.done && vm.steps < length && steps < limit) {
        lastStep = vm.step();
        steps++;
      }
      return steps;
    },
    close() {
      if (closed) return;
      closed = true;
      vm.execute = original;
    },
  };
}
