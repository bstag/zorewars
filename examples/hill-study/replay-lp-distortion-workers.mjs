import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULESETS, runMatch, topologyFor } from '../../src/engine/index.js';
import { createRound } from '../../src/engine/battle.js';
import { buildTree, recipes } from '../../tools/algebra/index.js';
import { createFifoLineage } from '../../tools/algebra/fifo-lineage.js';
import { assemble } from './stateless-replay.mjs';

const settings = RULESETS['lp-hill'];
const entries = [4896, 4897, 4898, 4897];
const routes = {
  one: [0], two: [0, 1], twoJump: [0, 2], twoLate: [0, 3], four: [0, 1, 2, 3],
};

// Intercept queue pushes only at the two dispatch instructions. A dropped route keeps the original
// operand effects, including the DJN's updates of the SPL's B field.
function filterAdmissions(vm, keep) {
  const { queue, position } = vm.warriors[0];
  const execute = vm.execute;
  const push = queue.push;
  const admitted = [];
  const seen = new Set();
  const relative = pc => vm.norm(pc - position);
  vm.execute = function (actor, pc, activeQueue) {
    const offset = relative(pc);
    if (actor !== 0 || (offset !== 197 && offset !== 198)) return execute.call(this, actor, pc, activeQueue);
    if (vm.peek(pc).op !== (offset === 197 ? 'DJN' : 'SPL')) return execute.call(this, actor, pc, activeQueue);
    queue.push = function (target) {
      const address = relative(target);
      const slot = offset === 197 ? entries.slice(0, 3).indexOf(address) : address === entries[3] ? 3 : -1;
      if (slot === -1 || seen.has(slot)) return push.call(this, target);
      seen.add(slot);
      if (!keep.includes(slot)) return false;
      const accepted = push.call(this, target);
      if (accepted) admitted.push(slot);
      return accepted;
    };
    try {
      return execute.call(this, actor, pc, activeQueue);
    } finally {
      delete queue.push;
      if (seen.size === entries.length) delete vm.execute;
    }
  };
  return admitted;
}

function count(queue) {
  return ['stone', 'paper'].map((_, tag) => queue.filter(item => item.tag === tag).length);
}

export function replayRound(warriors, keep, options, trace = false) {
  const round = createRound(warriors, settings, options);
  const { vm } = round;
  const admitted = filterAdmissions(vm, keep);
  if (!trace) {
    vm.run();
    return { ...round.finish(), admitted };
  }
  const fifo = createFifoLineage(vm);
  const base = vm.warriors[0].position;
  const at = offset => vm.norm(base + offset);
  const offset = address => vm.norm(address - base);
  const targets = new Set();
  let firstCap = null, firstStone = null, firstPaper = null, firstDeath = null, lastStoneDeath = null, shots = 0, repeatShots = 0;
  let previousTarget = null;
  let operands = [];
  const resolve = vm.resolve;
  vm.resolve = function (...args) {
    const address = resolve.apply(this, args);
    operands.push(address);
    return address;
  };
  while (!vm.done) {
    const actor = vm.turn;
    const { queue } = vm.warriors[actor];
    const pc = queue.buf[queue.head];
    const instruction = vm.peek(pc);
    const writer = vm.writerPc[pc];
    const owner = vm.owner[pc];
    fifo.before(address => {
      if (entries.includes(offset(address))) return 0;
      return address === at(1) ? 1 : -1;
    });
    operands = [];
    vm.step();
    const process = fifo.after();
    if (!process) continue;
    if (!firstCap && vm.warriors[0].queue.size === settings.maxProcesses) {
      const snapshot = fifo.snapshot();
      firstCap = { turn: vm.steps, counts: count(snapshot), queue: snapshot.map(item => offset(item.pc)) };
    }
    if (process.tag === 1) firstPaper ??= vm.steps;
    if (process.tag !== 0) continue;
    firstStone ??= vm.steps;
    const target = operands[1];
    if (pc === at(4897) && instruction.op === 'MOV' && instruction.mod === 'I' && instruction.aMode === '{'
      && vm.lastWrite[target] === vm.steps && vm.writerPc[target] === pc) {
      shots++;
      targets.add(target);
      if (target === previousTarget) repeatShots++;
      previousTarget = target;
    }
    if (!process.successors.length) {
      const death = { turn: vm.steps, pc: offset(pc), owner, writer: writer >= 0 ? offset(writer) : null, shots };
      firstDeath ??= death;
      if (!fifo.snapshot().some(item => item.tag === 0) && admitted.length === keep.length) lastStoneDeath = death;
    }
  }
  return { ...round.finish(), admitted, firstCap, firstStone, firstPaper, firstDeath, lastStoneDeath,
    shots, distinctTargets: targets.size, repeatShots, final: count(fifo.snapshot()) };
}

function plans(seed, rounds) {
  const topology = topologyFor(settings);
  let next = seed;
  return Array.from({ length: rounds }, (_, i) => {
    let positions;
    [positions, next] = topology.place(2, next);
    return { positions, firstTurn: i % 2 };
  });
}

function panel(warrior, opponent, seeds, rounds) {
  assert.ok([warrior, opponent].every(w => w.instructions.every(ins => !['LDP', 'STP'].includes(ins.op))),
    'Matched rounds use fresh P-space');
  const roundPlans = seeds.flatMap(seed => plans(seed, rounds));
  const variants = Object.fromEntries(Object.entries(routes).map(([name, keep]) => {
    const totals = { wins: 0, losses: 0, ties: 0, admitted: {} };
    const results = roundPlans.map(options => {
      const { winner, admitted } = replayRound([warrior, opponent], keep, options);
      totals[winner === 0 ? 'wins' : winner === 1 ? 'losses' : 'ties']++;
      const key = admitted.join(',') || 'none';
      totals.admitted[key] = (totals.admitted[key] ?? 0) + 1;
      return winner;
    });
    return [name, { ...totals, pointsPerRound: (totals.wins * 3 + totals.ties) / roundPlans.length, results }];
  }));
  // Verify the four-route observer against a normal match on the same plans.
  const native = seeds.flatMap(seed => runMatch([warrior, opponent], { ...settings, rounds }, { seed }).rounds);
  assert.deepEqual(native.map(({ positions, firstTurn }) => ({ positions, firstTurn })), roundPlans);
  assert.deepEqual(native.map(round => round.winner), variants.four.results);
  const example = roundPlans.find((_, i) => variants.four.results[i] === 0 && variants.one.results[i] === 1);
  return { seeds, rounds, variants: Object.fromEntries(Object.entries(variants).map(([name, { results, ...totals }]) => [name, totals])),
    ...(example && { example: Object.fromEntries(Object.entries(routes).map(([name, keep]) =>
      [name, replayRound([warrior, opponent], keep, example, true)])) }) };
}

function compactPanel(opponent, seeds, rounds) {
  return [0, 1].map(PHASE => {
    const tree = recipes['lp-phase-paper'].tree();
    tree.kids[0].P = { PHASE };
    const built = buildTree(tree, { rules: 'lp-hill', verification: 'full' });
    const row = { PHASE, wins: 0, losses: 0, ties: 0 };
    for (const seed of seeds) {
      const result = runMatch([built.w, opponent], { ...settings, rounds }, { seed }).warriors[0];
      for (const key of ['wins', 'losses', 'ties']) row[key] += result[key];
    }
    return { ...row, pointsPerRound: (row.wins * 3 + row.ties) / (seeds.length * rounds) };
  });
}

function main(folder, mode) {
  if (!folder) throw new Error('Pass the directory containing the archived LP sources');
  const source = name => {
    const file = path.join(folder, `${name}.red`);
    return assemble(readFileSync(file, 'utf8'), file, settings);
  };
  if (mode === '--compact') {
    const opponent = source('4xlb_6');
    return [[23033, 49139], [31517, 52489]].map(seeds => ({ seeds, rounds: 64, results: compactPanel(opponent, seeds, 64) }));
  }
  if (mode !== undefined) throw new Error(`Unknown replay mode ${mode}`);
  const published = source('dse_6');
  assert.equal(published.start, 194);
  const quiet = Object.fromEntries(Object.entries(routes).map(([name, keep]) =>
    [name, replayRound([published], keep, { positions: [0] }, true)]));
  const fields = [
    ['4xlb_6', [23033, 49139], 64], ['4xlb_6', [31517, 52489], 64],
    ['bronzeminotaur', [31517, 52489], 48], ['rous', [31517, 52489], 48],
  ];
  const panels = fields.map(([name, seeds, rounds]) => ({ name, ...panel(published, source(name), seeds, rounds) }));
  return { quiet, panels };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(main(...process.argv.slice(2)), null, 2));
}
