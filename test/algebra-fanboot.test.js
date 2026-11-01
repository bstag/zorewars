// Fan boots (tools/algebra/blocks/fanboot.js).
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTree, treeMismatches, leaves, shape, link, treeSettings } = await import('../tools/algebra/index.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const RULES = ['94nop', '94x'];
const PS = 'fanboot-paper-stone', SI = 'fanboot-stone-imp';
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};

test('fan boots build and pass the gate alone and behind a quickscan and burst', () => {
  for (const rules of RULES) {
    ok({ id: PS }, rules);
    ok({ id: SI }, rules);
    ok(seq({ id: 'opening-qscan-mul' }, { id: 'probe-burst' }, { id: PS }), rules);
    ok(seq({ id: 'opening-qscan-mul' }, { id: SI }), rules);
  }
  // The other fans: 6 processes, 3 stone processes each; 8 into the stone/imp.
  ok({ id: PS, P: { ...leaves[PS].defaults, N: 6, K: 3 } }, '94nop');
  ok({ id: SI, P: { ...leaves[SI].defaults, N: 8 } }, '94nop');
});

// Run a fan boot alone and watch its boot cells directly.
function boot(id, P, rules = '94nop', cycles = 200) {
  const settings = treeSettings(rules, 100), tree = { id, P: { ...leaves[id].defaults, ...P } };
  const r = link(tree, settings), w = compile(r.source, 'redcode', settings);
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  const at = (l) => r.labels[`b0${l}`], core = settings.coreSize, Q = tree.P;
  const sent = {}, targets = {};
  for (let c = 0; c < cycles; c++) {
    const pc = vm.processes(0)[0], ins = vm.peek(pc);
    const route = id === PS
      ? (pc >= at('sv') && pc < at('sv') + Q.K ? 'stone' : pc === at('pv') ? 'paper' : null)
      : (pc === at('sv') && ins.b !== 1 ? 'stone' : pc === at('iv') ? 'pump' : null);
    if (route) {
      const vecCell = id === PS && route === 'stone' ? at('sv') : pc;
      sent[route] = (sent[route] ?? 0) + 1;
      (targets[route] ??= new Set()).add((vecCell + vm.peek(vecCell).a) % core);
    }
    vm.step();
  }
  return { vm, w, at, sent, targets, Q, core };
}

test('fan boot: the copy pointers end on the copies and serve as the launch vectors; k:1 split', () => {
  for (const [N, K] of [[8, 2], [6, 3]]) {
    const { vm, w, at, sent, targets, Q } = boot(PS, { N, K });
    assert.deepEqual(sent, { stone: N * K, paper: N }, `N ${N} K ${K}`);
    assert.deepEqual([...targets.stone], [at('st') + Q.SHOP]);
    assert.deepEqual([...targets.paper], [at('ps') + Q.PHOP]);
    // Each pointer cell: A = the copy (the vector), B = the original body.
    assert.equal(at('sv') + vm.peek(at('sv')).a, at('st') + Q.SHOP);
    assert.equal(at('sv') + vm.peek(at('sv')).b, at('st'));
    assert.equal(at('pv') + vm.peek(at('pv')).b, at('ps'));
    // The paper copy is intact (the stone's copy is already running and changing).
    for (let i = 0; i < 6; i++) assert.deepEqual(vm.peek(at('ps') + Q.PHOP + i).op, w.instructions[at('ps') + i].op);
  }
});

test('fan boot: a DJN counter sends N-1 processes to the stone and one to the pump', () => {
  for (const N of [4, 6, 8]) {
    const { sent, targets, at, Q } = boot(SI, { N });
    assert.deepEqual(sent, { stone: N - 1, pump: 1 }, `N ${N}`);
    assert.deepEqual([...targets.stone], [at('st') + Q.SHOP]);
    assert.deepEqual([...targets.pump], [at('ip') + Q.IHOP]);
  }
});

test('fan boot: the stone switches itself off when its counter runs out, and the pump keeps feeding the spiral', () => {
  const TIME = 100;
  const { vm, at, Q } = boot(SI, { TIME }, '94nop', 12000);
  const st = at('st') + Q.SHOP;
  assert.equal(vm.peek(st + 1).op, 'DAT', 'the loop was bombed');
  assert.equal(vm.writerPc[st + 1], st + 5, 'by the stone\'s own stop line');
  // Only the feeder and the bombed MOV still see processes.
  assert.equal(vm.processes(0).filter((q) => q >= st + 2 && q < st + 7).length, 0);
  const imp = vm.peek(at('ip') + Q.IHOP + 4);
  assert.ok(vm.processes(0).filter((q) => vm.peek(q).op === 'MOV' && vm.peek(q).b === imp.b).length > 20, 'imps');
  ok({ id: SI, P: { ...leaves[SI].defaults, TIME } }, '94nop');
  ok({ id: PS, P: { ...leaves[PS].defaults, TIME } }, '94nop');
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop', 100), sx = recipeSettings('94x', 100);
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  const ps = (P) => ({ id: PS, P: { ...leaves[PS].defaults, ...P } }), si = (P) => ({ id: SI, P: { ...leaves[SI].defaults, ...P } });
  has(ps({ N: 5 }), s94, /4, 6 or 8/);
  has(ps({ N: 4 }), s94, /at least 6/);
  has(ps({ PHOP: 3380 }), s94, /on top of each other/);
  has(si({ IHOP: 3360 + 7 - 5 }), s94, /on top of each other/);
  has(ps({ START: 7999 }), s94, /lands on the stone/);
  has(si({ IPOINTS: 3 }), sx, /no 3-point spiral/);
  has({ id: PS }, recipeSettings('lp', 100), /allows 8/);
  has({ id: SI }, recipeSettings('88', 100), /needs ICWS'94/);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  leaves[nid].watch = (api) => orig.watch(api);
  return { id: nid, ...(P ? { P: { ...orig.defaults, ...P } } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const build = (tree) => buildTree(tree, { rules: '94nop', length: 100 });
  // A stone vector one cell off: the stone processes land beside the copy.
  const off = broken(PS, (l, o, m, a, b) => (l === 'sv' ? [o, m, a.replace('+3368', '+3369'), b] : [o, m, a, b]));
  assert.throws(() => build(off), /not the stone copy|went to the stone/, off.id);
  // A fan of 6 where 8 were promised: each copy line runs 6 times.
  const fan = broken(PS, (l, o, m, a, b) => (l === 'fan' ? [o, m, '2', b] : [o, m, a, b]));
  assert.throws(() => build(fan), /ran 6 times|entered the .* copy before|not the/, fan.id);
  // A counter one too high: every process jumps into the stone and the pump gets none.
  const djn = broken(SI, (l, o, m, a, b) => (l === 'sv' ? [o, m, a, '#7'] : [o, m, a, b]));
  assert.throws(() => build(djn), /went to the (stone|pump)/, djn.id);
  // The stop line bombs the pointer instead of the loop: the stone never switches off.
  const stop = broken(SI, (l, o, m, a, b) => (l === 'stop' ? [o, m, a, a] : [o, m, a, b]), { TIME: 100 });
  assert.throws(() => build(stop), /loop was not bombed/, stop.id);
});
