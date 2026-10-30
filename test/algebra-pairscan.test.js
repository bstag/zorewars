import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';

const ALL = ['88', '94nop', 'lp', '94x'], NEW = ['94nop', 'lp', '94x'];
const IDS = ['pair-wipe-scanner', 'pair-wipe-scanner-88', 'cmp-carpet-scanner'];
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};
const seq = (...kids) => ({ id: 'seq', kids });
const trigger = (a, b, TIME = 2000) => ({ id: 'trigger', P: { MODE: 0, TIME }, kids: [a, b] });
const PW = { STEP: 5287, GAP: 8, BACK: 4, WIPE: 16, STREAM: 0, CLEAR: 1 };
const pw = (P = {}) => ({ id: 'pair-wipe-scanner', P: { ...PW, ...P } });
const pw88 = (P = {}) => ({ id: 'pair-wipe-scanner-88', P: { ...PW, ...P } });
const carpet = { id: 'cmp-carpet-scanner' };

test('the pair scanners are loaded with working defaults', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
    assert.equal(typeof leaves[id].plant, 'function', id);
    assert.equal(leaves[id].loop, 'sLoop', id);
  }
  assert.equal(leaves['pair-wipe-scanner'].writes(PW), 'core');
  assert.equal(leaves['pair-wipe-scanner'].writes({ ...PW, CLEAR: 0 }), 'sparse');
});

test('pair-wipe-scanner wipes, scans on and clears, alone and in combinations', () => {
  for (const rules of NEW) {
    ok(pw(), rules, ['pair-wipe-scanner']);
    ok(pw({ STREAM: 1 }), rules, ['pair-wipe-scanner']);
  }
  ok(seq({ id: 'opening-sne' }, pw()), '94nop', ['opening-sne', 'pair-wipe-scanner']);
  ok(seq({ id: 'opening-sne' }, pw({ STREAM: 1 })), 'lp', ['opening-sne', 'pair-wipe-scanner']);
  ok({ id: 'par', kids: [pw({ CLEAR: 0 }), { id: 'stone' }] }, '94nop', ['pair-wipe-scanner']);
  ok(trigger(pw({ CLEAR: 0 }), { id: 'finisher-dclear' }), '94nop', ['pair-wipe-scanner']);
  ok(trigger(pw({ CLEAR: 0, STEP: 2341, GAP: 12, WIPE: 20 }), { id: 'finisher-twopass' }), '94x', ['pair-wipe-scanner']);
});

test("pair-wipe-scanner-88 does the same in ICWS'88", () => {
  for (const rules of ALL) ok(pw88(), rules, ['pair-wipe-scanner-88']);
  ok(pw88({ STREAM: 1 }), '88', ['pair-wipe-scanner-88']);
  ok(pw88({ STREAM: 1 }), '94nop', ['pair-wipe-scanner-88']);
  ok(seq({ id: 'opening-cmpscan-88' }, pw88()), '88', ['opening-cmpscan-88', 'pair-wipe-scanner-88']);
  ok({ id: 'par', kids: [pw88({ CLEAR: 0 }), { id: 'stone' }] }, '88', ['pair-wipe-scanner-88']);
  ok(trigger(pw88({ CLEAR: 0 }), { id: 'finisher-gated' }), '88', ['pair-wipe-scanner-88']);
});

test('cmp-carpet-scanner carpets what it finds and hands over to a clear', () => {
  for (const rules of ALL) {
    ok(carpet, rules, ['cmp-carpet-scanner']);
    ok(trigger(carpet, { id: 'finisher-twopass' }), rules, ['cmp-carpet-scanner']);
  }
  ok(trigger(carpet, { id: 'finisher-gated' }, 3000), '88', ['cmp-carpet-scanner']);
  ok({ id: 'par', kids: [carpet, { id: 'stone' }] }, '94nop', ['cmp-carpet-scanner']);
  ok(seq({ id: 'opening-sne' }, carpet), '94nop', ['opening-sne', 'cmp-carpet-scanner']);
});

test("the '88 blocks pass the strict '88 check", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pairscan-'));
  try {
    for (const tree of [pw88({ STREAM: 1 }), trigger(carpet, { id: 'finisher-twopass' })]) {
      const file = path.join(dir, 'w.red');
      fs.writeFileSync(file, buildTree(tree, { rules: '88' }).source);
      const out = JSON.parse(execFileSync(process.execPath, ['cli/zorewars.js', 'check', file, '--rules', '88', '--json'], { encoding: 'utf8' }));
      assert.equal(out.ok, true, JSON.stringify(out));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(pw(), s88, /pair-wipe-scanner needs ICWS'94/);
  has(pw({ WIPE: 12 }), s94, /WIPE must be more than BACK \+ GAP/);
  has(pw88({ STREAM: 1, CLEAR: 0 }), s88, /STREAM needs CLEAR 1/);
  has(pw({ STEP: 400 }), s94, /never comes round to its own code/);
  has({ id: 'par', kids: [pw(), { id: 'stone' }] }, s94, /a clear erases its partners/);
  has({ id: 'cmp-carpet-scanner', P: { STEP: 5287, GAP: 8, BACK: 16, CARPET: 16 } }, s94, /BACK must be less than CARPET/);
});

// A copy of a block whose code is changed by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  // Plants and watches name their scenario after the block's id.
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid, ...(P ? { P } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const same = (l, o, m, a, b) => [o, m, a, b];
  const cases = [
    // A wipe one cell short.
    [broken('pair-wipe-scanner', (l, o, m, a, b) => (o === 'MOV' && a === '#16' ? [o, m, '#15', b] : same(l, o, m, a, b))), '94nop', /did not wipe the planted run/],
    // The clear's count one cell too many: it reaches the image.
    [broken('pair-wipe-scanner', (l, o, m, a, b) => (o === 'MOV' && a.startsWith('#((CORESIZE-') ? [o, m, a.replace('#((CORESIZE-', '#((1+CORESIZE-'), b] : same(l, o, m, a, b))), '94nop', /bombed its own warrior/],
    // '88: the safety bound gone, so it wipes its own code when it comes round to it.
    [broken('pair-wipe-scanner-88', (l, o, m, a, b) => (o === 'SLT' ? [o, m, '#0', b] : same(l, o, m, a, b))), '88', /bombed its own warrior/],
    // '88: the stream starts inside the warrior.
    [broken('pair-wipe-scanner-88', (l, o, m, a, b) => (l === 'sptr' ? [o, m, a, '#1'] : same(l, o, m, a, b)), { ...PW, STREAM: 1 }), '88', /stream decremented its own warrior/],
    // Carpet: never decodes the pair, so a find on a pair's first cell is carpeted around the wrong cell.
    [broken('cmp-carpet-scanner', (l, o, m, a, b) => (o === 'SUB' ? [o, m, '#0', b] : same(l, o, m, a, b))), '88', /did not carpet the planted target|carpeted an empty core/],
  ];
  for (const [tree, rules, re] of cases) assert.throws(() => buildTree(tree, { rules }), re, tree.id);
});
