// The defence, movement and sensor blocks (tools/algebra/blocks/defence.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves } from '../tools/algebra/index.js';

const RULES = ['88', '94nop', 'lp', '94x'];
const IDS = ['leap', 'sentinel-stone', 'worker-refresher', 'mutual-repair', 'numeric-disruptor', 'report-bomb'];
const supports = (id, rules) => !(leaves[id].dialects === '94' && rules === '88');
const scenarios = (built) => built.verification.observations.map((o) => o.scenario);
const bomber = { id: 'opening-bomber', P: { WAIT: 64, STEP: 997 } };
const trigger = (a, b) => ({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [a, b] });

test('every defence block passes the gate alone, with its planted reaction, on every rule set it supports', () => {
  for (const id of IDS) for (const rules of RULES) {
    if (!supports(id, rules)) {
      assert.ok(treeMismatches({ id }, recipeSettings(rules)).some((m) => /needs ICWS'94/.test(m)), id);
      continue;
    }
    const built = buildTree({ id }, { rules });
    assert.equal(built.verification.ok, true, `${id} ${rules}`);
    assert.ok(scenarios(built).includes(`${id}: planted target`), `${id} ${rules}: no planted scenario`);
  }
});

test('defence blocks in combinations', () => {
  const cases = [
    ['leap', { id: 'seq', kids: [bomber, { id: 'leap' }] }],
    ['sentinel-stone', trigger({ id: 'sentinel-stone' }, { id: 'finisher-counted' })],
    ['worker-refresher', { id: 'seq', kids: [bomber, { id: 'worker-refresher' }] }],
    ['mutual-repair', { id: 'seq', kids: [bomber, { id: 'mutual-repair' }] }],
    ['numeric-disruptor', trigger({ id: 'numeric-disruptor' }, { id: 'finisher-counted' })],
    ['report-bomb', { id: 'seq', kids: [bomber, { id: 'report-bomb' }] }],
  ];
  for (const [id, tree] of cases) for (const rules of RULES) {
    if (!supports(id, rules)) continue;
    const built = buildTree(tree, { rules });
    assert.equal(built.verification.ok, true, `${id} ${rules}`);
    assert.ok(scenarios(built).includes(`${id}: planted target`), `${id} ${rules}`);
  }
  // Two sensors side by side: the stone's guard spares the controller and its worker template.
  assert.equal(buildTree({ id: 'par', kids: [{ id: 'sentinel-stone' }, { id: 'worker-refresher' }] }, { rules: '88', length: 60 }).verification.ok, true);
});

test('broken settings are refused', () => {
  const s94 = recipeSettings('94nop'), s94x = recipeSettings('94x'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'leap', P: { SENT: 40, HOP: 210 } }, s94, /HOP must clear both sentinels/);
  has({ id: 'mutual-repair', P: { TSTEP: 48 } }, s94, /must divide half the core/);
  assert.deepEqual(treeMismatches({ id: 'mutual-repair', P: { TSTEP: 80 } }, s94), []);
  has({ id: 'mutual-repair', P: { TSTEP: 80 } }, s94x, /must divide half the core/);           // 27720 is not a multiple of 80
  has({ id: 'report-bomb', P: { STEP: 40, BACK: 30, ATTACK: 32 } }, s94, /could reach home/);
  has({ id: 'report-bomb', P: { STEP: 30, BACK: 8, ATTACK: 32 } }, s94, /must divide the core/);
  has({ id: 'report-bomb' }, s88, /needs ICWS'94/);
  has({ id: 'worker-refresher', P: { DSTEP: 2377, LIFE: 200, WSTEP: 200, REPEAT: 8 } }, s94, /reach is too long/);
  has({ id: 'sentinel-stone', P: { TSTEP: 0, BURST: 24 } }, s94, /TSTEP must be an integer/);
  has({ id: 'numeric-disruptor', P: { AMT: 0 } }, s94, /AMT must be an integer/);
  // The gate: in '88 the leap copies itself downwards, so a sentinel this close lets the front catch the copy.
  assert.throws(() => buildTree({ id: 'leap', P: { SENT: 16, HOP: 1000 } }, { rules: '88' }), /not a whole copy/);
  assert.equal(buildTree({ id: 'leap', P: { SENT: 16, HOP: 1000 } }, { rules: '94nop' }).verification.ok, true);   // '94 copies upwards
});

test('the gate catches a block whose reaction is broken', () => {
  // Rewrite one instruction of a block as it is emitted, build it, and put the block back.
  const broken = (id, fix, rules = '94nop') => {
    const b = leaves[id], emit = b.emit;
    b.emit = (ctx) => emit({ ...ctx, ins: (l, op, mod, a, x = '0') => ctx.ins(...(fix(ctx, l, op, mod, a, x) ?? [l, op, mod, a, x])) });
    try { assert.throws(() => buildTree({ id }, { rules }), (e) => new RegExp(`^${id}: |did not survive`).test(e.message)); } finally { b.emit = emit; }
  };
  // A leap that jumps towards the front instead of away from it.
  broken('leap', (ctx, l, op, mod, a, x) => (l === 'back' ? [l, op, mod, `#(${ctx.L('first')}-${ctx.L('dst')}+${ctx.P.HOP})`, x] : null));
  // A stone that never looks at its marker, and one that forgets to re-arm it.
  broken('sentinel-stone', (ctx, l, op, mod, a, x) => (op === 'JMP' && a === ctx.L('hit') ? [l, op, mod, ctx.L('loop'), x] : null));
  broken('sentinel-stone', (ctx, l, op, mod, a, x) => (l === 'hit' ? [l, 'MOV', 'I', ctx.L('mark'), ctx.L('mark')] : null), '88');
  // Refreshes that start over, and a controller without its guard.
  broken('worker-refresher', (ctx, l, op, mod, a, x) => (op === 'ADD' && a === `#${ctx.P.LIFE * ctx.P.WSTEP}` ? [l, op, mod, '#0', x] : null));
  broken('worker-refresher', (ctx, l, op, mod, a, x) => (op === 'SLT' ? [l, op, mod, '#0', x] : null), '88');
  // Partners that never restore anything (in the code and its template alike).
  broken('mutual-repair', (ctx, l, op, mod, a, x) => (op === 'MOV' && mod === 'I' && a.startsWith('@') ? [l, 'MOV', 'I', '0', '0'] : null));
  // A stream that subtracts nothing.
  broken('numeric-disruptor', (ctx, l, op, mod, a, x) => (l === 'dec' ? [l, 'DAT', 'F', '#0', '#0'] : null), '88');
  // A receiver that ignores reports, and bombs that would report the wrong place.
  broken('report-bomb', (ctx, l, op, mod, a, x) => (l === 'look' ? [l, 'JMP', 'B', ctx.L('loop'), x] : null));
  broken('report-bomb', (ctx, l, op, mod, a, x) => (l === 'rb' ? [l, 'MOV', 'AB', '#1', x] : null));
});
