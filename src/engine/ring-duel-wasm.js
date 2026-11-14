import { HISTORY_BATCH, HISTORY_VERSION, HISTORY_WORDS } from './rust-history-layout.js';

// One instance per duel. The host and interpreter use the same core and
// queue buffers, and memory stays fixed after the views have been created.
export const ringDuelWasmURL = new URL('./ring-duel.wasm', import.meta.url);

export function createWasmRingKernel(module) {
  return createPackedKernel(() => {
    const { memory, __heap_base, ...ops } = new WebAssembly.Instance(module).exports;
    return {
      ...ops,
      historyVersion: ops.history_version?.(),
      start: __heap_base.value,
      // Keep the addressable region within Rust wasm32's pointer offset range.
      maxBytes: 0x80000000,
      allocate(bytes) {
        const pages = Math.ceil((bytes - memory.buffer.byteLength) / 65536);
        if (pages > 0) memory.grow(pages);
        return memory.buffer;
      },
    };
  });
}

export function createPackedKernel(createRuntime) {
  return ({ coreSize, maxProcesses, maxCycles }, { diagnose = false, history = false, pspaceSize = 0, count = 2, geometry } = {}) => {
    const budget = count * maxCycles;
    if (!Number.isSafeInteger(budget)) return null;

    const { start, maxBytes, allocate, run, run_diagnosed, advance_group, advance_torus, historyVersion } = createRuntime();
    if (history && historyVersion !== HISTORY_VERSION) return null;
    const wide = geometry || coreSize > 65536 || count >= coreSize;
    const WordArray = wide ? Uint32Array : Uint16Array;
    const wordBytes = WordArray.BYTES_PER_ELEMENT;
    const stateAt = start;
    const diagnosticsAt = stateAt + 12 * count;
    const diedAt = diagnosticsAt + 16;
    const roundStateAt = diedAt + 8 * count;
    const historyAt = roundStateAt + 100;
    const coreAt = historyAt + (history ? HISTORY_BATCH * HISTORY_WORDS * 4 : 0);
    const queueAt = coreAt + 3 * wordBytes * coreSize;
    const pspaceAt = queueAt + wordBytes * count * maxProcesses;
    const ownersAt = pspaceAt + wordBytes * count * pspaceSize;
    const byteLength = ownersAt + (diagnose ? coreSize : 0);
    if (!Number.isSafeInteger(byteLength) || byteLength > maxBytes) return null;
    let buffer;
    try { buffer = allocate(byteLength); }
    catch (error) {
      if (error instanceof RangeError) return null;
      throw error;
    }
    const diagnostics = diagnose ? new Uint32Array(buffer, diagnosticsAt, 4) : null;
    const deaths = new Uint32Array(buffer, diedAt, 2 * count);
    const roundState = new Uint32Array(buffer, roundStateAt, 9);
    const historyLog = history ? new Uint32Array(buffer, historyAt, HISTORY_BATCH * HISTORY_WORDS) : null;
    const high = new Uint32Array(buffer, roundStateAt + 88, 3);
    const wordRange = 0x100000000;
    const pspace = new WordArray(buffer, pspaceAt, count * pspaceSize);
    if (pspaceSize) {
      for (let side = 0; side < count; side++) pspace[side * pspaceSize] = coreSize - 1;
    }
    return {
      core: new WordArray(buffer, coreAt, 3 * coreSize),
      queue: new WordArray(buffer, queueAt, count * maxProcesses),
      heads: new Uint32Array(buffer, stateAt, count),
      tails: new Uint32Array(buffer, stateAt + 4 * count, count),
      sizes: new Uint32Array(buffer, stateAt + 8 * count, count),
      owners: diagnose ? new Uint8Array(buffer, ownersAt, coreSize) : null,
      diagnostics,
      diedAt(side) { return deaths[2 * side + 1] * wordRange + deaths[2 * side]; },
      roundState,
      historyLog,
      pspace,
      get budget() {
        return high[0] === 0xffffffff ? -1 : high[0] * wordRange + roundState[2];
      },
      get cycle() { return high[1] * wordRange + roundState[0]; },
      get steps() { return high[2] * wordRange + roundState[5]; },
      startGroup(firstTurn, { cycle = 0, budget: remaining = budget, aliveCount = count, done = false, steps = 0 } = {}) {
        roundState.set([cycle, firstTurn, remaining, aliveCount, +done, steps, 0, 0, 0]);
        high.set([remaining, cycle, steps].map(value => Math.floor(value / wordRange)));
        diagnostics?.fill(0);
      },
      advanceGroup(maxSteps, recordHistory = false) {
        if (recordHistory && (!historyLog || maxSteps > HISTORY_BATCH)) throw new Error('Invalid Rust history batch');
        if (wide) {
          return advance_torus(coreAt, queueAt, stateAt, coreSize, maxProcesses, pspaceAt, pspaceSize, count,
            diedAt, roundStateAt, maxSteps, +recordHistory, geometry?.X ?? 0, geometry?.Y ?? 0, geometry?.Z ?? 0,
            diagnose ? ownersAt : 0, diagnose ? diagnosticsAt : 0);
        }
        return advance_group(coreAt, queueAt, stateAt, coreSize, maxProcesses, pspaceAt, pspaceSize, count,
          diedAt, roundStateAt, maxSteps, +recordHistory, diagnose ? ownersAt : 0, diagnose ? diagnosticsAt : 0);
      },
      run(firstTurn) {
        const steps = diagnose
          ? run_diagnosed(coreAt, queueAt, stateAt, coreSize, maxProcesses, budget, firstTurn, ownersAt, diagnosticsAt, pspaceAt, pspaceSize)
          : run(coreAt, queueAt, stateAt, coreSize, maxProcesses, budget, firstTurn, pspaceAt, pspaceSize);
        return steps === -1 ? null : steps;
      },
    };
  };
}
