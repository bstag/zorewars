// Silk tails and the LP paper (tools/algebra/blocks/silktails.js): each builds
// and passes the gate with its defaults on every rule set it supports, alone and
// combined; the mechanism is checked cell by cell in a solo run; bad settings
// are refused; and a broken copy is caught.
const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { buildTree, treeMismatches, leaves, shape, link } = await import('../tools/algebra/index.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');
const { modInverse } = await import('../tools/algebra/util.js');

const SILK = ['94nop', '94x'], LP = ['94nop', 'lp', '94x'];
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};
const has = (tree, rules, re) => {
  const m = treeMismatches(tree, recipeSettings(rules, 100));
  assert.ok(m.some((x) => re.test(x)), `${shape(tree)} on ${rules}: ${JSON.stringify(m)}`);
};
// A solo VM of a tree, loaded at 0, and the address of a block label in it.
function solo(tree, rules) {
  const settings = recipeSettings(rules, 100), linked = link(tree, settings);
  const w = compile(linked.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  const at = (l) => linked.labels[`b0${l}`];
  return { vm, w, at, core: settings.coreSize };
}
const mod = (x, core) => ((x % core) + core) % core;

test('the blocks load with working defaults on every rule set they support', () => {
  for (const id of ['silk-imps', 'silk-cc', 'lp-paper', 'tail-silk']) assert.equal(typeof leaves[id]?.watch, 'function', id);
  for (const rules of SILK) for (const id of ['silk-imps', 'silk-cc', 'tail-silk']) ok({ id }, rules);
  for (const rules of LP) ok({ id: 'lp-paper' }, rules);
  ok({ id: 'tail-silk', P: { MOVE: 1 } }, '94nop');
});

test('they combine with an opening and a partner', () => {
  ok({ id: 'seq', kids: [{ id: 'opening-quickscan' }, { id: 'silk-imps' }] }, '94nop');
  ok({ id: 'par', kids: [{ id: 'stone' }, { id: 'silk-cc' }] }, '94nop');
  ok({ id: 'par', kids: [{ id: 'stone' }, { id: 'lp-paper' }] }, 'lp');
  ok({ id: 'seq', kids: [{ id: 'opening-quickscan' }, { id: 'lp-paper' }] }, 'lp');
});

test('silk-imps writes its imp just before the next copy\'s imp, and the imps crawl', () => {
  for (const [rules, points] of [['94nop', 3], ['94x', 23]]) {
    const { vm, w, at, core } = solo({ id: 'silk-imps' }, rules);
    const S = modInverse(points, core), imp = w.instructions[at('siImp')];
    assert.equal(mod(imp.b, core), S, `${rules}: a ${points}-point imp`);
    vm.run(300);
    const copyImp = mod(at('siLast') + S + 1 + 2, core);       // the last stage's copy: SPL, MOV, imp
    for (const c of [mod(at('siImp') + S, core), copyImp]) assert.equal(vm.peek(c).op, 'MOV', `${rules}: no imp at ${c}`);
    assert.equal(mod(copyImp - 1, core), mod(at('siImp') + S, core));
    while (vm.cycle < 20000) vm.step();
    const isImp = (q) => vm.peek(q).op === 'MOV' && vm.peek(q).aMode === '#' && mod(vm.peek(q).b, core) === S;
    const on = vm.processes(0).filter(isImp), chained = on.filter((q) => isImp(q + 1));
    assert.ok(on.length > 300 && chained.length > on.length / 3, `${rules}: ${chained.length} of ${on.length}`);
  }
});

test('silk-cc sweeps COUNT - 1 cells back toward itself, then stops and frees its processes', () => {
  const { vm, at, core } = solo({ id: 'silk-cc', P: { STAGES: 3, STEP1: 3039, STEP2: 1607, STEP3: 5113, COUNT: 20 } }, '94nop');
  const movAt = at('ccMov'), jmp = at('ccJmp'), swept = new Set();
  // Step until the clear overwrites its own JMP, noting every cell it writes.
  while (vm.cycle < 10000 && !(vm.peek(jmp).op === 'MOV' && vm.writerPc[jmp] === movAt)) {
    const pc = vm.processes(0)[0];
    vm.step();
    if (pc === movAt) for (let k = 1; k < 40; k++) if (vm.writerPc[jmp + k] === movAt) swept.add(k);
  }
  assert.equal(vm.peek(jmp).op, 'MOV', 'the clear never reached its JMP');
  assert.deepEqual([...swept].sort((x, y) => x - y), Array.from({ length: 19 }, (_, k) => k + 1), 'the clear covers exactly the 19 cells after the JMP');
  // Every process of the original then runs off its end within a few turns each.
  const before = vm.processes(0).length;
  vm.run(Math.min(before * 6, 20000));
  assert.ok(!vm.processes(0).some((q) => mod(q - at('ccMov'), core) <= 2), 'processes still run the finished clear');
});

test('lp-paper bombs along its doubling walk and keeps growing', () => {
  for (const rules of ['lp', '94x']) {
    const { vm, at, core } = solo({ id: 'lp-paper' }, rules);
    const P = leaves['lp-paper'].defaults, ptr = at('lPtr');
    let a = P.A0, b = P.B0;
    for (let lap = 0; lap < 12; lap++) {
      while (vm.processes(0)[0] !== at('lBombMov')) vm.step();
      vm.step();
      assert.equal(vm.peek(ptr + a).op, 'DAT', `${rules} lap ${lap}: no bomb at ${a}`);
      a = mod(2 * (a + 1), core); b = mod(2 * b, core);
      vm.step();
      assert.deepEqual([mod(vm.peek(ptr).a, core), mod(vm.peek(ptr).b, core)], [a, b], `${rules} lap ${lap}`);
    }
    while (vm.cycle < 20000) vm.step();
    assert.ok(vm.processes(0).length >= (rules === 'lp' ? 6 : 10), `${rules}: ${vm.processes(0).length} processes`);
  }
});

test('tail-silk\'s backward and moving stages each copy the whole body', () => {
  const P = leaves['tail-silk'].defaults;
  const { vm, w, at, core } = solo({ id: 'tail-silk', P: { ...P, MOVE: 1 } }, '94nop');
  const n = 16, len = 9, copy = mod(at('t1') + P.STEP2 - n, core), moved = mod(at('tMv') + P.STEP3 - n, core);
  vm.run(1000);
  for (const start of [copy, moved]) {
    assert.equal(vm.peek(start).op, 'SPL');
    for (const k of [1, 2, 4, 5, 8]) assert.equal(vm.peek(start + k).op, w.instructions[at('t0') + k].op, `copy at ${start}, cell ${k}`);
  }
  // The anti-imp bomb: its operands are the other two points of a ring through it.
  const S = modInverse(3, core), bomb = w.instructions[at('tBomb')];
  assert.deepEqual([bomb.aMode, mod(bomb.a, core), bomb.bMode, mod(bomb.b, core)], ['<', S, '<', mod(2 * S, core)]);
});

test('bad settings are refused', () => {
  has({ id: 'silk-imps', P: { STAGES: 2, STEP1: 3039, STEP2: 1607, STEP3: 5113, POINTS: 5 } }, '94nop', /no 5-point imp/);
  has({ id: 'silk-imps', P: { STAGES: 2, STEP1: 3039, STEP2: 1607, STEP3: 5113, POINTS: 3 } }, '94x', /no 3-point imp/);
  has({ id: 'silk-imps' }, 'lp', /room to grow/);
  has({ id: 'silk-imps' }, '88', /ICWS'94/);
  has({ id: 'silk-imps', P: { STAGES: 2, STEP1: 8000, STEP2: 1607, STEP3: 5113, POINTS: 0 } }, '94nop', /stage 1 copies onto itself/);
  has({ id: 'silk-cc', P: { STAGES: 3, STEP1: 300, STEP2: 1607, STEP3: 5113, COUNT: 500 } }, '94nop', /sweeps over stage 1's copy/);
  has({ id: 'silk-cc', P: { STAGES: 3, STEP1: 3039, STEP2: 1607, STEP3: 5113, COUNT: 4000 } }, '94nop', /sweeps over stage 1's copy/);
  has({ id: 'lp-paper', P: { D: 4829, CSTEP: 2580, A0: 1211, B0: 1950, EXTRA: 6 } }, '94nop', /bomb walk comes within/);
  has({ id: 'lp-paper', P: { D: 4829, CSTEP: 2580, A0: 2973, B0: 8000, EXTRA: 6 } }, '94nop', /scatter comes within/);
  has({ id: 'lp-paper', P: { D: 8000, CSTEP: 2580, A0: 2973, B0: 1950, EXTRA: 6 } }, 'lp', /copy 1 lands on the paper/);
  has({ id: 'tail-silk', P: { STEP1: 3039, STEP2: 1607, STEP3: 5113, BSTEP: 7998, BACK: 1, MOVE: 0, POINTS: 0 } }, '94nop', /carpet lands on the paper/);
  has({ id: 'tail-silk', P: { STEP1: 3039, STEP2: 8000 + 8, STEP3: 5113, BSTEP: 2376, BACK: 1, MOVE: 0, POINTS: 0 } }, '94nop', /backward stage copies onto the paper/);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  leaves[nid].watch = (api) => orig.watch({ ...api, scenario: api.scenario.replace(nid, id) });
  return { id: nid, ...(P ? { P } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const build = (tree, rules = '94nop') => () => buildTree(tree, { rules, length: 100 });
  // silk-imps: the imp steps one cell short, so it misses the copy.
  const si = broken('silk-imps', (l, o, m, a, b) => (l === 'siImp' ? [o, m, a, `${+b - 1}`] : [o, m, a, b]));
  assert.throws(build(si), /did not write itself IMPSTEP on/);
  // silk-cc: the counter starts past COUNT, so the clear reaches too far.
  const cc = broken('silk-cc', (l, o, m, a, b) => (l === 'ccJmp' ? [o, m, a, '#600'] : [o, m, a, b]));
  assert.throws(build(cc), /past COUNT - 1/);
  // lp-paper: only the A field doubles.
  const lp = broken('lp-paper', (l, o, m, a, b) => (l === 'lDouble' ? [o, 'A', a, b] : [o, m, a, b]));
  assert.throws(build(lp, 'lp'), /did not double/);
  // tail-silk: the backward stage reads the wrong source pointer, so its copy is not the body.
  const ts = broken('tail-silk', (l, o, m, a, b) => (o === 'MOV' && a.startsWith('<') && b.startsWith('{') && !a.includes('tMv') ? [o, m, a.replace('t0', 't1'), b] : [o, m, a, b]));
  assert.throws(build(ts), /backward stage made an incomplete copy/);
  // tail-silk: the moving stage jumps one cell past its copy.
  const tm = broken('tail-silk', (l, o, m, a, b) => (l === 'tMv' ? [o, m, `${+a + 1}`, b] : [o, m, a, b]), { ...leaves['tail-silk'].defaults, MOVE: 1 });
  assert.throws(build(tm), /moving stage/);
});
