import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool, libraryOpponents } from '../tools/hill.js';
import { treeSettings } from '../tools/algebra/index.js';
import { evolveTrees } from '../tools/algebra/evolve.js';
import { opponentTags, verifiedTags, diagnose, describeChange, weakestTag, CounterTable, summarizeCounters } from '../tools/algebra/counters.js';

test('opponents are tagged by strategy, name or category', () => {
  assert.deepEqual(opponentTags({ name: 'X', strategy: 'qscan > boot > LP paper' }), ['paper', 'scanner']);
  assert.deepEqual(opponentTags({ name: 'Core Sweep', strategy: '' }), ['clear']);
  assert.deepEqual(opponentTags({ name: 'Q', category: 'Stone' }), ['stone']);
  assert.deepEqual(opponentTags({ name: 'champion 3', group: 'champion' }), ['champion']);
  assert.deepEqual(opponentTags({ name: 'Zork' }), ['unknown']);
});

test('behaviour decides the class; a claim only narrows it', () => {
  const paper = { processes: 2600, coverage: 5000 }, oneshot = { processes: 394, coverage: 33 }, lean = { processes: 1, coverage: 40 };
  assert.deepEqual(verifiedTags(paper, ['scanner']), ['paper']);              // claims scanner, spreads like paper
  assert.deepEqual(verifiedTags(paper, ['paper', 'stone']), ['paper', 'stone']);
  assert.deepEqual(verifiedTags(oneshot, ['paper']), ['clear']);              // claims paper, stays put
  assert.deepEqual(verifiedTags(oneshot, ['scanner', 'clear']), ['scanner', 'clear']);
  assert.deepEqual(verifiedTags(lean, ['unknown']), ['scanner-or-stone']);
});

test('changes are named by the blocks they add, remove, replace or tune', () => {
  const stone = { id: 'mod-stone', P: { STEP: 2936 } }, paper = { id: 'paper', P: { PSTEP: 1777 } };
  assert.equal(describeChange(paper, { id: 'par', kids: [paper, { id: 'imp' }] }), '+imp,+par');
  assert.equal(describeChange({ id: 'par', kids: [paper, stone] }, { id: 'par', kids: [{ id: 'silk3' }, stone] }), 'paper>silk3');
  assert.equal(describeChange(stone, { id: 'mod-stone', P: { STEP: 3044 } }), 'tune mod-stone.STEP');
});

test('the counter table averages a change\'s effect by opponent tag', () => {
  const field = [{ name: 'a', strategy: 'paper' }, { name: 'b', strategy: 'core clear' }];
  const rows = (pa, pb) => [{ name: 'a', pts: pa, w: 0, l: 0, t: 0 }, { name: 'b', pts: pb, w: 0, l: 0, t: 0 }];
  const t = new CounterTable();
  for (let i = 0; i < 6; i++) t.record('+imp', rows(1, 0), rows(1, 1 + (i % 2) * 0.2), field);
  const best = t.best('clear', { min: 5 });
  assert.equal(best[0].change, '+imp');
  assert.ok(Math.abs(best[0].mean - 1.1) < 1e-9 && best[0].n === 6);
  assert.equal(t.best('paper')[0].mean, 0);
  assert.ok(summarizeCounters(t).some((l) => l.startsWith('clear: +imp +1.10')));
  // Saved and loaded, it carries on counting runs.
  assert.equal(new CounterTable(JSON.parse(JSON.stringify(t))).runs, 2);
  const dx = diagnose(rows(3, 0).map((r, i) => ({ ...r, w: i ? 0 : 5, l: i ? 5 : 0 })), field);
  assert.equal(dx.clear.l, 5);
  assert.equal(dx.paper.pts, 3);
});

test('weakestTag picks the worst real type, and score favours the unknown then the proven', () => {
  const dx = { paper: { pts: 1.5 }, clear: { pts: 2.8 }, unknown: { pts: 0.2 }, champion: { pts: 1 } };
  assert.equal(weakestTag(dx), 'paper');                         // unknown and champion are ignored
  assert.equal(weakestTag({ scanner: { pts: 2.9 } }), null);     // nothing weak enough to aim at
  const t = new CounterTable();
  const field = [{ name: 'a', strategy: 'paper' }];
  for (let i = 0; i < 6; i++) t.record('+stone', [{ name: 'a', pts: 1, w: 0, l: 0, t: 0 }], [{ name: 'a', pts: 2, w: 0, l: 0, t: 0 }], field);
  assert.equal(t.predict('+stone', 'paper').n, 6);
  assert.ok(t.score('+stone', 'paper') > t.score('+decoys', 'paper'));   // proven winner beats an unseen change
  assert.ok(t.score('+anything-new', 'paper', 0.3) > 0);                 // but the unseen still gets a turn
});

test('tree evolution records every mutation against its parent and diagnoses champions', async () => {
  const settings = treeSettings('94nop', 100);
  const field = libraryOpponents(settings).filter((o) => ['Dwarf', 'Silk', 'Seeker'].includes(o.name));
  const pool = createPool(2);
  try {
    const counters = new CounterTable();
    const stone = { id: 'mod-stone', P: { STEP: 2936, BOMBS: 1, GUARD: 1 } };
    const r = await evolveTrees({ pool, field, starts: [stone], generations: 1, batch: 6, rounds: 2, race: 0, seed: 3, crossRate: 0, randomRate: 0, counters });
    assert.ok(r.stats.experiments > 0);
    assert.ok(Object.values(counters.changes).every((c) => c.n > 0 && c.tags.all));
    assert.ok(r.history[0].champion.diagnosis);
  } finally { pool.close(); }
});
