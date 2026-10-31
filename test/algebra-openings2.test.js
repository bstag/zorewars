// Blocks for hill gaps 2, 10 and 11 (docs/hill-recipe-book.md): the two-stream
// burst, boot hygiene and stronger decoys.
const test = (await import('node:test')).default;
const assert = (await import('node:assert/strict')).default;
const { buildTree, treeMismatches, leaves, shape } = await import('../tools/algebra/index.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const ALL = ['88', '94nop', 'lp', '94x'], NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};
const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));

const qmul = { id: 'opening-qscan-mul' }, qdec = { id: 'opening-qscan-decode' }, lattice = { id: 'opening-qscan-lattice' };
const stone = { id: 'mod-stone' }, guarded = { id: 'finisher-guarded' };
const pb2 = (P) => ({ id: 'probe-burst2', ...(P ? { P } : {}) });

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid, ...(P ? { P } : {}) };
}

// Compile a tree and load it at 0, optionally poking cells first.
function load(tree, rules, pokes = []) {
  const settings = recipeSettings(rules, 100);
  const built = buildTree(tree, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  for (const [c, ins] of pokes) vm.poke(c, ins);
  return { vm, built, core: settings.coreSize };
}
const MARK = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 };

test('blocks load with watches', () => {
  for (const id of ['probe-burst2', 'boot-stone', 'decoys-mixed', 'decoy-mirror']) assert.ok(leaves[id], id);
  for (const id of ['probe-burst2', 'boot-stone', 'decoy-mirror']) assert.equal(typeof leaves[id].watch, 'function', id);
  assert.equal(typeof leaves['probe-burst2'].plant, 'function');
});

// ---------------------------------------------------------------------------
// probe-burst2

test('probe-burst2 bursts after each decoding opening and hands on', () => {
  for (const rules of NEW) {
    ok(seq(qmul, pb2(), stone), rules, ['opening-qscan-mul', 'probe-burst2']);
    ok(seq(qdec, pb2(), guarded), rules, ['probe-burst2']);
    ok(seq(lattice, pb2({ COUNT: 20, STEP: 9, OFFSET: 30, GAP: 67, BOMB: 1 }), stone), rules, ['probe-burst2']);
  }
  ok({ id: 'image', kids: [seq(qmul, pb2(), stone), { id: 'decoys-mixed', P: { COUNT: 30, SEED: 97 } }] }, '94nop', ['probe-burst2']);
});

// The probe is the first state cell (address 0); its B field is what the
// opening hands on. Poke it (the MUL scan finds nothing in an empty core and
// leaves it as it is) and look for the burst's bomb, DAT #-GAP, #0.
function burstCells(rules, P, probeB) {
  const tree = seq(qmul, pb2(P), stone);
  const { vm, built, core } = load(tree, rules);
  vm.poke(0, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: probeB ?? vm.peek(0).b });
  vm.run(60 + 4 * P.COUNT);
  const out = [];
  for (let c = built.total; c < core; c++) { const x = vm.peek(c); if (x.op === 'DAT' && x.a === core - P.GAP && x.b === 0) out.push(c); }
  return { out, total: built.total, core };
}

test('probe-burst2 drops two streams, GAP apart, two bombs a loop', () => {
  for (const rules of ['94nop', '94x']) {
    const P = { COUNT: 16, STEP: 7, OFFSET: 0, GAP: 80, BOMB: 0 };
    const found = 3333;   // clear of mod-stone's first bombs
    const { out, core } = burstCells(rules, P, found);
    const want = [];
    for (let k = 0; k < P.COUNT; k++) want.push((found + k * P.STEP) % core, (found + k * P.STEP - P.GAP + core) % core);
    // Stream 1's bomb sits on cells stream 2 also reads: every cell bombed exactly as planned.
    assert.deepEqual(out, [...want].sort((a, b) => a - b), rules);
    // With OFFSET the first bomb lands OFFSET before the hit.
    const P2 = { ...P, OFFSET: 30 }, r2 = burstCells(rules, P2, found);
    assert.ok(r2.out.includes(found - 30) && r2.out.includes(found - 30 - 80), rules);
  }
});

test('probe-burst2 hands on without bombing at the boundary or near the warrior', () => {
  const P = { COUNT: 16, STEP: 7, OFFSET: 0, GAP: 80, BOMB: 0 };
  const boundary = burstCells('94nop', P, null);
  assert.deepEqual(boundary.out, [], 'boundary');
  // A hit just past the image: stream 2 would reach back into it.
  assert.deepEqual(burstCells('94nop', P, boundary.total + 40).out, [], 'just past the image');
  // A hit just before the image: stream 1 would run on into it.
  assert.deepEqual(burstCells('94nop', P, boundary.core - 60).out, [], 'just before the image');
  // Far enough on either side, it bombs.
  assert.equal(burstCells('94nop', P, boundary.total + 81).out.length, 32);
  const W = P.GAP + (P.COUNT - 1) * P.STEP;
  assert.equal(burstCells('94nop', P, boundary.core - (W - P.GAP) - 1).out.length, 32);
});

test('probe-burst2 refuses bad settings', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  has(seq(qmul, pb2({ COUNT: 16, STEP: 7, OFFSET: 0, GAP: 14, BOMB: 0 }), stone), s94, /same cells/);
  has(seq(qmul, pb2({ COUNT: 40, STEP: 100, OFFSET: 100, GAP: 200, BOMB: 0 }), stone), s94, /wrap into the warrior/);
  has(seq(qdec, pb2(), stone), s88, /probe-burst2 needs ICWS'94/);
  has(seq(pb2(), stone), s94, /nothing provides a probe/);
});

test('the probe-burst2 watch catches a broken stream', () => {
  // The bomb's A field 0: stream 2 lands on stream 1's cell, so half the cells are missed.
  const a0 = broken('probe-burst2', (l, o, m, a, b) => (l === 'bomb' ? [o, m, '#0', b] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(qmul, a0, stone), { rules: '94nop', length: 100 }), /missed a cell|not 32/, a0.id);
  // A loop counter one short.
  const c1 = broken('probe-burst2', (l, o, m, a, b) => (l === 'cnt' ? [o, m, a, '#15'] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(qmul, c1, stone), { rules: '94nop', length: 100 }), /not 32/, c1.id);
  // No window check: a hit next to the image would bomb it; the planted run is far, so
  // plant the hit close to the image instead.
  const nc = broken('probe-burst2', (l, o, m, a, b) => (o === 'SLT' ? ['SLT', 'B', a, '#-1'] : [o, m, a, b]));
  leaves[nc.id].plant = (api) => {
    const U = api.ref('probe'), found = api.norm(api.image.start + api.image.size + 10);
    return [[U, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: api.norm(found - U) }], [found, MARK]];
  };
  assert.throws(() => buildTree(seq(qmul, nc, stone), { rules: '94nop', length: 100 }), /bombed its own image/, nc.id);
});

// ---------------------------------------------------------------------------
// boot-stone

const bs = (P) => ({ id: 'boot-stone', P: { ...leaves['boot-stone'].defaults, ...P } });

test('boot-stone boots, wipes and starts early on every rule set', () => {
  for (const rules of ALL) for (const WIPE of [0, 1]) for (const EARLY of rules === '88' ? [0] : [0, 1]) {
    ok(bs({ WIPE, EARLY }), rules);
  }
  for (const rules of NEW) {
    ok(seq(qmul, pb2(), bs({ WIPE: 1, EARLY: 1 })), rules, ['probe-burst2']);
    ok(seq({ id: 'decoy-mirror' }, bs({ WIPE: 1 })), rules);
  }
  ok(seq({ id: 'decoy-maker' }, bs({ WIPE: 1 })), '88');
});

test('boot-stone with WIPE leaves no pointer to the copy; EARLY runs the copy before it is complete', () => {
  for (const rules of ['94nop', '88']) {
    for (const WIPE of [0, 1]) {
      const P = { ...leaves['boot-stone'].defaults, WIPE, EARLY: 0 };
      const { vm, built, core } = load(bs(P), rules);
      // The image is the boot; the stone template's ADD is the cell holding #STEP.
      const sl = [...Array(built.total).keys()].find((c) => vm.peek(c).op === 'ADD' && vm.peek(c).a === P.STEP);
      const copy = (sl - 1 + P.HOP) % core;
      vm.run(20);
      for (let i = 0; i < 4; i++) assert.equal(vm.peek(copy + i).op, vm.peek(sl - 1 + i).op, `${rules} copy cell ${i}`);
      const pointsAtCopy = [...Array(built.total).keys()].some((c) => {
        const x = vm.peek(c);
        return [[x.aMode, x.a], [x.bMode, x.b]].some(([m, f]) => m !== '#' && ((c + f) % core - copy + core) % core < 4);
      });
      assert.equal(pointsAtCopy, !WIPE, `${rules} WIPE ${WIPE}`);
      assert.equal(vm.processes(0).length, 1, `${rules} WIPE ${WIPE}: one process left, in the copy`);
    }
  }
  // EARLY: a process is in the copy while its last cell is still empty.
  const P = { ...leaves['boot-stone'].defaults, WIPE: 1, EARLY: 1 };
  const { vm, built, core } = load(bs(P), '94nop');
  const sl = [...Array(built.total).keys()].find((c) => vm.peek(c).op === 'ADD' && vm.peek(c).a === P.STEP);
  const copy = (sl - 1 + P.HOP) % core;
  let early = false;
  for (let t = 0; t < 20; t++) {
    if (vm.processes(0).some((q) => (q - copy + core) % core < 4) && vm.peek(copy + 3).op === 'DAT') early = true;
    vm.step();
  }
  assert.ok(early, 'the copy ran before its JMP was copied');
});

test('boot-stone refuses bad settings, and its watch catches a missed wipe', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  has(bs({ STEP: 3001 }), s94, /bombs itself/);
  has(bs({ EARLY: 1 }), s88, /EARLY needs ICWS'94/);
  has(bs({ HOP: 7950 }), s94, /on the warrior itself/);
  // Skip erasing the SPL: its A field still points at the copy.
  const nw = broken('boot-stone', (l, o, m, a, b) => (o === 'MOV' && /launch/.test(b) ? ['MOV', 'I', a, a] : [o, m, a, b]));
  assert.throws(() => buildTree({ ...nw, P: leaves['boot-stone'].defaults }, { rules: '94nop', length: 100 }), /still points at the copy/, nw.id);
  // EARLY with a JMP instead of the SPL: the boot process leaves for the half-made copy.
  const jmp = broken('boot-stone', (l, o, m, a, b) => (l === 'launch' && o === 'SPL' ? ['JMP', m, a, b] : [o, m, a, b]));
  assert.throws(() => buildTree({ ...jmp, P: { ...leaves['boot-stone'].defaults, EARLY: 1 } }, { rules: '94nop', length: 100 }), /boot-stone|did not survive/, jmp.id);
});

// ---------------------------------------------------------------------------
// decoys-mixed

test('decoys-mixed lays out cells that all differ', () => {
  for (const rules of ALL) ok({ id: 'image', kids: [stone, { id: 'decoys-mixed' }] }, rules);
  for (const rules of NEW) ok({ id: 'image', kids: [seq(qmul, pb2(), stone), { id: 'decoys-mixed', P: { COUNT: 30, SEED: 97 } }] }, rules);
  for (const rules of ['94nop', '88']) {
    const P = rules === '88' ? { COUNT: 72, SEED: 31 } : { COUNT: 90, SEED: 97 };
    const built = buildTree({ id: 'image', kids: [{ id: 'imp' }, { id: 'decoys-mixed', P }] }, { rules, length: 100 });
    const cells = built.w.instructions.slice(-P.COUNT);
    assert.equal(cells.length, P.COUNT);
    const keys = cells.map((x) => JSON.stringify([x.op, x.mod, x.aMode, x.a, x.bMode, x.b]));
    assert.equal(new Set(keys).size, P.COUNT, `${rules}: every decoy cell is different`);
    assert.ok(cells.every((x) => x.op === 'SPL' && x.a !== 0 && x.b !== 0), `${rules}: non-zero SPLs`);
    if (rules !== '88') assert.equal(new Set(cells.map((x) => x.mod)).size, 7, 'every modifier');
  }
  has({ id: 'image', kids: [stone, { id: 'decoys-mixed', P: { COUNT: 60, SEED: 97 } }] }, recipeSettings('94nop', 50), /more decoy cells/);
});

// ---------------------------------------------------------------------------
// decoy-mirror

test('decoy-mirror copies the image tail DIST away', () => {
  for (const rules of ALL) ok(seq({ id: 'decoy-mirror' }, stone), rules);
  for (const rules of NEW) ok(seq(qmul, pb2(), { id: 'decoy-mirror', P: { COUNT: 40, DIST: 5000 } }, stone), rules, ['probe-burst2']);
  const P = { COUNT: 24, DIST: 2400 };
  const { vm, built } = load(seq({ id: 'decoy-mirror', P }, { id: 'imp-gate' }), '94nop');
  const before = Array.from({ length: built.total }, (_, c) => ({ ...vm.peek(c) }));
  vm.run(2 * Math.min(P.COUNT, built.total) + 4);
  const n = Math.min(P.COUNT, built.total);
  for (let k = 1; k <= n; k++) {
    const src = built.total - k, x = vm.peek(src + P.DIST), y = before[src];
    assert.equal(`${x.op}.${x.mod} ${x.aMode}${x.a}`, `${y.op}.${y.mod} ${y.aMode}${y.a}`, `cell ${src}`);
  }
  assert.equal(vm.peek(built.total - n - 1 + P.DIST).op, 'DAT');
  assert.equal(vm.peek(built.total - n - 1 + P.DIST).b, 0, 'nothing copied past COUNT');
});

test('decoy-mirror refuses a mirror on itself, and its watch catches a short copy', () => {
  has(seq({ id: 'decoy-mirror', P: { COUNT: 24, DIST: 7950 } }, stone), recipeSettings('94nop'), /land on the warrior/);
  const sc = broken('decoy-mirror', (l, o, m, a, b) => (l === 'mCnt' ? [o, m, a, `${b}-1`] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(sc, stone), { rules: '94nop', length: 100 }), /copied \d+ cells, not|wrong place/, sc.id);
});
