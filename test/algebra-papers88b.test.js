// silk-tail-88 (tools/algebra/blocks/papers88b.js): the straight-line '88 paper
// with a clear or an imp tail. It builds and passes the gate in each shape on
// 88 and 94nop, alone and in combinations; its stages are checked in the VM;
// broken settings are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const ID = 'silk-tail-88';
const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};

test('every shape passes the gate alone on 88 and 94nop', () => {
  const sizes = { '2,0': 9, '3,0': 11, '2,1': 11, '3,1': 14 };   // fan + body
  for (const rules of ['88', '94nop']) {
    for (const STAGES of [2, 3]) for (const TAIL of [0, 1]) {
      assert.equal(ok(rules, { id: ID, P: { STAGES, TAIL } }).total, sizes[`${STAGES},${TAIL}`]);
    }
  }
});

test('each stage lays a whole copy where STEP says and starts the whole group in it', () => {
  for (const TAIL of [0, 1]) {
    const built = ok('88', { id: ID, P: { TAIL } });
    const P = { ...leaves[ID].defaults, TAIL }, core = built.settings.coreSize;
    const LEN = 2 * P.STAGES + (TAIL ? 4 : 2), base = 500, k0 = base + built.labels.b0k0;
    const vm = new VM(built.settings);
    vm.load([built.w], { positions: [base] });
    while (vm.cycle < 600) vm.step();
    [P.STEP1, P.STEP2, P.STEP3].forEach((step, j) => {
      const src = k0 + 2 * j, dst = (src + step) % core;
      for (let i = 0; i < LEN - 2 * j; i++) {      // the body cells of the window; the rest were counters
        const a = vm.peek(src + i), b = vm.peek(dst + i);
        assert.equal(b.op, a.op, `stage ${j + 1} cell ${i}`);
        if (a.op === 'MOV') assert.equal(b.a, a.a, `stage ${j + 1} cell ${i}`);   // the copies have since moved their own pointers
      }
    });
    // Three copies and the original's tail: 4 groups of LEN, plus what the copies have started since.
    assert.ok(vm.processes(0).length >= 4 * LEN);
    // The tail: the clear has wiped below the body; the imp tail has imps a ring step apart.
    if (!TAIL) {
      const djn = base + built.labels.b0tDjn;
      assert.equal(vm.peek(djn - P.GAP - 1).op, 'MOV');
      assert.equal(vm.peek(djn - P.GAP - LEN).op, 'MOV');
      assert.equal(vm.peek(djn - P.GAP).op, 'DAT');
    } else {
      while (vm.cycle < 3000) vm.step();
      const imp = base + built.labels.b0tImp;
      for (const k of [0, 1, 2]) assert.equal(vm.peek((imp + k * 2667) % core).op, 'MOV', `ring point ${k}`);
      const imps = vm.processes(0).filter((q) => vm.peek(q).op === 'MOV' && vm.peek(q).b === 2667 && vm.peek(q).a === 0);
      assert.ok(imps.length >= LEN);
    }
  }
});

test('it combines: after a quickscan, beside a stone, and apart from one', () => {
  assert.ok(ok('88', { id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 6 } }, { id: ID }] }).total <= 50);
  ok('88', { id: 'par', kids: [{ id: ID }, { id: 'stone' }] });
  ok('88', { id: 'apart', kids: [{ id: 'stone' }, { id: ID, P: { TAIL: 1 } }] });
  ok('94nop', { id: 'seq', kids: [{ id: 'opening-none' }, { id: ID, P: { TAIL: 1 } }] });
});

test('broken settings are refused by the contract, the linker and the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  const refuses = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), `${JSON.stringify(tree)} should be refused`);
  refuses({ id: ID, P: { STEP1: 7990 } }, s88, /lays its copy on the warrior/);
  refuses({ id: ID, P: { STEP2: 3364 } }, s88, /overlap/);
  refuses({ id: ID, P: { GAP: 20 } }, s88, /inside the warrior/);
  refuses({ id: ID, P: { TAIL: 1, STEP3: 5712 } }, s88, /path of its parent's imps/);
  refuses({ id: ID, P: { TAIL: 1 } }, { ...RULESETS['94x'], maxLength: 50 }, /no 3-point imp ring/);
  refuses({ id: ID }, { ...RULESETS.lp, maxLength: 50 }, /too few/);
  // Decoys after it would be read as its counters.
  assert.throws(() => buildTree({ id: 'image', kids: [{ id: ID }, { id: 'decoys' }] }, { rules: '88' }), /last block in the image/);

  // A stage whose pointer is a cell out lays its copy in the wrong place.
  const moved = buildTree({ id: ID }, { rules: '88' });
  moved.w.instructions[moved.labels.b0k3].b++;
  assert.throws(() => gate(moved), /laid its copy/);
  // A counter aimed a cell short copies the wrong window.
  const short = buildTree({ id: ID }, { rules: '88' });
  short.w.instructions[short.labels.b0k0].a--;
  assert.throws(() => gate(short), /incomplete copy/);
  // An imp tail whose step is not the ring step leaves the ring.
  const ring = buildTree({ id: ID, P: { TAIL: 1 } }, { rules: '88' });
  ring.w.instructions[ring.labels.b0tAdd].a++;
  assert.throws(() => gate(ring), /left the ring|imps are alive|did not survive/);
});

// The whole 80,000-cycle round, with the read-only observer attached.
const full = (tree) => {
  const built = buildTree(tree, { rules: '88', verification: 'full' });
  assert.equal(built.verification.ok, true);
  assert.equal(built.verification.profile, 'full');
  assert.equal(built.verification.horizon, built.settings.maxCycles);
};

test('full verification: both tails at their defaults, alone and after a quickscan', () => {
  full({ id: ID });
  full({ id: ID, P: { TAIL: 1 } });
  full({ id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 6 } }, { id: ID }] });
});

test('the resin tail (TAIL 2): 11 or 14 instructions, a trail of drops from TRAIL above the drop line, quick and full', () => {
  for (const rules of ['88', '94nop']) {
    assert.equal(ok(rules, { id: ID, P: { TAIL: 2, STAGES: 2 } }).total, 11);
    assert.equal(ok(rules, { id: ID, P: { TAIL: 2 } }).total, 14);
  }
  full({ id: ID, P: { TAIL: 2 } });
  full({ id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 5 } }, { id: ID, P: { TAIL: 2 } }] });
  const built = ok('88', { id: ID, P: { TAIL: 2 } }), P = { ...leaves[ID].defaults, TAIL: 2 }, base = 500, core = built.settings.coreSize;
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [base] });
  while (vm.cycle < 400) vm.step();
  const drop = base + built.labels.b0tDrop;
  let drops = 0;
  for (let d = 1; d <= 40; d++) { const x = vm.peek((drop + P.TRAIL - d) % core); if (x.op === 'MOV' && x.aMode === '<' && x.bMode === '<' && x.a === 0) drops++; }
  assert.ok(drops >= 15, `${drops} drops in the first 40 cells of the trail`);
  assert.equal(vm.peek((drop + P.TRAIL) % core).op, 'DAT');
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  assert.ok(treeMismatches({ id: ID, P: { TAIL: 2, TRAIL: 7990 } }, s88).some((m) => /starts the resin trail on the warrior/.test(m)));
  const broken = buildTree({ id: ID, P: { TAIL: 2 } }, { rules: '88' });
  broken.w.instructions[broken.labels.b0tLay].a = 2;      // lays the DJN instead of the drop
  assert.throws(() => gate(broken), /something other than its drop/);
});
