import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RULESETS, runMatch } from '../../src/engine/index.js';
import { createRound } from '../../src/engine/battle.js';
import { buildTree, link, recipes } from '../../tools/algebra/index.js';
import { createFifoLineage } from '../../tools/algebra/fifo-lineage.js';
import { assemble } from './stateless-replay.mjs';

const settings = RULESETS['lp-hill'];
const hops = [256, 512, 1024, 1984, 4032, 4896, 5952];
const roles = ['stone', 'paper'];

export function deployment(HOP, stoneParams) {
  const tree = recipes['lp-booted-phase-paper'].tree();
  tree.kids[1].P.HOP = HOP;
  if (stoneParams !== undefined) tree.kids[1].kids[0].P = stoneParams;
  const built = link(tree, settings);
  assert.deepEqual(built.misfits, []);
  return { ...built, tree, w: assemble(built.source, `boot ${HOP}`, settings), HOP };
}

export function traceDeployment(built, opponent = null, options = { positions: [0] }, copyGrains = [], onTurn) {
  const round = createRound(opponent ? [built.w, opponent] : [built.w], settings, options);
  const { vm } = round;
  const fifo = createFifoLineage(vm);
  const base = vm.warriors[0].position;
  const at = address => vm.norm(base + address);
  const relative = address => vm.norm(address - base);
  const stoneLabels = ['launch', 'dispatch', 'stride', 'shot', 'back', 'bomb'];
  const template = stoneLabels.map(label => built.labels[`b3${label}`]);
  const live = template.map(address => at(address + built.HOP));
  const liveIndex = new Map(live.map((address, index) => [address, index]));
  const paperEntry = at(built.labels.b1copy);
  const names = queue => queue.map(({ pc, tag }) => [relative(pc), roles[tag] ?? 'boot']);
  const lineageQueue = () => names(fifo.snapshot());
  const stamp = address => [vm.op[address], vm.mod[address], vm.aMode[address], vm.bMode[address], vm.a[address], vm.b[address]].join('/');
  const last = live.map(stamp);
  const writers = Array(live.length).fill(null);
  const launch = { copies: [], firstStone: null, firstPaper: null, firstStoneShot: null, firstCap: null };
  const paper = { touches: 0, copies: 0, changes: 0, firstTouch: null, firstChange: null, firstCopy: null };
  const enemy = { touches: 0, firstTouch: null };
  const stoneOnPaper = { queuedTargets: 0, firstQueuedTarget: null, deaths: 0, firstDeath: null };
  const lastStoneShot = new Int32Array(vm.size);
  const lastPaperCopy = new Int32Array(vm.size);
  const paperCopyResidues = Object.fromEntries(copyGrains.map(grain => [grain, Array(grain).fill(0)]));
  const copyOverlap = { stoneHits: 0, paperHits: 0, firstStoneHit: null, firstPaperHit: null };
  const fullQueueTurns = {};
  const deaths = [];
  let shots = 0;
  let operands = [];
  const priorWrites = new Map();
  const resolve = vm.resolve;
  vm.resolve = function (...args) {
    const address = resolve.apply(this, args);
    operands.push(address);
    return address;
  };
  const touch = vm.touch;
  vm.touch = function (address, actor) {
    if (!priorWrites.has(address)) priorWrites.set(address, this.lastWrite[address]);
    return touch.call(this, address, actor);
  };
  while (!vm.done) {
    const actor = vm.turn;
    const q = vm.warriors[actor].queue;
    const pc = q.buf[q.head];
    const instruction = vm.peek(pc);
    const previousWrite = vm.lastWrite[pc];
    const i = liveIndex.get(pc);
    const previous = writers[i];
    fifo.before(address => address === live[0] ? 0 : address === paperEntry ? 1 : -1);
    operands = [];
    priorWrites.clear();
    vm.step();
    const process = fifo.after();
    const tag = process?.tag;
    const origin = actor === 1 ? 'enemy' : roles[tag] ?? 'boot';
    const turn = vm.steps;
    if (tag === 0) launch.firstStone ??= turn;
    if (tag === 1) launch.firstPaper ??= turn;
    if (tag === 0 && !process.successors.length) {
      deaths.push({ turn, pc: relative(pc), instruction: vm.disassemble(pc), lastTouch: previous ?? null });
    }
    if (tag === 1 && !process.successors.length && previousWrite > 0 && lastStoneShot[pc] === previousWrite) {
      stoneOnPaper.deaths++;
      stoneOnPaper.firstDeath ??= { turn, cell: relative(pc), shotTurn: previousWrite };
    }
    if (process && vm.warriors[0].queue.size === settings.maxProcesses) {
      const queue = fifo.snapshot();
      launch.firstCap ??= { turn, queue: names(queue) };
      const key = roles.map((_, i) => queue.filter(item => item.tag === i).length).join('/');
      fullQueueTurns[key] = (fullQueueTurns[key] ?? 0) + 1;
    }
    const whole = instruction.op === 'MOV' && instruction.mod === 'I';
    const [from, to] = operands;
    const beforeDestination = priorWrites.get(to);
    if (tag === 1 && whole && instruction.aMode === '<' && instruction.bMode === '{' && vm.lastWrite[to] === turn) {
      lastPaperCopy[to] = turn;
      for (const grain of copyGrains) paperCopyResidues[grain][relative(to) % grain]++;
      if (beforeDestination > 0 && beforeDestination === lastStoneShot[to]) {
        copyOverlap.paperHits++;
        copyOverlap.firstPaperHit ??= { turn, cell: relative(to), previousWrite: beforeDestination };
      }
    }
    if (tag === 0 && pc === live[3] && whole && vm.lastWrite[to] === turn) {
      shots++;
      lastStoneShot[to] = turn;
      if (beforeDestination > 0 && beforeDestination === lastPaperCopy[to]) {
        copyOverlap.stoneHits++;
        copyOverlap.firstStoneHit ??= { turn, cell: relative(to), previousWrite: beforeDestination };
      }
      launch.firstStoneShot ??= { turn, target: relative(to) };
      if (fifo.snapshot().some(item => item.tag === 1 && item.pc === to)) {
        stoneOnPaper.queuedTargets++;
        stoneOnPaper.firstQueuedTarget ??= { turn, cell: relative(to) };
      }
    }
    for (const [index, address] of live.entries()) {
      if (vm.lastWrite[address] !== turn) continue;
      const next = stamp(address);
      const changed = next !== last[index];
      last[index] = next;
      const copy = whole && to === address;
      const write = { turn, origin, pc: relative(pc), cell: relative(address), label: stoneLabels[index], changed,
        ...(copy ? { source: relative(from) } : {}), instruction: vm.disassemble(address) };
      writers[index] = write;
      if (origin === 'boot' && relative(pc) === built.labels.b2boot && copy) launch.copies.push(write);
      if (origin === 'paper') {
        paper.touches++;
        paper.firstTouch ??= write;
        if (copy) { paper.copies++; paper.firstCopy ??= write; }
        if (changed) { paper.changes++; paper.firstChange ??= write; }
      }
      if (origin === 'enemy') { enemy.touches++; enemy.firstTouch ??= write; }
    }
    onTurn?.({ vm, actor, pc, instruction, from, to, origin, previous, lineageQueue });
  }
  return { ...round.finish(), launch, paper, enemy, stoneOnPaper, copyOverlap, fullQueueTurns, deaths, shots, paperCopyResidues,
    final: names(fifo.snapshot()) };
}

export function scoreDeployments(opponent, candidates, seeds, rounds = 64) {
  const matches = candidates.map(([name, warrior]) => {
    const results = seeds.flatMap(seed => runMatch([warrior, opponent], { ...settings, rounds }, { seed }).rounds);
    const wins = results.filter(r => r.winner === 0).length;
    const ties = results.filter(r => r.winner === null).length;
    return { name, wins, ties, losses: results.length - wins - ties, pointsPerRound: (3 * wins + ties) / results.length, results };
  });
  const plans = row => row.results.map(({ positions, firstTurn }) => ({ positions, firstTurn }));
  const firstPlans = plans(matches[0]);
  for (const row of matches.slice(1)) assert.deepEqual(plans(row), firstPlans);
  return matches;
}

function compare(opponent, candidates, seeds) {
  const rounds = 64;
  const matches = scoreDeployments(opponent, candidates, seeds, rounds);
  const near = matches.find(row => row.name === '256');
  const close = matches.find(row => row.name === '512');
  const far = matches.find(row => row.name === '5952');
  const samples = [
    ['closeWin', close.results.find((r, i) => r.winner === 0 && far.results[i].winner === 1), [512, 5952]],
    ['farTie', far.results.find((r, i) => r.winner === null && near.results[i].winner === 1), [256, 5952]],
  ];
  const examples = Object.fromEntries(samples.filter(([, sample]) => sample).map(([name, sample, pair]) => [name,
    Object.fromEntries(pair.map(hop => [hop, traceDeployment(deployment(hop), opponent,
      { positions: sample.positions, firstTurn: sample.firstTurn })]))]));
  return { seeds, rounds, rows: matches.map(({ results, ...row }) => row), examples };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file] = process.argv.slice(2);
  const built = hops.map(deployment);
  const quiet = Object.fromEntries(built.map(candidate => {
    const trace = traceDeployment(candidate);
    const shifted = traceDeployment(candidate, null, { positions: [7997] });
    assert.deepEqual(shifted, { ...trace, positions: [7997] });
    let gate = 'pass';
    try { buildTree(candidate.tree, { rules: 'lp-hill', verification: 'full' }); }
    catch (error) { gate = error.message; }
    return [candidate.HOP, { gate, ...trace }];
  }));
  const control = buildTree(recipes['lp-phase-paper'].tree(), { rules: 'lp-hill', verification: 'full' }).w;
  const candidates = [['unbooted', control], ...built.map(row => [String(row.HOP), row.w])];
  const panels = file ? [[23033, 49139], [31517, 52489]].map(seeds =>
    compare(assemble(readFileSync(file, 'utf8'), file, settings), candidates, seeds)) : [];
  console.log(JSON.stringify({ quiet, panels }, null, 2));
}
