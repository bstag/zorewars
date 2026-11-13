import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULESETS, VM } from '../../src/engine/index.js';
import { assemble } from './stateless-replay.mjs';

const settings = RULESETS.tinylp;
const leaders = [
  [1, 'kiss.red'], [2, 'masterotw.red'], [4, 'fpaper800.red'],
  [7, 'troskilde.red'], [9, 'uglyredcode.red'],
];

// All turns are one-based solo VM steps. A remote MOV may be a boot or an attack.
export function timeTinyLp(warrior, { base = 0, marker = null } = {}) {
  const vm = new VM(settings);
  const { coreSize, maxProcesses } = settings;
  const offset = (address) => (address - base + coreSize) % coreSize;
  const outside = (address) => offset(address) >= warrior.instructions.length;
  vm.load([warrior], { positions: [base] });
  if (marker !== null) {
    assert.ok(Number.isInteger(marker) && marker >= warrior.instructions.length && marker < coreSize,
      'Marker must be an integer address outside the loaded image');
    vm.poke((base + marker) % coreSize, { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 1 });
  }

  const resolve = vm.resolve;
  let operands = [];
  vm.resolve = function (...args) {
    const address = resolve.apply(this, args);
    operands.push(address);
    return address;
  };

  let firstSplit = null, firstRemoteMove = null, firstRemoteExecution = null, firstAtCap = null;
  let firstMarkerOverwrite = null, queueAt100 = null;
  const earlyDestinations = new Set();
  while (!vm.done) {
    const [pc] = vm.processes(0);
    const { op } = vm.peek(pc);
    const turn = vm.steps + 1;
    if (op === 'SPL') firstSplit ??= turn;
    if (outside(pc) && vm.owner[pc] === 0 && vm.lastWrite[pc]) {
      firstRemoteExecution ??= { turn, pc: offset(pc) };
    }
    operands = [];
    vm.step();
    const queue = vm.warriors[0].queue.size;
    if (queue === maxProcesses) firstAtCap ??= turn;
    if (turn === 100) queueAt100 = queue;
    const destination = operands[1];
    if (op !== 'MOV' || !outside(destination)
      || vm.lastWrite[destination] !== turn || vm.writerPc[destination] !== pc) continue;
    const move = { turn, pc: offset(pc), destination: offset(destination) };
    firstRemoteMove ??= move;
    if (move.destination === marker) firstMarkerOverwrite ??= move;
    if (turn <= 100) earlyDestinations.add(destination);
  }
  return {
    cells: warrior.instructions.length, entry: warrior.start,
    firstSplit, firstRemoteMove, firstRemoteExecution, firstAtCap, firstMarkerOverwrite,
    remoteMovDestinationsBy100: earlyDestinations.size, queueAt100,
    turns: vm.steps, finalQueue: vm.warriors[0].queue.size,
  };
}

function timeFile(file, markers) {
  const warrior = assemble(readFileSync(file, 'utf8'), file, settings);
  const quiet = timeTinyLp(warrior);
  assert.deepEqual(timeTinyLp(warrior, { base: 777 }), quiet, file);
  const planted = markers.map(marker => {
    const timing = timeTinyLp(warrior, { marker });
    assert.deepEqual(timeTinyLp(warrior, { base: 777, marker }), timing, file);
    return { marker, timing };
  });
  return { name: warrior.name, quiet, planted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, file, ...markers] = process.argv.slice(2);
  if (!input || (input === '--warrior' && !file)) {
    throw new Error('Pass the Odd HILL32 source folder, or --warrior <file.red> [marker addresses...]');
  }
  const rows = input === '--warrior'
    ? [timeFile(file, markers.map(Number))]
    : leaders.map(([rank, file]) => ({
      rank, ...timeFile(path.join(input, file), rank === 9 ? [103, 156] : rank === 2 ? [600] : []),
    }));
  console.log(JSON.stringify(rows, null, 2));
}
