// The two long 94nop quickscans (tools/algebra/blocks/opening-qscan-qbob.js and
// opening-qscan-add94.js): each builds and passes the gate behind a burst and a
// fan boot, decodes a marker on every cell it tests, hands on the image
// boundary when there is nothing, and refuses settings that cannot work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, shape } from '../tools/algebra/index.js';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const ok = (rules, tree, length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const seq = (...kids) => ({ id: 'seq', kids });
const stone = { id: 'mod-stone' };
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 };
const mod = (x, n) => ((x % n) + n) % n;
const inverse = (a, n) => { for (let x = 1; x < n; x++) if ((a * x) % n === 1) return x; return null; };

// Runs the opening with a marker on `cell` (an offset from the probe, or null) until control reaches the next block.
function scan(built, settings, cell) {
  const w = compile(built.source, 'redcode', settings), vm = new VM(settings);
  vm.load([w], { positions: [0] });
  const probe = built.labels[built.root.kids[0].ns + 'probe'], next = built.spans[built.root.kids[1].ns].start;
  if (cell !== null) vm.poke(probe + cell, MARKER);
  let muls = 0;
  while (vm.processes(0)[0] !== next && vm.cycle < 400) { if (vm.peek(vm.processes(0)[0]).op === 'MUL') muls++; vm.step(); }
  assert.equal(vm.processes(0)[0], next, 'the opening never handed on');
  return { found: vm.peek(probe).b, cycles: vm.cycle, muls, probe };
}

test('opening-qscan-qbob: gate, every cell of both rows decoded, one MUL for the first row and two for the second', () => {
  for (const rules of ['94nop', '94x']) ok(rules, seq({ id: 'opening-qscan-qbob' }, { id: 'probe-burst2' }, stone));
  ok('94nop', seq({ id: 'opening-qscan-qbob', P: { UNITS: 8, UNITS2: 3 } }, { id: 'probe-burst2' }, { id: 'fanboot', P: { N: 6, K: 2 }, kids: [stone, { id: 'loop-paper6', P: { FAN: 0 } }] }));
  ok('94nop', seq({ id: 'opening-qscan-qbob', P: { UNITS: 4, UNITS2: 4 } }, stone));
  for (const P of [{}, { UNITS: 8, UNITS2: 3 }, { UNITS: 4, UNITS2: 1, QFAC: 243 }]) {
    const settings = recipeSettings('94nop', 100), core = 8000;
    const built = buildTree(seq({ id: 'opening-qscan-qbob', P }, stone), { rules: '94nop', length: 100 }), q = built.root.kids[0].P;
    const dec = mod(1 + inverse(q.QFAC, core), core);
    let tested = 0;
    for (let k = 0; k < q.UNITS; k++) {
      const b = mod((k + 1) * (1 + q.QFAC), core), row1 = [b + dec, b + dec + q.GAP, b, b + q.GAP], c = mod(q.QF2 * b, core);
      for (const cell of row1) { const r = scan(built, settings, mod(cell, core)); assert.equal(r.found, mod(cell, core), `unit ${k}`); assert.equal(r.muls, 1); tested++; }
      if (k < q.UNITS2) for (const cell of [c, c + q.GAP]) { const r = scan(built, settings, mod(cell, core)); assert.equal(r.found, mod(cell, core), `row 2, unit ${k}`); assert.equal(r.muls, 2); tested++; }
    }
    assert.equal(tested, 4 * q.UNITS + 2 * q.UNITS2);
    // Nothing there: the probe stays on the image boundary and no MUL runs.
    const none = scan(built, settings, null);
    assert.equal(none.probe + none.found, built.total);
    assert.equal(none.muls, 0);
    assert.equal(none.cycles, 2 * q.UNITS + q.UNITS2 + 1);
  }
});

test('opening-qscan-add94: gate, every cell decoded from the unit\'s own operand, no table', () => {
  for (const rules of ['94nop', '94x']) ok(rules, seq({ id: 'opening-qscan-add94' }, { id: 'probe-burst2' }, stone));
  ok('94nop', seq({ id: 'opening-qscan-add94', P: { UNITS: 9 } }, { id: 'probe-burst2' }, { id: 'fanboot', P: { N: 6, K: 2 }, kids: [stone, { id: 'loop-paper6', P: { FAN: 0 } }] }));
  ok('94nop', seq({ id: 'opening-qscan-add94', P: { UNITS: 2 } }, stone));
  for (const [rules, P] of [['94nop', {}], ['94nop', { UNITS: 13, SPACING: 521 }], ['94nop', { UNITS: 4, START: 900, GAP: 7, HALF: 2000 }], ['94x', { UNITS: 7 }]]) {
    const settings = recipeSettings(rules, 100), core = settings.coreSize;
    const built = buildTree(seq({ id: 'opening-qscan-add94', P }, stone), { rules, length: 100 }), q = built.root.kids[0].P;
    for (let k = 0; k < q.UNITS; k++) for (const d of [0, q.GAP, q.HALF, q.HALF + q.GAP]) {
      const cell = mod(q.START + k * q.SPACING + d, core), r = scan(built, settings, cell);
      assert.equal(r.found, cell, `${rules} unit ${k} +${d}`);
      assert.equal(r.muls, 1);
    }
    const none = scan(built, settings, null);
    assert.equal(none.probe + none.found, built.total);
    assert.equal(none.muls, 0);
    // The whole opening: the probe, three lines a unit, the miss JMP, the ladder, 12 decoder lines and sel.
    assert.equal(built.spans[built.root.kids[0].ns].size + 1, 1 + 3 * q.UNITS + 1 + (Math.ceil(q.UNITS / 3) - 1) + 12 + 1);
  }
});

test('settings that cannot work are refused', () => {
  const has = (tree, re, rules = '94nop') => {
    const m = treeMismatches(tree, recipeSettings(rules, 100));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  for (const id of ['opening-qscan-qbob', 'opening-qscan-add94']) has(seq({ id }, stone), /needs ICWS'94/, '88');
  has(seq({ id: 'opening-qscan-qbob', P: { QFAC: 350 } }, stone), /has no inverse mod 8000/);
  has(seq({ id: 'opening-qscan-qbob', P: { UNITS: 4, UNITS2: 5 } }, stone), /UNITS2 cannot exceed UNITS/);
  has(seq({ id: 'opening-qscan-qbob', P: { QF2: 8001 } }, stone), /two probes test the same cell/);
  has(seq({ id: 'opening-qscan-qbob', P: { QFAC: 1 } }, stone), /lands on or next to the warrior/);
  has(seq({ id: 'opening-qscan-add94', P: { START: 50 } }, stone), /lands on or next to the warrior/);
  has(seq({ id: 'opening-qscan-add94', P: { HALF: 53 } }, stone), /two probes test the same cell/);
  has(seq({ id: 'opening-qscan-add94', P: { SPACING: 8000 } }, stone), /two probes test the same cell/);
});
