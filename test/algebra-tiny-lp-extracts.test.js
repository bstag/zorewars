import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, VM } from '../src/engine/index.js';
import { buildTree, gate } from '../tools/algebra/index.js';

const options = { rules: 'tinylp', verification: 'full' };
const paper = (P = {}) => ({ id: 'tiny-lp-pointer-paper', P });
const triad = (P = {}) => ({ id: 'tiny-lp-stone-triad', P });
const report = (built, id) => built.verification.observations
  .find(({ base, scenario }) => base === 0 && scenario === 'alone')
  .observation.blocks.find((block) => block.id === id);

test('the six- and seven-cell papers transfer at the eight-process cap', () => {
  for (const [ATTACK, cycle, capped] of [[0, 14, 103], [1, 23, 166]]) {
    const built = buildTree(paper({ ATTACK }), options);
    const trace = report(built, 'tiny-lp-pointer-paper');
    assert.equal(built.total, 6 + ATTACK);
    assert.equal(trace.work['root-copy-writes'].firstCycle, 1);
    assert.deepEqual(trace.phases['first-copy-transfer'], { cycle, target: 347 });
    assert.equal(trace.phases['full-queue-transfer'].cycle, capped);
    assert.equal(trace.work['root-attack-writes']?.firstCycle, ATTACK ? 2 : undefined);
  }
});

test('the destination guard refuses a copied seed with a nonzero cursor', () => {
  const built = buildTree(paper({ ATTACK: 0 }), options);
  const vm = new VM(built.settings);
  const base = 797, go = (base + built.labels.b0go) % 800;
  vm.load([built.w], { positions: [base] });
  while (vm.processes(0)[0] !== go && vm.cycle < 30) vm.step();
  assert.equal(vm.processes(0)[0], go);
  const target = (go + vm.peek(go).b) % 800;
  assert.equal(target, 344);
  assert.equal(vm.peek(target).b, 0);
  vm.poke(target, { ...vm.peek(target), b: 1 });
  vm.step();
  assert.equal(vm.processes(0).includes(target), false);
  assert.equal(vm.processes(0).includes((go + 1) % 800), true);
  assert.equal(vm.processes(0).includes(base), true);
});

test('three deployed stone workers and a copy-only paper fit Tiny LP', () => {
  const build = buildTree({ id: 'par', kids: [triad(), paper({ ATTACK: 0 })] }, options);
  assert.equal(build.total, 19);
  const stones = report(build, 'tiny-lp-stone-triad');
  assert.deepEqual([1, 2, 3].map((lane) => stones.phases[`lane-${lane}-first-attack`]), [
    { cycle: 20, entry: 172, target: 181 },
    { cycle: 22, entry: 412, target: 421 },
    { cycle: 23, entry: 632, target: 641 },
  ]);
  const paperTrace = report(build, 'tiny-lp-pointer-paper');
  assert.deepEqual(paperTrace.phases['first-copy-transfer'], { cycle: 57, target: 360 });
  assert.equal(paperTrace.phases['full-queue-transfer'].cycle, 227);

  const vm = new VM(build.settings);
  vm.load([build.w], { positions: [0] });
  while (vm.processes(0).length !== 8 && vm.cycle < 250) vm.step();
  assert.equal(vm.cycle, 221);
  const queues = [172, 412, 632].map((entry) => vm.processes(0).filter((pc) => pc >= entry && pc < entry + 3).length);
  assert.deepEqual(queues, [1, 1, 1]);
  assert.equal(vm.processes(0).length - queues.reduce((sum, count) => sum + count, 0), 5);
});

test('a separately tuned attack cursor allows the paper to attack before its first transfer', () => {
  const built = buildTree({ id: 'par', kids: [triad(), paper({ ATTACK: 1, SLOT: 499 })] }, options);
  assert.equal(built.total, 20);
  const trace = report(built, 'tiny-lp-pointer-paper');
  assert.equal(trace.work['root-copy-writes'].firstCycle, 5);
  assert.equal(trace.work['root-attack-writes'].firstCycle, 9);
  assert.equal(trace.phases['first-copy-transfer'].cycle, 93);
  assert.equal(trace.phases['full-queue-transfer'].cycle, 355);
});

test('linked layouts reject overlap, and boot verification catches a missing stone copy', () => {
  assert.throws(() => buildTree(triad({ SITE2: 8 }), options), /deployment footprints overlap/);
  assert.throws(() => buildTree(paper({ SIDE: 347 }), options), /overlaps its image/);
  assert.throws(() => buildTree(triad(), { rules: 'tiny' }), /eight process slots/);
  const build = buildTree(triad(), options);
  const broken = build.source.replace('MOV.I <b0lane1, {b0lane1', 'NOP.F <b0lane1, {b0lane1');
  const warrior = compile(broken, 'redcode', build.settings);
  assert.equal(warrior.ok, true);
  assert.throws(() => gate({ ...build, w: warrior }, { verification: 'full' }), /missed a declared write/);
});
