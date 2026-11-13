import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RULESETS, VM, runMatch } from '../../src/engine/index.js';
import { buildTree } from '../../tools/algebra/index.js';
import { assemble } from './stateless-replay.mjs';

const rules = 'lp-hill';
const settings = RULESETS[rules];
const leaders = ['rous', 'l111', 'bronzeminotaur', 'digitalrain', 'fearfixed',
  'lpdestroyer', 'hippogriff', 'dse_6', 'lpdestroyer2', '4xlb_6'];
const seeds = [124, 521, 1777];
const rounds = 80;

function time(warrior, base, previousResult = null) {
  const vm = new VM(settings);
  vm.load([warrior], { positions: [base] });
  if (previousResult !== null) vm.warriors[0].pspace[0] = previousResult;
  const offset = address => vm.norm(address - base);
  const outside = address => offset(address) >= warrior.instructions.length;
  const resolve = vm.resolve;
  const operands = [];
  vm.resolve = function (...args) {
    const address = resolve.apply(this, args);
    operands.push(address);
    return address;
  };

  let firstRemoteMov = null, firstRemoteCode = null, firstAtCap = null;
  let firstLdp = null, firstStp = null;
  const remoteMovTargets = new Set();
  while (!vm.done) {
    const [pc] = vm.processes(0);
    const { op } = vm.peek(pc);
    const turn = vm.steps + 1;
    if (op === 'LDP') firstLdp ??= turn;
    if (op === 'STP') firstStp ??= turn;
    if (outside(pc) && vm.owner[pc] === 0) firstRemoteCode ??= { turn, pc: offset(pc) };
    operands.length = 0;
    vm.step();
    if (vm.warriors[0].queue.size === settings.maxProcesses) firstAtCap ??= turn;
    const target = operands[1];
    if (op !== 'MOV' || !outside(target) || vm.lastWrite[target] !== turn || vm.writerPc[target] !== pc) continue;
    firstRemoteMov ??= { turn, pc: offset(pc), target: offset(target) };
    if (turn <= 100) remoteMovTargets.add(target);
  }
  return {
    cells: warrior.instructions.length, entry: warrior.start, firstRemoteMov, firstRemoteCode,
    firstAtCap, firstLdp, firstStp, remoteMovTargetsBy100: remoteMovTargets.size, turns: vm.steps,
    finalQueue: vm.warriors[0].queue.size,
  };
}

function timings(warrior) {
  const cold = time(warrior, 0);
  assert.deepEqual(time(warrior, 7997), cold, warrior.name);
  const previous = warrior.instructions.some(({ op }) => op === 'LDP')
    ? Object.fromEntries([['loss', 0], ['win', 1], ['tie', 2]].map(([label, result]) => {
      const timing = time(warrior, 0, result);
      assert.deepEqual(time(warrior, 7997, result), timing, `${warrior.name}, previous ${label}`);
      return [label, timing];
    })) : null;
  return { cold, ...(previous && { previous }) };
}

function score(warrior, field) {
  const matchups = field.map(opponent => {
    let points = 0;
    for (const seed of seeds) {
      const { wins, ties } = runMatch([warrior, opponent], { ...settings, rounds }, { seed }).warriors[0];
      points += 3 * wins + ties;
    }
    return { name: opponent.name, pointsPerRound: points / (rounds * seeds.length) };
  });
  return { matchups, pointsPerRound: matchups.reduce((sum, row) => sum + row.pointsPerRound, 0) / matchups.length };
}

const [folder, mode] = process.argv.slice(2);
if (!folder || (mode && mode !== '--panel')) {
  throw new Error('Pass the Koenigstuhl LP HILL32 source folder, optionally followed by --panel');
}
const field = leaders.map(file => assemble(readFileSync(path.join(folder, `${file}.red`), 'utf8'), file, settings));
const candidates = [
  ['lp-paper', { id: 'lp-paper' }],
  ['lp-scatter-paper', { id: 'lp-scatter-paper' }],
  ['lp-scatter-paper control', { id: 'lp-scatter-paper', P: { SCATTER: 0 } }],
].map(([name, tree]) => [name, buildTree(tree, { rules, verification: 'full' }).w]);
console.log(JSON.stringify({
  standings: field.map((warrior, index) => ({ rank: index + 1, name: warrior.name, ...timings(warrior) })),
  blocks: candidates.map(([name, warrior]) => ({ name, ...timings(warrior) })),
  ...(mode && { panel: { seeds, rounds, entrants: [[field[0].name, field[0]], ...candidates].map(([name, warrior]) => ({
    name, ...score(warrior, field),
  })) } }),
}, null, 2));
