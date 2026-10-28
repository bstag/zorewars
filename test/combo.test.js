import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { compile, RULESETS } from '../src/engine/index.js';
import { emitRecipe, recipeDefaults, recipeSettings } from '../tools/blocks/recipes.js';
import { emitCompass, compassDefaults } from '../tools/blocks/compass.js';
import { emitCombo, buildCombo, verifyCombo, comboDefaults, comboCanonical, comboRepair, comboMismatches, comboSlots, verifyBodies } from '../tools/blocks/combo.js';
import { buildBlockRecipe } from '../tools/blocks/registry.js';
import { evolveBlocks } from '../tools/block-evolve.js';

const code = w => ({ start: w.start, instructions: w.instructions.map(({ line, ...x }) => x) });
const compiled = (source, settings) => { const w = compile(source, 'redcode', settings); assert.ok(w.ok, JSON.stringify(w.errors)); return code(w); };

test('the clear template is one combination: identical code for every choice and dialect', () => {
  for (const rules of ['88', '94nop', '94x']) {
    const settings = recipeSettings(rules);
    for (const OPENING of [0, 1, 2]) for (const RELOCATE of [0, 1]) for (const BACKWARD of [0, 1]) for (const PHASE of [0, 1, 2]) {
      const R = { ...recipeDefaults, OPENING, RELOCATE, BACKWARD, PHASE, WAIT: 77, STEP: 311, HOP: 2900, STUN: 40 };
      const C = { ...comboDefaults, OPENING, RELOCATE, BACKWARD, PHASE, WAIT: 77, STEP: 311, HOP: 2900, STUN: 40 };
      assert.deepEqual(compiled(emitCombo(C, settings).source, settings), compiled(emitRecipe(R, { rules }).source, settings), JSON.stringify({ rules, ...R }));
    }
  }
});

test('Compass is one combination: identical code for every layout', () => {
  const settings = recipeSettings('94x');
  for (const BOOT of [0, 1]) for (const PHASE of [0, 1, 2]) for (const DECOYS of [0, 12, 18]) for (const DECOY of [0, 1, 2]) {
    const K = { ...compassDefaults, BOOT, PHASE, DECOYS, DECOY, STEP: 4001, GAP: 5, START: 900, SCANS: 40, STUN: 100, HOP: 20000 };
    const C = { ...comboDefaults, OPENING: 3, RELOCATE: 0, FINISHER: 1, BOOT, PHASE, DECOYS, DECOY, SSTEP: 4001, GAP: 5, START: 900, SCANS: 40, STUN: 100, HOP: 20000 };
    assert.deepEqual(compiled(emitCombo(C, settings).source, settings), compiled(emitCompass(K).source, settings), JSON.stringify(K));
  }
});

test('blocks from different templates combine and pass the generic gate', () => {
  const cases = [
    ['94x', { OPENING: 1, RELOCATE: 0, FINISHER: 1, PHASE: 1 }],                 // bomber -> guarded clear from the last bomb
    ['94x', { OPENING: 2, RELOCATE: 0, FINISHER: 1, PHASE: 2 }],                 // B-scan -> guarded stun clear
    ['94x', { OPENING: 3, RELOCATE: 1, FINISHER: 0, PHASE: 1 }],                 // comparison scan -> relocated counted clear
    ['94nop', { OPENING: 3, RELOCATE: 0, FINISHER: 1, PHASE: 1, BOOT: 1, HOP: 3000, START: 700, SSTEP: 3044 }],   // Compass on the 8000 ring
    ['88', { OPENING: 1, RELOCATE: 0, FINISHER: 0, BOOT: 1, HOP: 3000, PHASE: 0, DECOYS: 6 }],                     // '88 boot + decoys
    ['lp', { OPENING: 0, RELOCATE: 0, FINISHER: 1, PHASE: 0 }],                  // guarded clear alone
  ];
  for (const [rules, choice] of cases) {
    const b = buildCombo({ ...comboDefaults, ...choice }, { rules });
    assert.ok(b.verification.ok && b.w.instructions.length <= 50, JSON.stringify(choice));
    if (choice.OPENING === 3) assert.ok(b.verification.observations.some(x => x.scenario === 'cmpscan-hit'), 'scanner hit was tested');
  }
});

test('blocks that do not fit are refused with the reason', () => {
  const refuse = (rules, choice, reason) => assert.throws(() => buildCombo({ ...comboDefaults, ...choice }, { rules }), reason);
  refuse('94x', { RELOCATE: 1, FINISHER: 1 }, /cannot be relocated/);
  refuse('94x', { RELOCATE: 1, BOOT: 1 }, /one relocation/);
  refuse('88', { OPENING: 3, RELOCATE: 0 }, /comparison scan/);
  refuse('94x', { OPENING: 2, RELOCATE: 0, FINISHER: 1, PHASE: 0 }, /SPL bomb cell/);
  refuse('94nop', { HOP: 8100 }, /lands on the warrior/);
});

test('repair makes every slot choice fit and keeps the block just chosen', () => {
  for (const rules of ['88', '94x']) {
    const settings = recipeSettings(rules);
    for (const OPENING of [0, 1, 2, 3]) for (const RELOCATE of [0, 1]) for (const FINISHER of [0, 1]) for (const BOOT of [0, 1]) for (const PHASE of [0, 1, 2])
      for (const changed of comboSlots) {
        const P = { ...comboDefaults, OPENING, RELOCATE, FINISHER, BOOT, PHASE, DECOYS: 4, DECOY: 2 }, Q = comboRepair(P, rules, changed);
        assert.deepEqual(comboMismatches(Q, settings), [], JSON.stringify({ rules, changed, P }));
        if (rules === '94x') assert.equal(Q[changed], P[changed], 'the chosen block is kept');
      }
  }
});

test('the generic gate rejects damaged handoffs, scans and clears', () => {
  const settings = recipeSettings('94x');
  const broken = (choice, from, to) => {
    const b = { ...emitCombo({ ...comboDefaults, ...choice }, settings), settings };
    assert.ok(b.source.includes(from), from); b.source = b.source.replace(from, to);
    b.w = compile(b.source, 'redcode', settings); assert.ok(b.w.ok);
    assert.throws(() => verifyCombo(b));
  };
  broken({ OPENING: 3, RELOCATE: 0, FINISHER: 1 }, 'found MOV.AB probe, probe', 'found MOV.AB #999, probe');   // scan hands on the wrong cell
  broken({ OPENING: 3, RELOCATE: 0, FINISHER: 1 }, 'SNE.I *probe, @probe', 'SEQ.I *probe, @probe');          // scan inverted
  broken({}, 'MOV.I <copySource, <copyTarget', 'MOV.I copySource, <copyTarget');                               // copy broken
  broken({}, 'DJN.B stunLoop, remaining', 'JMP.B stunLoop, remaining');                                        // stun phase never ends
  broken({ OPENING: 1, RELOCATE: 0, FINISHER: 1 }, 'killGuard SLT.AB', 'killGuard SNE.AB');                    // guard removed
});

test('code-neutral parameters do not create new ids, and the evolver mixes blocks', async () => {
  const a = comboCanonical({ ...comboDefaults, GAP: 3, SCANS: 99 }, '94x');
  assert.deepEqual(a, comboDefaults);                        // no comparison scan: its numbers are irrelevant
  const settings = RULESETS['94x'], opponents = [{ name: 'imp', group: 'test', w: compile('MOV.I 0, 1', 'redcode', settings) }];
  const pool = { async match(task) { const wins = task.a.instructions.length % (task.settings.rounds + 1);
    return { w: wins, t: 0, l: task.settings.rounds - wins, smooth: 3 * wins }; } };
  const r = await evolveBlocks({ pool, opponents, settings, families: ['combo'], populationSize: 6, offspring: 12, generations: 2, rounds: 2, seed: 11 });
  const shapes = new Set(r.candidates.map(x => `${x.recipe.P.OPENING}/${x.recipe.P.FINISHER}/${x.recipe.P.RELOCATE}/${x.recipe.P.BOOT}`));
  assert.ok(shapes.size >= 3, [...shapes].join(' '));
  assert.ok(r.candidates.every(x => x.verification.ok));
  assert.ok(r.rejected.every(x => x.reason));
  assert.ok(buildBlockRecipe(r.champions.at(-1).recipe, { rules: '94x' }).verification.ok);
});

test('bodies alone reproduce the library Dwarf, Silk and Vampire exactly', () => {
  const settings = recipeSettings('94nop'), library = f => compiled(fs.readFileSync(f, 'utf8'), settings);
  assert.deepEqual(compiled(emitCombo({ ...comboDefaults, BODY: 1 }, settings).source, settings), library('warriors/dwarf.red'));
  assert.deepEqual(compiled(emitCombo({ ...comboDefaults, BODY: 3 }, settings).source, settings), library('warriors/silk.red'));
  assert.deepEqual(compiled(emitCombo({ ...comboDefaults, BODY: 4 }, settings).source, settings), library('warriors/vampire.red'));
});

test('bodies pass their gates alone and side by side', () => {
  const cases = [
    ['94nop', { BODY: 2 }], ['88', { BODY: 2, SN: 7, SK: 3 }], ['94x', { BODY: 4, VSTEP: 2365 }],
    ['94nop', { BODY: 1, PARTNER: 2 }],                       // stone + imp spiral
    ['94nop', { BODY: 4, PARTNER: 2 }],                       // vampire + imp spiral (needs the launcher's jump)
    ['88', { BODY: 4, PARTNER: 1, TSTEP: 4 }],                // vampire + stone in '88
    ['lp', { BODY: 1, PARTNER: 2, SN: 3, SK: 2 }],            // fits LP's eight processes
    ['94nop', { BODY: 3, PARTNER: 2 }],                       // paper + imp spiral
  ];
  for (const [rules, choice] of cases) {
    const b = buildCombo({ ...comboDefaults, ...choice }, { rules });
    assert.ok(b.verification.ok, JSON.stringify(choice));
    if (choice.PARTNER) assert.equal(b.verification.observations.filter(x => x.alone).length, 2, 'each body checked alone');
  }
});

test('bodies that do not fit are refused with the reason', () => {
  const refuse = (rules, choice, reason) => assert.throws(() => buildCombo({ ...comboDefaults, ...choice }, { rules }), reason);
  refuse('94x', { BODY: 0, PARTNER: 2 }, /chain runs alone/);
  refuse('94x', { BODY: 2, PARTNER: 2 }, /same body twice/);
  refuse('88', { BODY: 3 }, /paper needs/);
  refuse('94nop', { BODY: 2, SN: 8, SK: 4 }, /no 8-point spiral/);
  refuse('94nop', { BODY: 2, SN: 13, SK: 3 }, /fewer spiral processes/);
  refuse('lp', { BODY: 3, PARTNER: 1 }, /more processes/);
});

test('repair fits every body pair, keeping the body just chosen', () => {
  for (const rules of ['88', 'lp', '94nop', '94x']) {
    const settings = recipeSettings(rules);
    for (const BODY of [0, 1, 2, 3, 4]) for (const PARTNER of [0, 1, 2, 3, 4]) for (const changed of ['BODY', 'PARTNER']) {
      const P = { ...comboDefaults, BODY, PARTNER, SN: 8, SK: 2, TBOMB: 1 }, Q = comboRepair(P, rules, changed);
      assert.deepEqual(comboMismatches(Q, settings), [], JSON.stringify({ rules, changed, BODY, PARTNER, Q }));
      if (rules === '94nop' && P[changed] && !(changed === 'PARTNER' && !BODY && PARTNER === 3)) assert.equal(Q[changed], P[changed], JSON.stringify({ changed, BODY, PARTNER }));
    }
  }
});

test('the body gate rejects misaimed fangs, broken spirals and a bombed partner', () => {
  const settings = recipeSettings('94nop');
  for (const [choice, from, to] of [
    [{ BODY: 4 }, 'vFang JMP.B vPit, 0', 'vFang JMP.B vPit+1, 0'],                       // fangs lead past the pit
    [{ BODY: 2 }, 'iTab DAT.F #0, #16', 'iTab DAT.F #0, #15'],                          // spiral table off by one
    [{ BODY: 1, PARTNER: 2 }, 'tBomb DAT.F #0, #22', 'tBomb DAT.F #0, #0'],              // stone bombs its partner first
  ]) {
    const b = { ...emitCombo({ ...comboDefaults, ...choice }, settings), settings };
    assert.ok(b.source.includes(from), from); b.source = b.source.replace(from, to);
    b.w = compile(b.source, 'redcode', settings); assert.ok(b.w.ok);
    assert.throws(() => verifyBodies(b), undefined, JSON.stringify(choice));
  }
});

test('block evolution can rank by push-off place beside a partner', async () => {
  const settings = RULESETS['94nop'], c = src => compile(src, 'redcode', settings);
  const opponents = ['MOV.I 0, 1', 'JMP 0', 'SPL 0', 'ADD.AB #4, 3\nMOV.I 2, @2\nJMP -2\nDAT #0, #0'].map((src, i) => ({ name: `o${i}`, group: 'hill', w: c(src) }));
  // A deterministic field: longer programs win more, so places differ.
  const pool = { async match(task) { const n = task.settings.rounds, wins = Math.min(n, Math.floor(task.a.instructions.length / 4) % (n + 1));
    return { w: wins, t: 0, l: n - wins, smooth: 3 * wins }; } };
  const partner = { ...c('MOV.I 0, 1'), name: 'Partner' };
  const r = await evolveBlocks({ pool, opponents, settings, rules: '94nop', families: ['combo'], populationSize: 4, offspring: 4,
    generations: 2, rounds: 2, seed: 5, objective: 'pushoff', partners: [partner], fieldRounds: 2 });
  assert.deepEqual(r.config.partners, ['Partner']);
  assert.ok(r.history.every(g => Array.isArray(g.places) && g.places.length === 2), 'candidate and partner places');
  assert.ok(r.champions.every(x => x.vsAncestors.length === 0), 'champions do not enter push-off fitness');
  await assert.rejects(() => evolveBlocks({ pool, opponents, settings, families: ['combo'], partners: [partner] }), /pushoff/);
});
