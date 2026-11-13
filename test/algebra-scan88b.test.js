// The '88 scanning blocks (tools/algebra/blocks/scan88b.js): probe-burst-88,
// bscan-clear-88, scan-replicator-88 and opening-q2-stun-88. Each builds and
// passes the gate with its defaults on 88 and 94nop, alone or in the seq it is
// meant for; what each promises is checked in the VM; broken settings are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const BURST = 'probe-burst-88', BSCAN = 'bscan-clear-88', REPL = 'scan-replicator-88', Q2 = 'opening-q2-stun-88';
const marker = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const guarded = { id: 'finisher-guarded-88', P: { PHASE: 0 } };
const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};
const seq = (...kids) => ({ id: 'seq', kids });

test('every block passes the gate on 88 and 94nop, alone or in its seq', () => {
  for (const rules of ['88', '94nop']) {
    assert.equal(ok(rules, { id: BSCAN }).total, 11);
    assert.equal(ok(rules, { id: REPL }).total, 13);
    ok(rules, seq({ id: 'opening-none' }, { id: BURST }, guarded));
    assert.equal(ok(rules, seq({ id: Q2 }, guarded)).total, 3 * 5 + 7 + 4 + 11);   // 22 lines and four data cells, then the clear
  }
  // The burst after the additive quickscan, whose planted find it must burst around.
  const built = ok('88', seq({ id: 'opening-qscan-add-88', P: { ROWS: 3 } }, { id: BURST }, guarded));
  assert.ok(built.total <= 50);
  assert.ok(built.verification.observations.some((o) => o.scenario === 'opening-qscan-add-88: planted target'));
});

test('the blocks combine into 50-instruction warriors', () => {
  for (const tree of [
    seq({ id: 'opening-qscan-add-88', P: { ROWS: 3 } }, { id: BURST }, { id: BSCAN }),
    seq({ id: 'opening-qscan-add-88', P: { ROWS: 3 } }, { id: BURST }, { id: REPL }),
    seq({ id: Q2 }, { id: BSCAN }),
    seq({ id: Q2, P: { PAIRS: 4 } }, { id: BURST }, { id: REPL }),
    { id: 'image', kids: [{ id: BSCAN }, { id: 'decoys' }] },
    { id: 'image', kids: [{ id: REPL }, { id: 'decoys' }] },
  ]) assert.ok(ok('88', tree).total <= 50);
});

test('probe-burst-88 lays both streams around a found cell and nothing near the image', () => {
  const built = ok('88', seq({ id: 'opening-none' }, { id: BURST }, guarded));
  const { settings, labels, root, total } = built, core = settings.coreSize, P = leaves[BURST].defaults;
  const probe = labels[Object.keys(labels).find((l) => l.endsWith('probe'))];
  const ns = root.kids[1].ns, end = labels[root.kids[2].ns + 'payload'];
  const writers = [labels[ns + 'bLoop'], labels[ns + 'bTwo']];
  const run = (base, found) => {
    const vm = new VM(settings);
    vm.load([built.w], { positions: [base] });
    const at = (x) => (((base + x) % core) + core) % core;
    vm.poke(at(probe), { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: (((found - probe) % core) + core) % core });
    while (vm.processes(0)[0] !== at(end) && vm.cycle < 400) vm.step();
    assert.equal(vm.processes(0)[0], at(end), 'the burst handed on');
    const bombs = [];
    for (let c = 0; c < core; c++) if (writers.includes((vm.writerPc[c] - base + core) % core) && vm.writeCycle[c] > 0 && vm.peek(c).op === 'DAT') bombs.push((c - base + core) % core);
    return { bombs, cycles: vm.cycle };
  };
  for (const base of [0, 7990]) {
    const found = 3000, { bombs, cycles } = run(base, found);
    const want = [];
    for (let k = 0; k < P.COUNT; k++) want.push(found - P.OFFSET + k * P.STEP, found - P.OFFSET + k * P.STEP + P.GAP);
    assert.deepEqual(bombs, [...new Set(want)].sort((a, b) => a - b));
    assert.ok(cycles <= 5 + 5 * P.COUNT + 2);
    const reach = (P.COUNT - 1) * P.STEP + P.GAP;
    // Just clear of the image on either side: a full burst.
    assert.equal(run(base, total + P.OFFSET).bombs.length, 2 * P.COUNT);
    assert.equal(run(base, core - reach + P.OFFSET - 1).bombs.length, 2 * P.COUNT);
    // A cell too close, on either side, and the boundary itself: no bombs at all.
    assert.deepEqual(run(base, total + P.OFFSET - 1).bombs, []);
    assert.deepEqual(run(base, core - reach + P.OFFSET).bombs, []);
    assert.deepEqual(run(base, total).bombs, []);
  }
});

test('bscan-clear-88 stuns what it finds, then becomes a clear at scan TIME exactly', () => {
  const P = { STEP: 2359, TIME: 300 };
  assert.deepEqual(treeMismatches({ id: BSCAN, P }, { ...RULESETS['88'], maxLength: 50 }), []);
  const built = ok('88', { id: BSCAN, P });
  const { settings, labels } = built, core = settings.coreSize, base = 4000;
  const at = (l, k = 0) => (base + labels['b0' + l] + k) % core;
  const first = built.w.instructions[labels.b0cPtr].b;
  const scanned = (k) => (at('cPtr') + first + k * P.STEP) % core;
  const vm = new VM(settings);
  vm.load([built.w], { positions: [base] });
  vm.poke(scanned(20), marker);
  while (vm.cycle < 2 * P.TIME + 4 - 6) vm.step();
  // The find, 20 scans in: JMP -1 on it and SPL 0 below.
  assert.deepEqual([vm.peek(scanned(20)).op, vm.peek(scanned(20)).a], ['JMP', core - 1]);
  assert.equal(vm.peek(scanned(20) - 1).op, 'SPL');
  // Still scanning two scans before TIME (the find cost four cycles and no step) ...
  assert.equal(vm.peek(at('sLoop')).op, 'ADD');
  assert.equal(vm.processes(0).length, 1);
  // ... and a clear just after it: its own stun pair on its first two lines, the SPL 0 running.
  while (vm.cycle < 2 * P.TIME + 4 + 12) vm.step();
  assert.equal(vm.peek(at('sTest')).op, 'JMP');
  assert.ok(vm.processes(0).length > 1);
  assert.ok(vm.processes(0).every((q) => q >= at('cHead') && q <= at('cJmp')));
  // A lap and a half later everything but the block is DAT, and it is still running.
  while (vm.cycle < 2 * P.TIME + 30000) vm.step();
  assert.equal(vm.warriors[0].alive, true);
  let left = 0;
  for (let c = 0; c < core; c++) if (vm.peek(c).op !== 'DAT') left++;
  assert.ok(left <= 9, `${left} cells are not DAT`);
  for (const l of ['cHead', 'cMov', 'cJmp']) assert.equal(vm.peek(at(l)).op, built.w.instructions[labels['b0' + l]].op);
});

test('bscan-clear-88 can decrement an imp link without changing the clear wrap', () => {
  for (const rules of ['88', '94nop']) {
    const built = ok(rules, { id: BSCAN, P: { ANTISTEP: 2667 } });
    const bomb = built.labels.b0cBomb;
    const vm = new VM(built.settings);
    vm.load([{ ...built.w, start: bomb }], { positions: [0] });
    assert.equal(vm.peek(bomb).aMode, '<');
    assert.equal(vm.peek(bomb).b, built.settings.coreSize - 10);
    vm.poke(bomb + 2667, marker);
    vm.step();
    assert.equal(vm.peek(bomb + 2667).b, marker.b - 1);
    assert.equal(vm.warriors[0].alive, false);
  }
});

test('scan-replicator-88 bombs one class alone, and copies itself once beside a find', () => {
  const built = ok('88', { id: REPL });
  const { settings, labels } = built, core = settings.coreSize, base = 1000, P = leaves[REPL].defaults;
  const rDat = base + labels.b0rDat, first = built.w.instructions[labels.b0rDat].b + 1;
  const alone = new VM(settings);
  alone.load([built.w], { positions: [base] });
  while (alone.cycle < 3 * 420) alone.step();
  assert.equal(alone.processes(0).length, 1);
  let bombs = 0;
  for (let c = 0; c < core; c++) if (alone.writerPc[c] === base + labels.b0rDrop && alone.writeCycle[c] > 0) { bombs++; assert.equal((c - rDat - first + core) % 20, 0); }
  assert.equal(bombs, 400);                                  // one class of the 20-cell grain, a lap in 1,200 cycles
  for (let i = 0; i < 12; i++) assert.equal(alone.peek(base + i).op, built.w.instructions[i].op);

  const vm = new VM(settings);
  vm.load([built.w], { positions: [base] });
  const bomb = (rDat + first + 9 * P.STEP) % core;
  vm.poke(bomb - 1, marker);
  while (vm.cycle < 3 * 420) vm.step();
  assert.equal(vm.processes(0).length, 2);                    // found once: the JMP it left there has a zero B-field
  assert.equal(vm.peek(bomb - 1).op, 'JMP');
  const copy = vm.processes(0).find((q) => q < base || q > base + 13);
  const start = copy - (copy - base) % 20;                    // every copy sits on the body's residue classes
  for (let i = 0; i < 12; i++) assert.equal(vm.peek(start + i).op, built.w.instructions[i].op, `copy cell ${i}`);
});

test('opening-q2-stun-88 digs its pit on whichever pair differs and bombs the other cell', () => {
  const built = ok('88', seq({ id: Q2 }, guarded));
  const { settings, labels, root } = built, core = settings.coreSize, P = leaves[Q2].defaults;
  const ns = root.kids[0].ns, qP = labels[ns + 'qP'], end = labels[root.kids[1].ns + 'payload'];
  const run = (plant) => {
    const vm = new VM(settings);
    vm.load([built.w], { positions: [0] });
    for (const c of plant) vm.poke(qP + c, marker);
    while (vm.processes(0)[0] !== end && vm.cycle < 200) vm.step();
    assert.equal(vm.processes(0)[0], end);
    return vm;
  };
  const quiet = run([]);
  assert.equal(quiet.cycle, P.PAIRS + 1);
  assert.equal(quiet.peek(qP).b, built.w.instructions[qP].b);
  for (let i = 0; i < P.PAIRS; i++) {
    const low = P.START + i * P.SPACING;
    for (const plant of [[low], [low + P.GAP]]) {
      const vm = run(plant);
      assert.deepEqual([-2, -1, 0].map((d) => vm.peek(qP + low + d).op), ['SPL', 'SPL', 'JMP'], `pair ${i}`);
      assert.deepEqual([vm.peek(qP + low - 2).a, vm.peek(qP + low - 1).a, vm.peek(qP + low).a], [0, core - 1, core - 2]);
      assert.equal(vm.peek(qP + low + P.GAP).op, 'JMP');
      assert.ok(vm.cycle <= 2 * i + 2 + (i + 1) + 3 + 3 * P.RUN, `pair ${i} took ${vm.cycle} cycles`);
    }
    // Two equal cells are not a find.
    assert.equal(run([low, low + P.GAP]).cycle, P.PAIRS + 1);
  }
});

test('broken settings are refused by the contract and by the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  const refuses = (tree, re) => assert.ok(treeMismatches(tree, s88).some((m) => re.test(m)), `${JSON.stringify(tree)} should be refused`);
  refuses({ id: BSCAN, P: { STEP: 3359 } }, /already lands on the scanner/);
  refuses({ id: 'par', kids: [{ id: 'stone' }, { id: BSCAN }] }, /attacks every cell|clear/);
  refuses({ id: REPL, P: { STEP: 3044 } }, /grain of 15/);
  refuses({ id: 'apart', kids: [{ id: 'stone' }, { id: REPL }] }, /attacks every cell/);
  refuses(seq({ id: Q2, P: { GAP: 37 } }, guarded), /multiple of STEP/);
  refuses(seq({ id: Q2, P: { PAIRS: 8 } }, guarded), /reaches the image/);
  refuses(seq({ id: 'opening-none' }, { id: BURST, P: { COUNT: 40, STEP: 100 } }, guarded), /wrap into the warrior/);
  assert.ok(treeMismatches(seq({ id: BURST }, guarded), s88).length > 0, 'a burst needs an opening before it');

  // The gate itself: a pointer a cell out, a copy aimed a cell out, a pass that is not GAP wide, a rung that adds too much.
  const scanner = buildTree({ id: BSCAN }, { rules: '88' });
  scanner.w.instructions[scanner.labels.b0cPtr].b++;
  assert.throws(() => gate(scanner), /looked at the wrong cell/);
  const repl = buildTree({ id: REPL }, { rules: '88' });
  repl.w.instructions[repl.labels.b0rArm].a++;
  assert.throws(() => gate(repl), /the copy went to|other than its DAT|bombed its copy/);
  const burst = buildTree(seq({ id: 'opening-qscan-add-88', P: { ROWS: 3 } }, { id: BURST }, guarded), { rules: '88' });
  burst.w.instructions[burst.labels[burst.root.kids[1].ns + 'bLoop'] + 1].a++;
  assert.throws(() => gate(burst), /did not lay both streams/);
  const q2 = buildTree(seq({ id: Q2 }, guarded), { rules: '88' });
  q2.w.instructions[q2.labels[q2.root.kids[0].ns + 'qRung1']].a++;
  assert.throws(() => gate(q2), /no SPL 0 \/ SPL -1 \/ JMP -2 pit|bombed its own image/);
});

// The whole 80,000-cycle round, with the read-only observer attached.
const full = (tree) => {
  const built = buildTree(tree, { rules: '88', verification: 'full' });
  assert.equal(built.verification.ok, true);
  assert.equal(built.verification.profile, 'full');
  assert.equal(built.verification.horizon, built.settings.maxCycles);
};

test('full verification: the four blocks at their defaults, alone and in their main combinations', () => {
  const q = { id: 'opening-qscan-add-88', P: { ROWS: 3 } };
  full({ id: BSCAN });
  full({ id: REPL });
  full(seq(q, { id: BURST }, guarded));
  full(seq(q, { id: BURST }, { id: BSCAN }));
  full(seq(q, { id: BURST }, { id: REPL }));
  full(seq({ id: Q2 }, guarded));
  full(seq({ id: Q2 }, { id: BSCAN }));
});
