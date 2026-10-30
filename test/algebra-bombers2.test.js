// Stones that look after themselves and a moat against vampires (tools/algebra/blocks/bombers2.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves } from '../tools/algebra/index.js';

const RULES = ['88', '94nop', 'lp', '94x'];
const IDS = ['bomb-dodger', 'airbag-stone', 'fang-gate'];
const scenarios = (built) => built.verification.observations.map((o) => o.scenario);
const passes = (tree, rules, id, length = 60) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${rules} ${JSON.stringify(tree)}`);
  if (id) assert.ok(scenarios(built).includes(`${id}: planted target`), `${rules} ${JSON.stringify(tree)}: no planted scenario`);
  return built;
};
const guarded = { id: 'mod-stone', P: { GUARD: 1 } };

test('every block passes the gate alone, with its planted reaction, on every rule set', () => {
  for (const id of IDS) {
    assert.equal(leaves[id].kind, 'body');
    assert.ok(leaves[id].loop, `${id} has a loop for trigger`);
    for (const rules of RULES) assert.equal(passes({ id }, rules, id, 50).verification.shape, 'generic');
  }
});

test('in combinations: beside an imp or a stone, copied apart, handing over to a clear', () => {
  for (const rules of RULES) {
    passes({ id: 'par', kids: [{ id: 'bomb-dodger' }, { id: 'imp' }] }, rules, 'bomb-dodger');      // the imp's laps set it moving too
    passes({ id: 'par', kids: [{ id: 'airbag-stone' }, { id: 'imp' }] }, rules, 'airbag-stone');
    passes({ id: 'par', kids: [{ id: 'fang-gate' }, guarded] }, rules, 'fang-gate');                // it wipes the stone's bombs in its moat
  }
  for (const rules of ['88', '94nop', 'lp']) {
    passes({ id: 'apart', kids: [{ id: 'bomb-dodger' }, guarded] }, rules, 'bomb-dodger');
    passes({ id: 'trigger', kids: [{ id: 'airbag-stone' }, { id: 'finisher-counted' }] }, rules, 'airbag-stone', 70);
    passes({ id: 'trigger', kids: [{ id: 'fang-gate' }, { id: 'finisher-counted' }] }, rules, 'fang-gate');
  }
  // The airbag's JMP back is the trigger's loop: a watchdog still fires on damage there, which the airbag does not mend.
  const watchdog = passes({ id: 'trigger', P: { MODE: 2, TIME: 1 }, kids: [{ id: 'airbag-stone' }, guarded] }, '94nop', 'airbag-stone');
  assert.ok(scenarios(watchdog).includes('trigger damage hit'));
  passes({ id: 'copies', kids: [{ id: 'fang-gate' }] }, 'lp', 'fang-gate');
  passes({ id: 'seq', kids: [{ id: 'opening-bomber', P: { WAIT: 64, STEP: 997 } }, { id: 'fang-gate' }] }, '88', 'fang-gate');
});

test('broken settings are refused', () => {
  const s94 = recipeSettings('94nop'), s94x = recipeSettings('94x');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'bomb-dodger', P: { STEP: 2377, SENT: 20, HOP: 120 } }, s94, /HOP must be an integer/);
  has({ id: 'bomb-dodger', P: { STEP: 2377, SENT: 100, HOP: 250 } }, s94, /put the copy on its own window/);
  has({ id: 'bomb-dodger', P: { STEP: 4000, SENT: 20, HOP: 3000 } }, s94, /reaches only 2 cells/);
  has({ id: 'airbag-stone', P: { STEP: 3960 } }, s94x, /reaches only 14 cells/);
  has({ id: 'fang-gate', P: { ZONE: 2 } }, s94, /ZONE must be an integer/);
  assert.deepEqual(treeMismatches({ id: 'bomb-dodger', P: { STEP: 2377, SENT: 20, HOP: 20000 } }, s94x), []);
  has({ id: 'bomb-dodger', P: { STEP: 2377, SENT: 20, HOP: 7950 } }, s94, /put the copy on its own window/);
});

test('the gate rejects each block with its reaction broken', () => {
  // Rewrite instructions as the block emits them, build it alone, and put the block back.
  const broken = (id, fix, rules) => {
    const b = leaves[id], emit = b.emit;
    b.emit = (ctx) => emit({ ...ctx, ins: (l, op, mod, a, x = '0') => ctx.ins(...(fix(ctx, l, op, mod, a, x) ?? [l, op, mod, a, x])) });
    try { assert.throws(() => buildTree({ id }, { rules }), (e) => new RegExp(`^${id}: |did not survive`).test(e.message), `${id} ${rules}`); } finally { b.emit = emit; }
  };
  for (const rules of ['88', '94nop']) {
    // A dodger that never reacts to its sentinels, and one that hops onto its own window.
    broken('bomb-dodger', (ctx, l, op, mod, a, x) => (op === 'JMP' && a === ctx.L('dodge') ? [l, op, mod, ctx.L('top'), x] : null), rules);
    broken('bomb-dodger', (ctx, l, op, mod, a, x) => (l === 'dodge' ? [l, op, mod, a.replace(/\+\d+\)$/, '+250)'), x] : null), rules);
    // An airbag whose checks never call the repair, and a repair that copies nothing.
    broken('airbag-stone', (ctx, l, op, mod, a, x) => (op === 'JMP' && a === ctx.L('fix') ? [l, op, mod, ctx.L('back'), x] : null), rules);
    broken('airbag-stone', (ctx, l, op, mod, a, x) => (l === 'rep' ? [l, 'JMP', 'B', '1', '0'] : null), rules);
    // A gate that finds the fangs but does not wipe them.
    broken('fang-gate', (ctx, l, op, mod, a, x) => (l?.startsWith('wipe') ? [l, 'MOV', 'I', '0', '0'] : null), rules);
  }
  // '94: a pit bomb that misses the pit, and one without its guard (it bombs the warrior a fang points at).
  broken('fang-gate', (ctx, l, op, mod, a, x) => (l === 'pit' ? [l, op, mod, a, `*${ctx.L('t')}`] : null), '94nop');
  broken('fang-gate', (ctx, l, op, mod, a, x) => (op === 'SLT' ? [l, op, mod, '#0', x] : null), '94nop');
});
