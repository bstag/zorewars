import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves } from '../tools/algebra/index.js';

const RULES = ['88', '94nop', 'lp', '94x'];
const IDS = ['mod-stone', 'spl-stone', 'djn-stream', 'jmp-bomber', 'carpet-bomber', 'incendiary'];
const passes = (tree, rules) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${rules} ${JSON.stringify(tree)}`);
  return built;
};
const finisher = { id: 'finisher-counted' };
const spiral = (rules) => (rules === 'lp' ? { id: 'spiral', P: { SN: 3, SK: 2 } } : { id: 'spiral', P: { SN: 13, SK: 4 } });

test('every stone builds and passes the gate alone with its defaults, on every rule set', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(leaves[id].kind, 'body');
    assert.ok(leaves[id].loop, `${id} has a loop for trigger`);
    for (const rules of RULES) assert.equal(passes({ id }, rules).verification.shape, 'generic');
  }
});

test('the other settings pass too: guards, two bombs, wide carpets, SPL traps, unrolled streams', () => {
  const cases = [
    { id: 'mod-stone', P: { GUARD: 1 } },
    { id: 'mod-stone', P: { GUARD: 1, STEP: 3 } },                 // guarded, any step is safe
    { id: 'jmp-bomber', P: { BOMB: 1 } },
    { id: 'jmp-bomber', P: { BOMB: 1, GUARD: 1 } },
    { id: 'carpet-bomber', P: { GUARD: 1, WIDTH: 4 } },
    { id: 'carpet-bomber', P: { STEP: 2936, WIDTH: 2 } },
    { id: 'incendiary', P: { GUARD: 1 } },
    { id: 'djn-stream', P: { UNROLL: 1 } },
    { id: 'djn-stream', P: { UNROLL: 8 } },
  ];
  for (const rules of RULES) for (const tree of cases) passes(tree, rules);
  for (const rules of ['94nop', '94x']) passes({ id: 'mod-stone', P: { STEP: 2936, BOMBS: 2 } }, rules);
});

test('stones in combinations: a guarded stone hands over to a clear, bodies side by side, copies apart', () => {
  for (const rules of RULES) {
    for (const id of ['mod-stone', 'jmp-bomber', 'carpet-bomber', 'incendiary']) passes({ id: 'trigger', kids: [{ id, P: { GUARD: 1 } }, finisher] }, rules);
    passes({ id: 'trigger', kids: [{ id: 'djn-stream' }, finisher] }, rules);
    passes({ id: 'par', kids: [{ id: 'djn-stream' }, { id: 'mod-stone' }] }, rules);
    passes({ id: 'par', kids: [{ id: 'spl-stone', P: { STEP: 3044, PROCS: 4 } }, spiral(rules)] }, rules);
    passes({ id: 'apart', kids: [{ id: 'spl-stone', P: { STEP: 4, PROCS: 3 } }, { id: 'mod-stone', P: { GUARD: 1 } }] }, rules);
  }
  for (const rules of ['88', '94nop', '94x']) for (const id of ['mod-stone', 'jmp-bomber', 'carpet-bomber', 'incendiary']) passes({ id: 'par', kids: [{ id }, spiral(rules)] }, rules);
  // A trigger fires from the marker and from damage too.
  passes({ id: 'trigger', P: { MODE: 1, TIME: 1 }, kids: [{ id: 'mod-stone', P: { GUARD: 1 } }, spiral('94nop')] }, '94nop');
  passes({ id: 'trigger', P: { MODE: 2, TIME: 1 }, kids: [{ id: 'carpet-bomber', P: { GUARD: 1 } }, { id: 'jmp-bomber', P: { GUARD: 1 } }] }, '88');
});

test('layout-safe where the core stone is not: the same step, the warrior a few cells longer', () => {
  const tail = (n) => ({ id: 'decoys', P: { DECOYS: n, DECOY: 0 } });
  for (const n of [1, 2, 3, 4]) {
    passes({ id: 'image', kids: [{ id: 'mod-stone', P: { STEP: 3044 } }, tail(n)] }, '94nop');
    passes({ id: 'image', kids: [{ id: 'jmp-bomber' }, tail(n)] }, '88');
    passes({ id: 'image', kids: [{ id: 'incendiary' }, tail(n)] }, 'lp');
  }
  assert.throws(() => buildTree({ id: 'image', kids: [{ id: 'stone', P: { TSTEP: 3044, TBOMB: 0 } }, tail(1)] }, { rules: '94nop' }), /did not survive/);
});

test('broken settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88'), lp = recipeSettings('lp');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), `${JSON.stringify(tree)}: ${JSON.stringify(treeMismatches(tree, settings))}`);
  has({ id: 'mod-stone', P: { STEP: 3 } }, s94, /land on its own loop/);
  has({ id: 'mod-stone', P: { STEP: 4000 } }, s94, /reaches only 2 cells/);
  has({ id: 'mod-stone', P: { STEP: 3044, BOMBS: 2 } }, s94, /land on its own loop/);
  has({ id: 'mod-stone', P: { STEP: 2936, BOMBS: 2 } }, s88, /need ICWS'94/);
  has({ id: 'mod-stone', P: { STEP: 2936, BOMBS: 2, GUARD: 1 } }, s94, /one bomb a pass/);
  has({ id: 'carpet-bomber', P: { STEP: 2936, WIDTH: 3 } }, s94, /land on its own loop/);
  has({ id: 'incendiary', P: { STEP: 3044 } }, s94, /land on its own loop/);
  has({ id: 'jmp-bomber', P: { STEP: 2 } }, s94, /land on its own loop/);
  has({ id: 'spl-stone', P: { STEP: 3044, PROCS: 9 } }, lp, /this hill allows 8/);
  has({ id: 'par', kids: [{ id: 'spl-stone' }, spiral('94nop')] }, lp, /more processes than this hill allows/);
  has({ id: 'djn-stream', P: { UNROLL: 9 } }, s94, /UNROLL must be/);
  assert.deepEqual(treeMismatches({ id: 'mod-stone', P: { STEP: 3, GUARD: 1 } }, s94), []);
  // An unguarded stone with a spread-out step soon bombs the trigger beside it: the gate says so.
  assert.throws(() => buildTree({ id: 'trigger', kids: [{ id: 'mod-stone' }, finisher] }, { rules: '94nop' }), /did not survive|never entered/);
});

// The bombs themselves, run by a victim: a JMP 1 that leads into them.
function victim(rules, bombs) {
  const settings = recipeSettings(rules), old = rules === '88';
  const w = compile(`${old ? '' : 'ORG s\n'}${' DAT #7, #7\n'.repeat(4)}s JMP 1\n${old ? 'END s' : 'END'}\n`, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  bombs.forEach((ins, i) => vm.poke(5 + i, ins));
  return vm;
}
const cell = (built, local, k = 0) => built.w.instructions[built.labels[built.root.ns + local] + k];

test('the bombs work on a victim: a trap holds it, an incendiary turns its code to SPL 0', () => {
  for (const rules of ['88', '94nop']) {
    for (const BOMB of [0, 1]) {
      const vm = victim(rules, [cell(buildTree({ id: 'jmp-bomber', P: { BOMB } }, { rules }), 'jbBomb')]);
      for (let i = 0; i < 60; i++) vm.step();
      assert.ok(vm.warriors[0].alive);
      assert.ok(vm.processes(0).every((q) => q === 5 || (BOMB && q === 6)), `${rules} BOMB ${BOMB}: trapped in the bomb`);   // SPL 0's other half dies on the cell after
      assert.equal(vm.processes(0).length > 1, BOMB === 1, 'SPL 0 also floods it with processes');
    }
    const built = buildTree({ id: 'incendiary' }, { rules });
    const vm = victim(rules, [cell(built, 'inSpl'), cell(built, 'inMov')]);
    for (let i = 0; i < 100; i++) vm.step();
    for (let c = 0; c <= 4; c++) assert.equal(vm.peek(c).op, 'SPL', `${rules}: the victim's cell ${c} became SPL 0`);
    assert.equal(vm.peek(-20).op, 'SPL', 'and it keeps copying backward');
  }
});
