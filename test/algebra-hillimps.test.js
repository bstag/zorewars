// Tests for the hill imp blocks (tools/algebra/blocks/hillimps.js): knight-pump,
// capped-pump, moving-imp-silk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';
import { modInverse } from '../tools/algebra/util.js';

const IDS = ['knight-pump', 'capped-pump', 'moving-imp-silk'];
const RULES = ['94nop', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};
// Run a block alone; `at(label)` is a label's address (the block is loaded at 0).
function solo(id, P = {}, rules = '94nop') {
  const settings = treeSettings(rules, 100), Q = { ...leaves[id].defaults, ...P };
  const r = link({ id, P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  return { vm, at: (l) => r.labels[`b0${l}`], P: Q, core: settings.coreSize };
}

test('the blocks load with a watch', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
  }
});

test('every block builds alone and behind a quickscan on 94nop and 94x', () => {
  for (const rules of RULES) for (const id of IDS) {
    ok({ id }, rules);
    if (rules === '94nop') ok(seq({ id: 'opening-qscan-mul' }, { id }), rules);
  }
  ok({ id: 'boot', kids: [{ id: 'knight-pump' }] }, '94nop');
  ok({ id: 'capped-pump', P: { ...leaves['capped-pump'].defaults, CAP: 100, POINTS: 13 } }, '94nop');
});

// knight-pump, directly: every pass launches one imp, c * (STEP + 1) past the
// imp, and the spare process then jumps into the stone, so the stone ends with
// about as many processes as there are imps, and the imps stand STEP apart.
test('knight-pump: each launch feeds the spiral and sends its spare process to the stone', () => {
  const { vm, at, core } = solo('knight-pump');
  const S = modInverse(3, core), D = S + 1, stone = [at('sMov'), at('sAdd'), at('sJmp')];
  let launches = 0, joins = 0;
  while (vm.cycle < 30000) {
    const pc = vm.processes(0)[0];
    if (pc === at('pL')) {
      assert.equal((pc + vm.peek(pc).a) % core, (at('pImp') + launches * D) % core, `launch ${launches}`);
      launches++;
    }
    if (pc === at('pJoin')) joins++;
    vm.step();
  }
  assert.ok(launches > 100, `${launches} launches`);
  assert.ok(Math.abs(launches - joins) <= 1, `${joins} joins for ${launches} launches`);
  const procs = vm.processes(0), imp = vm.peek(at('pImp'));
  const imps = procs.filter((q) => { const x = vm.peek(q); return x.op === 'MOV' && x.b === imp.b && x.aMode === '#'; });
  const inStone = procs.filter((q) => stone.includes(q)).length;
  assert.ok(imps.length > launches * 0.8, `${imps.length} imps of ${launches}`);
  assert.ok(inStone > launches * 0.8, `${inStone} stone processes for ${launches} launches`);
  // In queue order the imps stand STEP apart (one break per arm turnover at most).
  let apart = 0;
  for (let i = 1; i < imps.length; i++) if ((imps[i] - imps[i - 1] + core) % core === S) apart++;
  assert.ok(apart > imps.length * 0.9, `${apart} of ${imps.length} imps are STEP after the one before`);
});

// capped-pump, directly: the pump's feeder is bombed by the stone exactly when
// its pointer has moved on CAP times, and no imp is launched after that but
// the ones already on their way.
test('capped-pump: the stone bombs the pump feeder on lattice bomb CAP, then the imp count stops growing', () => {
  for (const CAP of [100, 300]) {
    const { vm, at } = solo('capped-pump', { CAP });
    let adds = 0, capAt = null, after = 0, launched = 0;
    while (vm.cycle < 30000) {
      const pc = vm.processes(0)[0];
      if (pc === at('sAdd')) adds++;
      if (pc === at('pL')) { launched++; if (capAt !== null) after++; }
      vm.step();
      if (capAt === null && vm.peek(at('pFeed')).op === 'DAT') {
        assert.equal(vm.writerPc[at('pFeed')], at('sMov'), 'bombed by the stone');
        assert.equal(adds, CAP, `the pointer had moved on ${adds} times`);
        capAt = vm.cycle;
      }
    }
    assert.ok(capAt !== null, 'the pump was never capped');
    assert.ok(after <= 4, `${after} launches after the cap`);
    assert.ok(launched >= 12, `only ${launched} imps before the cap`);
    assert.ok(!vm.processes(0).includes(at('pFeed')), 'nothing runs on the pump feeder');
  }
});

// moving-imp-silk, directly: the first write lands LEAD on and overwrites its
// pointer cell (A = HOP - LEAD); the next write through that cell lands HOP on
// and steps its A field. By the end most processes crawl along strips of it.
test('moving-imp-silk: the moving imp fans its copies out and the processes crawl on them', () => {
  const { vm, at, P, core } = solo('moving-imp-silk');
  const imp = at('miImp'), c = (imp + P.LEAD) % core, HOP = core / 2 + P.HALF;
  const T = (x) => x.op === 'MOV' && x.aMode === '#' && x.bMode === '}' && x.b === P.LEAD;
  let seen = 0;
  while (seen < 2 && vm.cycle < 2000) {
    const pc = vm.processes(0)[0];
    const hit = pc === imp;
    vm.step();
    if (!hit) continue;
    seen++;
    if (seen === 1) {
      assert.ok(T(vm.peek(c)), 'first write lands LEAD on');
      assert.equal(vm.peek(c).a, HOP - P.LEAD);
    } else {
      assert.ok(T(vm.peek((imp + HOP) % core)), 'second write lands HOP on');
      assert.equal(vm.peek(c).a, HOP - P.LEAD + 1, 'and steps the A field it read');
    }
  }
  assert.equal(seen, 2);
  while (vm.cycle < 60000) vm.step();
  const procs = vm.processes(0), on = procs.filter((q) => T(vm.peek(q)));
  const crawl = on.filter((q) => T(vm.peek((q + 1) % core))).length;
  assert.ok(on.length > procs.length / 2, `${on.length} of ${procs.length} on the moving imp`);
  assert.ok(crawl > on.length * 0.8, `${crawl} of ${on.length} crawl`);
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop', 100), sx = recipeSettings('94x', 100);
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  const P = (id, Q) => ({ id, P: { ...leaves[id].defaults, ...Q } });
  has(P('knight-pump', { STEP: 3045 }), s94, /multiple of 4/);
  has(P('capped-pump', { STEP: 4000 }), s94, /reaches only/);
  has(P('capped-pump', { CAP: 600, STEP: 3056 }), s94, /past the first lap/);        // gcd 16: a 500-bomb lap
  has(P('knight-pump', { POINTS: 3 }), sx, /no 3-point imp spiral/);
  for (const id of IDS) {
    has({ id }, recipeSettings('lp', 100), /hundreds of processes|room to grow/);
    has({ id }, recipeSettings('88', 100), /need ICWS'94/);
  }
  has(P('moving-imp-silk', { STEP1: 7999 }), s94, /forward stage copies onto the paper/);
  has(P('moving-imp-silk', { HALF: 0 }), s94, /HALF 0/);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.running) leaves[nid].running = orig.running;
  return { id: nid, ...(P ? { P: { ...orig.defaults, ...P } } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const build = (tree) => buildTree(tree, { rules: '94nop', length: 100 });
  // knight-pump: the spare jumps one cell into the loop, past the bombing MOV.
  const skip = broken('knight-pump', (l, o, m, a, b) => (l === 'pJoin' ? [o, m, a.replace('sMov', 'sAdd'), b] : [o, m, a, b]));
  assert.throws(() => build(skip), /did not join the stone/, skip.id);
  // knight-pump: the launch steps by STEP, not STEP + 1, so it is off the spiral.
  const step = broken('knight-pump', (l, o, m, a, b) => (l === 'pStep' ? [o, m, '#2667', b] : [o, m, a, b]));
  assert.throws(() => build(step), /launch [0-9]+ went to/, step.id);
  // capped-pump: the stone's pointer starts one lattice step on, so a different bomb hits the pump.
  const late = broken('capped-pump', (l, o, m, a, b) => (l === 'sJmp' ? [o, m, a, `${(Number(b) + 3044) % 8000}`] : [o, m, a, b]));
  assert.throws(() => build(late), /lattice bomb 299, not 300/, late.id);
  // moving-imp-silk: the moving imp writes through a plain B pointer, so it never moves on.
  const still = broken('moving-imp-silk', (l, o, m, a, b) => (l === 'miImp' ? [o, m, a, b.replace('}', '$')] : [o, m, a, b]));
  assert.throws(() => build(still), /did not copy itself/, still.id);
});
