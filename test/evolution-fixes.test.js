import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, RULESETS } from '../src/engine/index.js';
import { treeSettings, id } from '../tools/algebra/index.js';
import { evolveTrees } from '../tools/evolution/trees/search.js';
import { evolveParameters } from '../tools/evolution/parameters.js';
import { evolveBlocks } from '../tools/evolution/blocks.js';
import { defaultBlockRecipes } from '../tools/blocks/registry.js';

const stone = { id: 'mod-stone', P: { STEP: 2936, BOMBS: 1, GUARD: 1 } };
const paper = { id: 'par', kids: [{ id: 'paper', P: { PSTEP: 1777, PDELTA: 1013 } }, stone] };
const settings = treeSettings('94nop', 100);
const field = [{ name: 'Imp', w: compile('MOV.I 0, 1', 'redcode', settings) }];

test('tree lexicase selects using the configured tie reward', async () => {
  const identities = new Map(), selectedParents = [];
  const pool = { async match(task) {
    const key = JSON.stringify(task.a.instructions);
    if (!identities.has(key)) identities.set(key, identities.size + 1);
    const n = task.settings.rounds, kind = identities.get(key);
    const w = kind === 1 ? n / 4 : 0, t = kind === 2 ? n : 0;
    return { w, l: n - w - t, t, smooth: 3 * w + t };
  } };
  await evolveTrees({ pool, field, starts: [stone, paper], generations: 1, batch: 1,
    rounds: 4, race: 0, seed: 5, ties: 0, lexicase: true, lexEpsilon: 0,
    ops: ['tune'], randomRate: 0, crossRate: 0, aim: false,
    counters: { record(change, rows) { selectedParents.push(rows[0]); } } });
  assert.ok(selectedParents.length > 0);
  assert.equal(selectedParents[0].w, 1, 'select the winning parent rather than the pure tier');
  assert.equal(selectedParents[0].t, 0);
});

test('tree search exposes the finals winner even when it screened outside the top three', async () => {
  const identities = new Map();
  const pool = { async match(task) {
    const key = JSON.stringify(task.a.instructions);
    if (!identities.has(key)) identities.set(key, identities.size + 1);
    const n = task.settings.rounds, index = identities.get(key);
    const w = n > 100 ? n - index : index;
    return { w, l: n - w, t: 0, smooth: 3 * w };
  } };
  const r = await evolveTrees({ pool, field, starts: [stone, paper], generations: 1,
    batch: 1, rounds: 100, race: 0, seed: 5 });
  const champion = r.history[0].champion;
  assert.ok(r.archive.findIndex(e => id(e.tree) === id(champion.tree)) >= 3, 'fixture must reverse screening order');
  assert.ok(r.finalists?.length > 0);
  assert.equal(id(r.finalists?.[0]?.tree), id(champion.tree));
  assert.equal(r.finalists[0].fit, champion.fit);
  assert.ok(r.finalists[0].source && r.finalists[0].w.instructions.length > 0);
});

test('tree search rejects invalid lexicase epsilon before any matches', async () => {
  let matches = 0;
  const pool = { match() { matches++; throw new Error('must reject before evaluation'); } };
  for (const lexEpsilon of [-0.1, NaN, Infinity]) {
    await assert.rejects(evolveTrees({ pool, field, starts: [stone], generations: 0,
      batch: 1, ops: ['tune'], lexEpsilon }), /epsilon/i);
  }
  assert.equal(matches, 0);
});

test('parameter search builds each rejected genotype only once', async () => {
  let rejectedBuilds = 0;
  const r = await evolveParameters({ space: { X: [0, 1] }, current: { X: 0 },
    populationSize: 2, offspring: 1, generations: 1, seed: 4242,
    build(P) {
      if (P.X) { rejectedBuilds++; throw new Error('deterministic gate failure'); }
      return { w: { ok: true }, verification: { ok: true } };
    },
    evaluate: async () => ({ fit: 1, cases: [1] }),
  });
  assert.equal(rejectedBuilds, 1);
  assert.equal(r.stats.rejected, 1);
  assert.equal(r.rejected.length, 1);
  assert.ok(r.stats.duplicates > 0 && r.candidates.every(Boolean));
});

test('recipe search caches repeated rejected initial recipes', async () => {
  const settings = RULESETS['94x'];
  const recipe = defaultBlockRecipes(['compass'])[0];
  const invalid = { ...recipe, P: { ...recipe.P, STEP: -1 } };
  const pool = { async match({ settings: { rounds: n } }) { return { w: 0, l: 0, t: n, smooth: n }; } };
  const r = await evolveBlocks({ pool, settings,
    opponents: [{ name: 'Imp', w: compile('MOV.I 0, 1', 'redcode', settings) }],
    families: ['compass'], initial: [invalid, invalid], populationSize: 1,
    offspring: 1, generations: 1, rounds: 1, seed: 3 });
  assert.equal(r.rejected.filter(x => x.recipe.P.STEP === -1).length, 1);
  assert.ok(r.stats.duplicates > 0 && r.candidates.every(Boolean));
});
