// Booted scanners, hill-stone FIT, tail-silk FAN 0, papers beside a bounded
// clear, and one payload booted to two places (boot SHARE 1 + redeploy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, link, shape } from '../tools/algebra/index.js';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const ok = (rules, tree, opts = {}) => {
  const built = buildTree(tree, { rules, length: 100, ...opts });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const refused = (tree, re, rules = '94nop', length = 100) => assert.throws(() => buildTree(tree, { rules, length }), re);
const seq = (...kids) => ({ id: 'seq', kids });
const scan = (UNITS = 6) => ({ id: 'opening-qscan-mul', P: { UNITS, SHARE: 1 } }), burst = { id: 'probe-burst2' };
const fb = (a, b, P = {}) => ({ id: 'fanboot', P: { N: 6, K: 2, HOPA: 3200, HOPB: 1002, ...P }, kids: [a, b] });

test('booted pair scanner: alone, behind a quickscan, with decoys left behind (the Excalibur shape), and in a switch', () => {
  const pw = (P = {}) => ({ id: 'pair-wipe-scanner', P });
  ok('94nop', { id: 'boot', P: { HOP: 4774 }, kids: [pw()] });
  ok('94nop', { id: 'boot', P: { HOP: 4423 }, kids: [pw(), { id: 'decoys-mixed', P: { COUNT: 51 } }] });
  const behind = ok('94nop', seq(scan(), burst, { id: 'boot', P: { HOP: 4774, WIPE: 1 }, kids: [pw()] }), { verification: 'full' });
  ok('94nop', seq(scan(), { id: 'boot', P: { HOP: 4774 }, kids: [pw({ STREAM: 1 })] }));
  ok('94x-hill', { id: 'switch', kids: [{ id: 'boot', P: { HOP: 20000 }, kids: [pw()] }, fb({ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }, { HOPA: 12000, HOPB: 44002 })] }, { length: 200 });
  // Behind the quickscan it protects its own cells: the safety test's bound is its own length (29), not the boot's span from the frame's start.
  const pws = behind.root.kids[2].kids[0], at = (l) => behind.labels[pws.ns + l], w = behind.w.instructions;
  const slt = w.find((x, i) => i > at('hit') && x.op === 'SLT');
  assert.equal(slt.a, 29 + 16 - 2);
  assert.equal(behind.spans[pws.ns].size, 29);
});

test('booted oneshot with its imp behind a quickscan and burst (the King Cobra shape)', () => {
  const built = ok('94nop', seq(scan(6), burst, { id: 'boot', P: { HOP: 6055, WIPE: 1 }, kids: [{ id: 'oneshot-cobra-imp' }] }), { verification: 'full' });
  const c = built.root.kids[2].kids[0], at = (l) => built.labels[c.ns + l];
  // The clear's reset value runs from its pointer cell to its own end, past its own code.
  const sbomb = built.w.instructions[at('sbomb')];
  assert.ok(at('cptr') + sbomb.b >= at('imp') + 1, `reset ${sbomb.b} from ${at('cptr')} stops short of the block's end ${at('imp')}`);
  ok('94nop', seq(scan(1), { id: 'boot', P: { HOP: 6055, WIPE: 1 }, kids: [{ id: 'oneshot-cobra-imp' }] }), { length: 50 });
});

test('trees that built before keep their code (in place, booted alone)', () => {
  const s = recipeSettings('94nop', 100);
  for (const tree of [{ id: 'pair-wipe-scanner' }, seq(scan(), { id: 'pair-wipe-scanner' }), { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'pair-wipe-scanner' }] },
    { id: 'oneshot-cobra-imp' }, seq(scan(), burst, { id: 'oneshot-cobra-imp' })]) {
    const built = link(tree, s);
    // With the block where [0, span) already holds it, the protected bound is span itself.
    assert.match(built.source, /SLT|SNE/);
  }
  const inPlace = link(seq(scan(), { id: 'pair-wipe-scanner' }), s);
  const slt = inPlace.source.split('\n').find((l) => /SLT\.AB #\(/.test(l));
  assert.match(slt, new RegExp(`#\\(${inPlace.total}\\+16-2\\)`));
});

test('hill-stone FIT 1 measures the real warrior: a 77-cell Hullabaloo-shaped tree builds at length 100', () => {
  const hs = (P = {}) => ({ id: 'hill-stone', P: { PROCS: 1, ...P } });
  const tree = (P, U2 = 3, HOPB = 1008) => seq({ id: 'opening-qscan-mul45', P: { UNITS: 6, UNITS2: U2 } }, burst, fb(hs(P), { id: 'loop-paper6', P: { FAN: 0 } }, { HOPB }));
  const built = ok('94nop', tree({ FIT: 1 }), { verification: 'full' });
  assert.equal(built.total, 77);
  refused(tree({}), /gcd\(STEP, core\) = 80 is too small/);                                     // FIT 0: the length limit
  refused(tree({ FIT: 1 }, 4), /the 79-cell warrior and its 2 bomb classes do not fit in gcd\(STEP, core\) = 80/);
  refused(tree({ FIT: 1 }, 3, 1002), /hill-stone writes on cell \d of loop-paper6's copy|loop-paper6's later copies land on cells hill-stone writes/);
  // FIT 0 trees are as before: the default stone at length 50.
  ok('94nop', { id: 'hill-stone' }, { length: 50 });
});

test('tail-silk FAN 0 is a fan-boot member; the FAN 1 form refuses a fan of entrants', () => {
  ok('94nop', fb({ id: 'mod-stone' }, { id: 'tail-silk', P: { FAN: 0 } }, { N: 8, HOPA: 2000, HOPB: 5000 }));
  ok('94nop', fb({ id: 'mod-stone' }, { id: 'tail-silk', P: { FAN: 0 } }, { N: 8, HOPA: 2000, HOPB: 5000 }), { verification: 'full' });
  ok('94nop', fb({ id: 'armadillo-switch', P: { STEP: 3510, HOP: 56, STREAM: 1 } }, { id: 'tail-silk', P: { FAN: 0 } }, { N: 8, K: 1, HOPA: 2000, HOPB: 5000 }));
  refused(fb({ id: 'mod-stone' }, { id: 'tail-silk' }, { N: 8, HOPA: 2000, HOPB: 5000 }), /tail-silk: 64 processes reached the forward stage together, not 8/);
  refused({ id: 'tail-silk', P: { FAN: 0 } }, /tail-silk: 1 process reached the forward stage together, not 8/);
  assert.equal(ok('94nop', { id: 'tail-silk' }).total, 10);                                        // FAN 1: as before
});

test('a paper beside a bounded clear: refused only when its first laps land in the clear\'s window', () => {
  const three = (paper, P) => ({ id: 'fanboot3', P: { ROUTE: 1, HOPA: 3200, HOPB: 2002, HOPC: 4004, ...P }, kids: [{ id: 'run-stone' }, { id: 'gated-dclear' }, paper] });
  ok('94nop', three({ id: 'loop-paper6', P: { FAN: 0 } }, { N: 6 }));
  ok('94nop', three({ id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1512 } }, { N: 8 }));
  // The clear booted just above the paper's first copies (about 6,000): their cells fall in its window below its gate.
  refused(three({ id: 'loop-paper6', P: { FAN: 0 } }, { N: 6, HOPB: 7002, HOPC: 4004 }), /loop-paper6's later copies land on cells gated-dclear writes \(its first laps write 48 cells/);
  // backcopy-paper's descendants drift off any grain: beside run-stone that is a real collision.
  refused(fb({ id: 'run-stone' }, { id: 'backcopy-paper', P: { FAN: 0 } }), /backcopy-paper's later copies land on cells run-stone writes \(its copies fill residues 0 mod 1/);
});

test('one payload booted to two places: boot SHARE 1 and redeploy in a switch, with the instructions it saves', () => {
  const pw = { id: 'pair-wipe-scanner' }, ps = fb({ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }, { HOPA: 12000, HOPB: 44002 });
  for (const sw of ['switch', 'switch-table', 'switch-score']) {
    const two = { id: sw, kids: [{ id: 'boot', P: { HOP: 20000 }, kids: [pw] }, { id: 'boot', P: { HOP: 36000 }, kids: [pw] }, ps] };
    const one = { id: sw, kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 36000 } }, ps] };
    const a = ok('94x-hill', two, { length: 200 }), b = ok('94x-hill', one, { length: 200 });
    assert.equal(a.total - b.total, 29, sw);                     // the scanner's 29 cells: two six-cell launchers either way
  }
  // On the 8,000-cell P-space hill the shared tree fits 100 instructions where two copies do not.
  const shared = { id: 'switch-table', kids: [{ id: 'boot', P: { HOP: 3000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 5200 } }, fb({ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }, { HOPA: 1700, HOPB: 6302 })] };
  ok('pspace', shared, { verification: 'full' });
  refused({ id: 'switch-table', kids: [{ id: 'boot', P: { HOP: 3000 }, kids: [pw] }, { id: 'boot', P: { HOP: 5200 }, kids: [pw] }, shared.kids[2]] }, /needs 121 instructions; budget is 100/, 'pspace');
});

test('redeploy lands where it says, whole, and runs there', () => {
  const s = recipeSettings('pspace', 100), pw = { id: 'pair-wipe-scanner' };
  const tree = { id: 'switch', kids: [{ id: 'boot', P: { HOP: 3000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 5200 } }] };
  const built = buildTree(tree, { rules: 'pspace', length: 100 }), from = built.labels[built.root.kids[0].ns + 'payload'], size = built.spans[built.root.kids[0].kids[0].ns].size;
  // P-space cell 0 says "lost" and the switch's cell says member 0 played: it moves on to the redeploy.
  const vm = new VM(s); vm.load([compile(built.source, 'redcode', s)], { positions: [0], pspaces: [Object.assign(new Array(500).fill(0), { 0: 0 })] });
  // Until the boot's process has jumped into one of the two copies.
  const inCopy = (q) => (q >= from + 3000 && q < from + 3000 + size) || (q >= from + 5200 && q < from + 5200 + size);
  while (!vm.processes(0).some(inCopy) && vm.cycle < 400) vm.step();
  const same = (a, b) => ['op', 'mod', 'aMode', 'a', 'bMode', 'b'].every((k) => a[k] === b[k]);
  const copied = Array.from({ length: size }, (_, k) => same(vm.peek(from + 5200 + k), vm.peek(from + k))).every(Boolean);
  const booted = Array.from({ length: size }, (_, k) => same(vm.peek(from + 3000 + k), vm.peek(from + k))).every(Boolean);
  assert.ok(copied !== booted, 'exactly one deployment ran');
  const at = copied ? from + 5200 : from + 3000;
  assert.ok(vm.processes(0).every((q) => q >= at && q < at + size), `processes ${vm.processes(0)}`);
});

test('shared payloads refuse what cannot work', () => {
  const s = recipeSettings('94x-hill', 200), pw = { id: 'pair-wipe-scanner' };
  const has = (tree, re, settings = s) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'switch', kids: [{ id: 'boot', P: { HOP: 20000 }, kids: [pw] }, { id: 'redeploy' }] }, /nothing provides payload/);
  has({ id: 'switch', kids: [{ id: 'boot', P: { HOP: 3000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 7900 } }] }, /redeploy: HOP lands on the warrior itself/, recipeSettings('pspace', 100));
  // (A combinator payload is allowed since batch 6: test/algebra-batch6.test.js.)
  has({ id: 'switch', kids: [{ id: 'boot', P: { HOP: 20000, SHARE: 1 }, kids: [pw] }, { id: 'redeploy', P: { HOP: 30000, FROM: 2 } }] }, /nothing provides payload2/);
});
