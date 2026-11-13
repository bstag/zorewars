// Two additions to the fan boots (tools/algebra/link.js, contracts.js):
//  - a member may declare where it writes (`lattice`) and which outside cells
//    it needs (`keeps`); a fan boot refuses a layout that puts a partner there;
//  - fanboot3 ROUTE 1 splits the workers N / 1 / N instead of N-1+MOREA / 1 / 1.
// Trees without a declaring member, and fanboot3 without ROUTE, build as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, link, recipes } from '../tools/algebra/index.js';
import { annotate, iface } from '../tools/algebra/link.js';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const s94 = recipeSettings('94nop', 100);
const fb = (a, b, P = {}) => ({ id: 'fanboot', P: { N: 6, K: 2, ...P }, kids: [a, b] });
const paper = { id: 'loop-paper6', P: { FAN: 0 } }, stone = { id: 'run-stone' };
const build = (tree, length = 100) => buildTree(tree, { rules: '94nop', length });

test('a fan boot accepts a partner off the declared lattice and refuses one on it', () => {
  // The stone is 6 cells, so the paper's copy starts HOPB + 6 - HOPA from the stone's: a multiple of 8 keeps it on residues 0..5.
  for (const HOPB of [1002, 1010, 5002]) assert.equal(build(fb(stone, paper, { HOPA: 3200, HOPB })).verification.ok, true, `HOPB ${HOPB}`);
  for (const HOPB of [1000, 1001, 1003, 1004, 1005, 1006, 1007]) {
    assert.throws(() => build(fb(stone, paper, { HOPA: 3200, HOPB })), /fanboot: run-stone writes on cell \d of loop-paper6's copy \(it declares residues 6,7 mod 8 from its first cell\)/, `HOPB ${HOPB}`);
  }
  // Either order of the members, and the three-member boot, are checked alike.
  assert.throws(() => build(fb({ id: 'paper' }, stone, { K: 1, HOPA: 3200, HOPB: 1000 })), /run-stone writes on cell \d of paper's copy/);
  assert.throws(() => build({ id: 'fanboot3', P: { N: 4, HOPA: 3200, HOPB: 1000, HOPC: 5000 }, kids: [stone, { id: 'mod-stone' }, { id: 'mod-stone' }] }), /fanboot3: run-stone writes on cell/);
  // Only the fan's rounding tail on the lattice is fine: an 8-fan copies 8 cells of a 5-cell paper.
  assert.equal(build(fb(stone, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1368 } }, { N: 8, HOPA: 3200, HOPB: 1002 })).verification.ok, true);
});

test('members that declare nothing are laid out exactly as before', () => {
  // The check adds no instruction and moves nothing: same source with and without a declaring member's neighbour.
  const a = link(fb({ id: 'mod-stone' }, { id: 'paper' }), s94), b = link(fb({ id: 'mod-stone' }, { id: 'paper' }, { HOPA: 2000, HOPB: 5000 }), s94);
  assert.equal(a.source, b.source);
  assert.deepEqual(a.misfits, []);
});

test('the bundled run-stone trees fit 50 instructions with three scan units and satisfy the lattice', () => {
  for (const name of ['run-stone-loop-paper', 'run-stone-stream-paper']) {
    const tree = recipes[name].tree('94nop'), built = build(tree, 50);
    assert.equal(tree.kids[0].P.UNITS, 3, name);
    assert.equal(built.verification.ok, true, name);
    assert.ok(built.total <= 50, `${name}: ${built.total}`);
  }
});

test('a paper declares where its later copies can land, and the fan boot keeps those off the lattice too', () => {
  const at = { HOPA: 3200, HOPB: 1002 }, refused = (tree, re) => assert.throws(() => build(tree), re);
  // loop-paper6: STEP = 8 (mod 16) puts every copy a multiple of 8 on; another residue does not.
  assert.equal(build(fb(stone, paper, at)).verification.ok, true);
  assert.equal(build(fb(stone, { id: 'loop-paper6', P: { FAN: 0, STEP: 3016, DELTA: 5 } }, at)).verification.ok, true);
  refused(fb(stone, { id: 'loop-paper6', P: { FAN: 0, STEP: 2006 } }, at), /loop-paper6's later copies land on cells run-stone writes \(its copies fill residues 0,1 mod 2/);
  // stream-paper3 moves on 3 * PROCS a lap: 18 with six processes (refused), 24 with eight and a STEP that is a multiple of 8.
  refused(fb(stone, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0 } }, at), /stream-paper3's later copies land on cells run-stone writes/);
  assert.equal(build(fb(stone, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1512 } }, { N: 8, ...at })).verification.ok, true);
  refused(fb(stone, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1516 } }, { N: 8, ...at }), /stream-paper3's later copies land on cells run-stone writes/);
  // STEP 1000 stays off the lattice but its copies of copies come home: refused by the paper itself.
  refused(fb(stone, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1000 } }, { N: 8, ...at }), /generation 8 of its copies comes back onto the paper/);
  // backcopy-paper's strips start PROCS - 3 lower each generation: no placement keeps them off.
  refused(fb(stone, { id: 'backcopy-paper', P: { FAN: 0 } }, at), /backcopy-paper's later copies land on cells run-stone writes/);
  // Beside a stone that declares nothing, every paper is accepted as before.
  for (const p of [paper, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0 } }, { id: 'backcopy-paper', P: { FAN: 0 } }]) assert.equal(build(fb({ id: 'mod-stone' }, p)).verification.ok, true, p.id);
});

// Runs a fanboot3 until no process is left in its boot code.
function launch(P, kids) {
  const built = build({ id: 'fanboot3', P, kids });
  const vm = new VM(s94); vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  const first = built.spans[built.root.kids[0].ns].start;
  for (let n = 0; n < 400 && vm.processes(0).some((q) => q < first); n++) vm.step();
  return { built, vm };
}

test('fanboot3 ROUTE 1 sends N / 1 / N; ROUTE 0 is the old code', () => {
  const kids = [stone, { id: 'gated-dclear' }, { id: 'fan-imp-pump', P: { FAN: 0, PROCS: 6 } }], P = { N: 6, HOPA: 3200, HOPB: 5498, HOPC: 1004 };
  // The members count their own entrants: fan-imp-pump needs exactly N, gated-dclear exactly one.
  const routed = build({ id: 'fanboot3', P: { ...P, ROUTE: 1 }, kids });
  assert.equal(routed.verification.ok, true);
  assert.throws(() => build({ id: 'fanboot3', P: { ...P, ROUTE: 0 }, kids }), /fan-imp-pump: 1 process entered together/);
  // The boot's own cells: SPLs into the first and third members, a DJN counter that ends N-1 workers on a DAT, a JMP into the second.
  const at = (l) => routed.labels[routed.root.ns + l], ins = (l, k = 0) => routed.w.instructions[at(l) + k];
  assert.deepEqual([ins('va').op, ins('vc').op, ins('vc', 1).op, ins('vc', 1).b, ins('vb').op, ins('rd').op], ['SPL', 'SPL', 'DJN', 6, 'JMP', 'DAT']);
  // Counted in the core: after the boot, 6 stone entrants have passed the feeder, one process is in the clear, 6 run the paper.
  const { vm, built } = launch({ ...P, ROUTE: 1 }, kids);
  const inCopy = (i, hop) => { const s = built.spans[built.root.kids[i].ns]; return vm.processes(0).filter((q) => q >= s.start + hop && q < s.start + hop + s.size).length; };
  assert.ok(inCopy(0, 3200) >= 6);
  assert.equal(inCopy(1, 5498), 1);
  assert.equal(vm.processes(0).filter((q) => q < built.total).length, 0);       // nothing left in the boot
  // Default routing: ROUTE 0 and no ROUTE at all give the same source, and it has no `sc` cell.
  const old = [stone, { id: 'gated-dclear' }, { id: 'compact-imp-pump' }], Q = { N: 4, HOPA: 3000, HOPB: 5500, HOPC: 4402 };
  const plain = link({ id: 'fanboot3', P: Q, kids: old }, s94), zero = link({ id: 'fanboot3', P: { ...Q, ROUTE: 0 }, kids: old }, s94);
  assert.equal(plain.source, zero.source);
  assert.equal(plain.labels[plain.root.ns + 'rd'], undefined);
  assert.match(plain.source, /va DJN\.B/);
});

test('the contract knows ROUTE: its range and the processes it sends', () => {
  const tree = (P) => ({ id: 'fanboot3', P, kids: [{ id: 'mod-stone' }, { id: 'mod-stone' }, { id: 'mod-stone' }] });
  assert.ok(treeMismatches(tree({ ROUTE: 2 }), s94).some((m) => /ROUTE must be an integer from 0 to 1/.test(m)));
  const procs = (P) => iface(annotate(tree(P)), s94).processes;
  assert.equal(procs({ N: 4, MOREA: 1 }), 4 + 1 + 1);
  assert.equal(procs({ N: 4, MOREA: 0 }), 3 + 1 + 1);
  assert.equal(procs({ N: 4, ROUTE: 1 }), 4 + 1 + 4);
  assert.equal(procs({ N: 6, ROUTE: 1 }), 6 + 1 + 6);
});
