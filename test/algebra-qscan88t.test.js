// opening-qscan-table-88 (tools/algebra/blocks/qscan88t.js): the decoding '88
// quickscan with its tables in the scan's own B-fields. It builds and passes
// the gate on 88 and 94nop, quick and full; every pair's hand-on (both cells),
// the timing and the quiet exit are checked in the VM at two load positions;
// broken settings are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const ID = 'opening-qscan-table-88';
const marker = { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 };
const guarded = { id: 'finisher-guarded-88', P: { PHASE: 0 } };
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (rules, tree, verification = 'quick', length = 100) => {
  const built = buildTree(tree, { rules, length, verification });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};

test('18 pairs are 47 cells; it passes the gate quick and full, alone and before a burst and a body', () => {
  const built = ok('88', seq({ id: ID }, guarded));
  assert.equal(built.spans[built.root.kids[0].ns].size, 47);
  ok('88', seq({ id: ID }, guarded), 'full');
  ok('88', seq({ id: ID }, { id: 'probe-burst-88' }, { id: 'stone-pump-boot-88' }), 'full');
  ok('94nop', seq({ id: ID }, { id: 'probe-burst-88' }, guarded));
  for (const PAIRS of [5, 9, 14, 20]) ok('88', seq({ id: ID, P: { PAIRS } }, guarded));
});

test('every pair hands on its occupied cell, at once, at two load positions', () => {
  for (const PAIRS of [18, 9]) {
    const built = ok('88', seq({ id: ID, P: { PAIRS } }, guarded));
    const { settings, labels, root, w } = built, core = settings.coreSize;
    const ns = root.kids[0].ns, scan = labels[ns + 'qScan'], qP = labels[ns + 'qP'], end = labels[root.kids[1].ns + 'payload'];
    const pairs = Array.from({ length: PAIRS }, (_, i) => {
      const x = w.instructions[scan + 2 * i];
      return { lo: scan + 2 * i + x.a, hi: scan + 2 * i + x.b };
    });
    // Every pair's cells are distinct, outside the image and the blank cell.
    const cells = pairs.flatMap(({ lo, hi }) => [lo, hi].map((c) => ((c % core) + core) % core));
    assert.equal(new Set(cells).size, cells.length);
    for (const base of [0, 7990]) {
      const run = (plant) => {
        const vm = new VM(settings);
        vm.load([w], { positions: [base] });
        for (const c of plant) vm.poke((base + c) % core, marker);
        while (vm.processes(0)[0] !== (base + end) % core && vm.cycle < 100) vm.step();
        assert.equal(vm.processes(0)[0], (base + end) % core, 'it handed on');
        return { cell: (((qP + vm.peek((base + qP) % core).b) % core) + core) % core, cycles: vm.cycle };
      };
      const quiet = run([]);
      assert.deepEqual(quiet, { cell: built.total % core, cycles: PAIRS + 1 });
      pairs.forEach(({ lo, hi }, i) => {
        const a = run([lo]), b = run([hi]);
        assert.equal(a.cell, ((lo % core) + core) % core, `pair ${i} low`);
        assert.equal(b.cell, ((hi % core) + core) % core, `pair ${i} high`);
        assert.equal(a.cycles, b.cycles);
        assert.ok(a.cycles <= i + 2 + 5 + 2, `pair ${i}: ${a.cycles} cycles`);
        assert.deepEqual(run([lo, hi]), quiet, `pair ${i}, both cells equal`);
      });
      // Two pairs differ: the first in scan order is reported.
      assert.equal(run([pairs[3].lo, pairs[1].hi]).cell, ((pairs[1].hi % core) + core) % core);
    }
  }
});

test('broken settings are refused by the contract, the linker and the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 100 };
  assert.ok(treeMismatches(seq({ id: ID, P: { BLANK: 7990 } }, guarded), s88).some((m) => /blank cell/.test(m)));
  assert.throws(() => buildTree(seq({ id: ID, P: { MINDIST: 2000 } }, guarded), { rules: '88', length: 100 }), /try another SEED/);
  // A table entry one off moves every find that reads it.
  const built = buildTree(seq({ id: ID }, guarded), { rules: '88', length: 100 });
  built.w.instructions[built.labels[built.root.kids[0].ns + 'qT']].b++;
  assert.throws(() => gate(built), /handed on the wrong cell/);
  // A pair whose second line jumps one decoder line too far is decoded short.
  const short = buildTree(seq({ id: ID }, guarded), { rules: '88', length: 100 });
  const last = short.labels[short.root.kids[0].ns + 'qScan'] + 2 * (leaves[ID].defaults.PAIRS - 1) + 1;
  short.w.instructions[last].a++;
  assert.throws(() => gate(short), /handed on the wrong cell|cycles/);
});

test('BURST: 18 pairs and the burst are 49 cells; every find bombs both of its cells and nothing else, quick and full', () => {
  const P = { BURST: 8, STEP: 9, BACK: 3, GAP: 43 };
  const built = ok('88', seq({ id: ID, P }, guarded));
  assert.equal(built.spans[built.root.kids[0].ns].size, 49);
  ok('88', seq({ id: ID, P }, guarded), 'full');
  ok('88', seq({ id: ID, P }, { id: 'silk-tail-88' }), 'full');
  ok('94nop', seq({ id: ID, P }, guarded));
  const { settings, labels, root, w, total } = built, core = settings.coreSize;
  const ns = root.kids[0].ns, scan = labels[ns + 'qScan'], qP = labels[ns + 'qP'], end = labels[root.kids[1].ns + 'payload'];
  const writers = [labels[ns + 'bLoop'], labels[ns + 'bTwo']];
  const norm = (x) => ((x % core) + core) % core;
  for (const base of [0, 7990]) {
    const run = (plant) => {
      const vm = new VM(settings);
      vm.load([w], { positions: [base] });
      for (const c of plant) vm.poke(norm(base + c), marker);
      while (vm.processes(0)[0] !== norm(base + end) && vm.cycle < 200) vm.step();
      assert.equal(vm.processes(0)[0], norm(base + end), 'it handed on');
      const bombs = [];
      for (let c = 0; c < core; c++) if (vm.writeCycle[c] > 0 && writers.includes(norm(vm.writerPc[c] - base))) bombs.push(norm(c - base));
      return { bombs: bombs.sort((a, b) => a - b), cycles: vm.cycle };
    };
    assert.deepEqual(run([]).bombs, []);
    for (let i = 0; i < 18; i++) {
      const x = w.instructions[scan + 2 * i], lo = norm(scan + 2 * i + x.a), hi = norm(scan + 2 * i + x.b);
      const want = [];
      for (let k = 0; k < P.BURST; k++) want.push(norm(hi - P.BACK * P.STEP + k * P.STEP), norm(hi - P.BACK * P.STEP + k * P.STEP - P.GAP));
      for (const plant of [[lo], [hi]]) {
        const { bombs } = run(plant);
        assert.deepEqual(bombs, [...new Set(want)].sort((a, b) => a - b), `pair ${i}`);
        assert.ok(bombs.includes(lo) && bombs.includes(hi), `pair ${i}: both cells bombed`);
        assert.ok(bombs.every((c) => c >= total + 20 && c <= core - 20), `pair ${i}: a bomb near the image`);
      }
    }
  }
  assert.ok(treeMismatches(seq({ id: ID, P: { BURST: 3, BACK: 3 } }, guarded), { ...RULESETS['88'], maxLength: 100 }).some((m) => /BACK must be below BURST/.test(m)));
});
