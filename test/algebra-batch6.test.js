// Batch 6: trap-scanner and finisher-overwrite booted behind a quickscan, papers
// declaring their bombs and erased cells, and shared payloads that are whole
// subtrees or more than one per switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, link, shape } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const ok = (rules, tree, opts = {}) => {
  const built = buildTree(tree, { rules, length: 100, ...opts });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const refused = (tree, re, rules = '94nop', length = 100) => assert.throws(() => buildTree(tree, { rules, length }), re);
const seq = (...kids) => ({ id: 'seq', kids });
const scan = { id: 'opening-qscan-mul' }, burst = { id: 'probe-burst2' };

test('trap-scanner booted behind a quickscan protects its own cells; in place and booted alone its code is unchanged', () => {
  const built = ok('94nop', seq(scan, burst, { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'trap-scanner' }] }), { verification: 'full' });
  const t = built.root.kids[2].kids[0], at = (l) => built.labels[t.ns + l];
  // The clear's start: cp points at the block's own end (31 cells on), not at the boot's span from the frame's start.
  assert.equal((built.w.instructions[at('cGo')].a + at('cp')) % 8000, at('sLoop') + 31);
  ok('94nop', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'trap-scanner' }] });
  const s = recipeSettings('94nop', 100), inPlace = link(seq(scan, { id: 'trap-scanner' }), s);
  assert.match(inPlace.source, new RegExp(`MOV\\.AB #\\(${inPlace.total}-`));      // [0, span) as before
});

test('finisher-overwrite booted with its own opening, behind another opening', () => {
  ok('94nop', seq(scan, burst, { id: 'boot', P: { HOP: 3000 }, kids: [seq({ id: 'opening-cmpscan' }, { id: 'finisher-overwrite' })] }), { verification: 'full' });
});

test('papers declare their bombs and erased cells: a partner under them is refused', () => {
  const s = recipeSettings('94nop', 100);
  // Put the stone's copy under the paper's bomb pointer, BPTR (3000) past the paper's first cell.
  const fb = (HOPA, HOPB, paper) => ({ id: 'fanboot', P: { N: 6, K: 1, HOPA, HOPB }, kids: [{ id: 'mod-stone' }, paper] });
  const loop6 = { id: 'loop-paper6', P: { FAN: 0 } };
  const probe = link(fb(2000, 1000, loop6), s), c0 = probe.spans[probe.root.kids[0].ns].start, c1 = probe.spans[probe.root.kids[1].ns].start;
  refused(fb(1000 + c1 - c0 + 3000, 1000, loop6), /loop-paper6 writes on cell \d of mod-stone's copy/);
  ok('94nop', fb(2000, 1000, loop6));
  // stream-paper3: its first lap's copy and erased cells start STEP (1367) past it.
  const stream = { id: 'stream-paper3', P: { FAN: 0, TAIL: 0 } };
  const p2 = link(fb(2000, 1000, stream), s), d0 = p2.spans[p2.root.kids[0].ns].start, d1 = p2.spans[p2.root.kids[1].ns].start;
  refused(fb(1000 + d1 - d0 + 1367 + 10, 1000, stream), /stream-paper3 writes on cell \d of mod-stone's copy/);
  // tail-silk (FAN 0): its carpet, BSTEP (2376) past its carpet line.
  const tail = { id: 'tail-silk', P: { FAN: 0 } }, fb8 = (HOPA, HOPB) => ({ id: 'fanboot', P: { N: 8, K: 1, HOPA, HOPB }, kids: [{ id: 'mod-stone' }, tail] });
  const p3 = link(fb8(2000, 5000), s), e0 = p3.spans[p3.root.kids[0].ns].start, carpet = p3.labels[p3.root.kids[1].ns + 'tCarpet'];
  refused(fb8(5000 + carpet - e0 + 2376 + 2, 5000), /tail-silk writes on cell \d of mod-stone's copy/);
  ok('94nop', fb8(2000, 5000));
});

test('a shared payload can be a whole subtree, and a switch can share up to four', () => {
  const fb = { id: 'fanboot', P: { N: 6, K: 2, HOPA: 12000, HOPB: 44002 }, kids: [{ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }] };
  const pw = { id: 'pair-wipe-scanner' };
  const compass = seq({ id: 'opening-cmpscan', P: { SSTEP: 4001, GAP: 5, START: 700, SCANS: 40 } }, { id: 'finisher-guarded', P: { PHASE: 1, STUN: 100 } });
  const two = ok('94x-hill', { id: 'switch-table', kids: [{ id: 'boot', P: { HOP: 20000 }, kids: [compass] }, { id: 'boot', P: { HOP: 36000 }, kids: [compass] }, fb] }, { length: 200 });
  const one = ok('94x-hill', { id: 'switch-table', kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 1 }, kids: [compass] }, { id: 'redeploy', P: { HOP: 36000 } }, fb] }, { length: 200, verification: 'full' });
  assert.equal(two.total - one.total, 26);
  // Two payloads in one switch: SHARE 1 and SHARE 2, each reached a second time by its redeploy.
  const both = { id: 'switch-score', kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 36000 } },
    { id: 'boot', P: { HOP: 26000, SHARE: 2 }, kids: [compass] }, { id: 'redeploy', P: { HOP: 40000, FROM: 2 } }, fb] };
  assert.equal(ok('94x-hill', both, { length: 200 }).total, 166);
  refused({ id: 'switch-score', kids: [{ id: 'boot', P: { HOP: 20000 }, kids: [pw] }, { id: 'boot', P: { HOP: 36000 }, kids: [pw] }, { id: 'boot', P: { HOP: 26000 }, kids: [compass] }, { id: 'boot', P: { HOP: 40000 }, kids: [compass] }, fb] },
    /needs 221 instructions; budget is 200/, '94x-hill', 200);
});

test('shared payload numbers are checked', () => {
  const s = recipeSettings('94x-hill', 200), pw = { id: 'pair-wipe-scanner' };
  const has = (tree, re) => assert.ok(treeMismatches(tree, s).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, s)));
  has({ id: 'switch-score', kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 1 }, kids: [pw] }, { id: 'boot', P: { HOP: 26000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 40000 } }] },
    /two boots share their payload as SHARE 1/);
  has({ id: 'switch-score', kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 40000, FROM: 3 } }] }, /nothing provides payload3/);
  has({ id: 'switch', kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 5 }, kids: [pw] }, { id: 'redeploy' }] }, /SHARE must be an integer from 0 to 4/);
});
