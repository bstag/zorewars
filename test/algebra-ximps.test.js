// Tests for the X-hill imp blocks (tools/algebra/blocks/ximps.js):
// dual-imp-pump, impstep-clear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';
import { modInverse } from '../tools/algebra/util.js';

const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};
function solo(id, P = {}, rules = '94x') {
  const settings = treeSettings(rules, 100), Q = { ...leaves[id].defaults, ...P };
  const r = link({ id, P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  return { vm, w, settings, at: (l) => r.labels[`b0${l}`], core: settings.coreSize };
}
const mod = (x, n) => ((x % n) + n) % n;

test('both blocks build alone and in combinations on both cores', () => {
  for (const id of ['dual-imp-pump', 'impstep-clear']) assert.equal(typeof leaves[id].watch, 'function', id);
  assert.equal(ok({ id: 'dual-imp-pump' }, '94x').total, 10);
  assert.equal(ok({ id: 'impstep-clear' }, '94x').total, 30);                 // TRIP 1, PAD 20
  assert.equal(ok({ id: 'impstep-clear', P: { TRIP: 0, PAD: 6 } }, '94x').total, 12);
  assert.equal(ok({ id: 'impstep-clear', P: { PAD: 0, TRIP: 0 } }, '94x').total, 6);
  ok({ id: 'dual-imp-pump' }, '94nop');
  ok({ id: 'impstep-clear' }, '94nop');
  ok({ id: 'dual-imp-pump', P: { NA: 13, NB: 19 } }, '94x');                      // the X hill's own pair
  ok({ id: 'par', kids: [{ id: 'dual-imp-pump' }, { id: 'hill-stone' }] }, '94x', 50);
  ok({ id: 'apart', kids: [{ id: 'stone' }, { id: 'dual-imp-pump' }] }, '94nop', 50);
  ok({ id: 'fanboot', P: { N: 4, SPLIT: 1, MOREA: 1 }, kids: [{ id: 'timed-stone' }, { id: 'dual-imp-pump' }] }, '94x', 50);
  ok(seq({ id: 'opening-quickscan' }, { id: 'impstep-clear', P: { TRIP: 0, PAD: 6 } }), '94x', 50);
  ok(seq({ id: 'opening-quickscan' }, { id: 'impstep-clear' }), '94x', 100);
  ok({ id: 'boot', kids: [{ id: 'impstep-clear' }] }, '94nop', 50);
});

test('bad settings are refused', () => {
  const x = recipeSettings('94x'), n = recipeSettings('94nop');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'dual-imp-pump', P: { NA: 3 } }, x, /no 3-point imp ring/);            // 3 divides 55,440
  has({ id: 'dual-imp-pump', P: { NA: 7, NB: 7 } }, n, /must differ/);
  has({ id: 'dual-imp-pump', P: { DISTB: 30000 } }, n, /on the warrior itself/);    // past the 8,000 core
  has({ id: 'dual-imp-pump', P: { DISTA: 1500, DISTB: 1600 } }, x, /on top of each other/);
  has({ id: 'dual-imp-pump' }, recipeSettings('88'), /needs ICWS'94/);
  has({ id: 'impstep-clear', P: { POINTS: 7 } }, x, /no 7-point imp ring/);
  has({ id: 'impstep-clear', P: { POINTS: 5 } }, n, /no 5-point imp ring/);
  has({ id: 'par', kids: [{ id: 'impstep-clear' }, { id: 'imp' }] }, x, /a clear runs alone|must run forever/);
});

// dual-imp-pump, directly: both kinds of imp are running, with the steps of a
// 13- and a 17-point ring on the X core (3 and 7 on 8,000), nothing launched
// has died, and the pump is still launching.
for (const [rules, na, nb] of [['94x', 13, 17], ['94nop', 3, 7]]) {
  test(`dual-imp-pump keeps feeding a ${na}-point A-imp spiral and a ${nb}-point B-imp spiral on ${rules}`, () => {
    const { vm, at, core } = solo('dual-imp-pump', {}, rules);
    const sa = modInverse(na, core), sb = modInverse(nb, core);
    const count = () => {
      let a = 0, b = 0, waiting = 0;
      for (const q of vm.processes(0)) {
        const c = vm.peek(q);
        if (c.op === 'MOV' && c.bMode === '*' && mod(c.a, core) === sa) a++;
        else if (c.op === 'MOV' && c.bMode === '$' && mod(c.b, core) === sb) b++;
        else if (q > 20) waiting++;                 // its predecessor writes its cell later this round
      }
      return { a, b, waiting, all: vm.processes(0).length };
    };
    let launchesA = 0, launchesB = 0, deaths = 0;
    const run = (until) => {
      while (vm.cycle < until) {
        const pc = vm.processes(0)[0];
        if (pc === at('dpLa')) launchesA++;
        if (pc === at('dpLb')) launchesB++;
        const before = vm.processes(0).length;
        vm.step();
        if (vm.processes(0).length < before) deaths++;
      }
    };
    run(20000);
    const first = count();
    assert.equal(deaths, 0, 'no process died');
    assert.ok(first.a >= na && first.b >= nb, JSON.stringify(first));
    assert.ok(first.a + first.b + first.waiting >= launchesA + launchesB - 1, 'every launched imp is running');
    const [a1, b1] = [launchesA, launchesB];
    run(60000);
    assert.equal(deaths, 0, 'no process died');
    assert.ok(launchesA > a1 + 50 && launchesB > b1 + 50, 'the pump is still launching: it is continuous');
    assert.ok(Math.abs(launchesA - launchesB) <= 1, 'one imp to each spiral a pass');
    for (const l of ['dpFeed', 'dpCa', 'dpCb', 'dpAdd', 'dpLb', 'dpLa']) assert.notEqual(vm.peek(at(l)).op, 'DAT', `${l} intact`);
  });
}

// impstep-clear, directly, on the 8,000 core: consecutive bombs are one 3-point
// imp step apart; in 80,000 cycles it laps the core, resets on its own gate and
// goes round again, never touching its other five cells.
test('impstep-clear bombs along the ring, covers the core and laps', () => {
  const { vm, at, core } = solo('impstep-clear', {}, '94nop');
  const s = modInverse(3, core), gate = at('icGate'), SIZE = 30;
  const first = [];
  let resets = 0;
  while (vm.cycle < 80000) {
    const pc = vm.processes(0)[0];
    if (pc === at('icMov')) {
      const t = mod(gate + vm.peek(gate).a, core);
      if (first.length < 6) first.push(t);
      if (t === gate) resets++;
      assert.ok(t === gate || t >= SIZE, `bomb at ${t} is inside the block`);
    }
    vm.step();
  }
  // The pumped processes overlap, so a point can be bombed twice; every bomb is on the ring walk from the first cell past the block.
  const walk = [0, 1, 2, 3, 4, 5].map((k) => mod(gate + SIZE + k * s, core));
  assert.equal(first[0], walk[0]);
  assert.ok(first.every((t) => walk.includes(t)) && new Set(first).size >= 3, `${first}`);
  assert.ok(resets >= 2, `${resets} laps`);
  assert.ok(vm.warriors[0].alive);
  for (const l of ['icClr', 'icMov', 'icAdd', 'icDjn']) assert.ok(vm.writeCycle[at(l)] <= 0, `${l} untouched`);
  // The lap ends when the front from below reaches the gate; the other fronts are then at the block's
  // own twelve cells shifted by a ring step, and those are the only cells it never bombs.
  const untouched = [];
  for (let c = SIZE; c < core; c++) if (vm.writeCycle[c] < 0) untouched.push(c);
  assert.ok(untouched.length <= 2 * SIZE, `${untouched.length} cells never bombed`);
  assert.ok(untouched.every((c) => [1, 2].some((j) => mod(c - j * s, core) < SIZE)), `${untouched}`);
});

// The reason the block exists: a 64-process 13-point spiral on the X core. A
// plain d-clear with the same anti-imp bomb mostly ties with it; the clear that
// walks the ring kills it.
test('impstep-clear kills a 13-point spiral that a plain d-clear ties with', () => {
  const settings = treeSettings('94x', 100);
  const build = (tree) => compile(link(tree, settings).source, 'redcode', settings);
  const spiral = build({ id: 'vector-spiral', P: { ...leaves['vector-spiral'].defaults, N: 13, K: 6 } });
  const ours = build({ id: 'impstep-clear', P: leaves['impstep-clear'].defaults });
  const plain = compile(`;assert CORESIZE==55440
ORG clr
gate dat #0, #6
clr  spl #0, 0
     mov bomb, >gate
     djn.f -1, >gate
bomb dat <34117, 6
END`, 'redcode', settings);
  assert.ok(spiral.ok && ours.ok && plain.ok);
  const fight = (w, offset) => {
    const vm = new VM(settings); vm.load([w, spiral], { positions: [0, offset] });
    vm.run();
    return vm.warriors[0].alive && !vm.warriors[1].alive ? 'win' : !vm.warriors[0].alive ? 'loss' : 'tie';
  };
  const offsets = [9000, 21013, 33333, 47001, 15555, 40404];
  const a = offsets.map((o) => fight(ours, o)), b = offsets.map((o) => fight(plain, o));
  assert.equal(a.filter((r) => r === 'win').length, offsets.length, `impstep-clear: ${a}`);
  assert.ok(!a.includes('loss'), `impstep-clear: ${a}`);
  assert.ok(b.filter((r) => r === 'win').length <= 1, `plain d-clear: ${b}`);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, pc: ctx.pc, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  leaves[nid].watch = (api) => orig.watch(api);
  if (orig.running) leaves[nid].running = orig.running;
  return nid;
}

test('the watches catch a broken mechanism', () => {
  // No carpet under the first A arm: imp 0 dies and takes the spiral with it.
  const bare = broken('dual-imp-pump', (l, o, m, a, b) => (l === 'dpCa' ? ['NOP', 'F', a, b] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: bare }, { rules: '94nop', length: 100 }), /lost imps|do not fill|stopped running/);
  // The loop altered: with a JMP for the DJN, or with step 1, the spiral survives the watch's duel.
  const nodjn = broken('impstep-clear', (l, o, m, a, b) => (l === 'icDjn' ? ['JMP', 'B', a, '0'] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: nodjn }, { rules: '94x', length: 100 }), /killed a 13-point spiral in only|died against|with a survivor in only|died after the kill|climbed past its trip/);
  // A clear that steps by something other than the imp step.
  const off = broken('impstep-clear', (l, o, m, a, b) => (l === 'icAdd' ? [o, m, '#2668', b] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: off }, { rules: '94nop', length: 100 }), /left the imp-step lattice|bombed its own warrior|did not survive/);
});

test('impstep-clear on the 55,440 core misses only its own cells shifted by a ring step, and both blocks pass full verification', () => {
  const { vm, at, core } = solo('impstep-clear', {}, '94x');
  const gate = at('icGate'), hit = new Uint8Array(core);
  let resets = 0;
  while (!vm.done && vm.cycle < 500000) {
    const q = vm.warriors[0].queue;
    if (q.buf[q.head] === at('icMov')) { const t = mod(gate + vm.peek(gate).a, core); hit[t] = 1; if (t === gate) resets++; }
    vm.step();
  }
  assert.ok(vm.warriors[0].alive);
  assert.ok(resets >= 2, `${resets} laps`);
  let missed = 0;
  const SIZE = 30;
  for (let c = SIZE; c < core; c++) if (!hit[c]) missed++;
  // (A variant whose later laps walk a second ring size covers these too, but against the spiral it
  // won 20, tied 7 and lost 13 of 40 rounds: the kill at the gate needs an imp step on every lap.)
  assert.ok(missed <= SIZE * 12, `${missed} cells never bombed`);          // SIZE x (13 - 1)
  for (let c = SIZE; c < core; c++) if (!hit[c]) assert.ok(Array.from({ length: 12 }, (_, j) => j + 1).some((j) => mod(c - j * 34117, core) < SIZE), `cell ${c}`);
  for (const l of ['icClr', 'icMov', 'icAdd', 'icDjn']) assert.equal(vm.writeCycle[at(l)], -1, `${l} untouched`);
  for (const id of ['dual-imp-pump', 'impstep-clear']) for (const rules of ['94x', '94nop']) {
    assert.equal(buildTree({ id }, { rules, length: 100, verification: 'full' }).verification.ok, true, `${id} on ${rules}`);
  }
});

// How the spiral dies (the mechanism the block's comment describes): nothing much happens until an
// arm climbs onto the block; the imp copied over the pointer cell has A-field 0, the clear's next
// bombs fall on the ring, and the spiral is gone a few hundred cycles later with the loop untouched.
test('impstep-clear kills the spiral at its gate: contact, then a few hundred cycles', () => {
  const settings = treeSettings('94x', 100), core = settings.coreSize;
  const build = (tree) => compile(link(tree, settings).source, 'redcode', settings);
  const spiral = build({ id: 'vector-spiral', P: { ...leaves['vector-spiral'].defaults, N: 13, K: 6 } });
  const linked = link({ id: 'impstep-clear', P: leaves['impstep-clear'].defaults }, settings), ours = compile(linked.source, 'redcode', settings);
  const at = (l) => linked.labels['b0' + l];
  for (const offset of [21013, 40404]) {
    const vm = new VM(settings); vm.load([ours, spiral], { positions: [0, offset] });
    let contact = null, before = null;
    while (!vm.done) {
      vm.step();
      if (contact === null && vm.peek(at('icGate')).op === 'MOV') { contact = vm.cycle; before = vm.processes(1).length; }
    }
    assert.ok(contact !== null, 'an imp was copied over the pointer cell');
    assert.ok(before >= 39, `the spiral was still ${before} processes strong at contact`);
    assert.equal(vm.processes(1).length, 0, 'the spiral is dead');
    assert.ok(vm.cycle - contact < 1500, `dead ${vm.cycle - contact} cycles after contact`);
    assert.ok(vm.warriors[0].alive);
    for (const l of ['icClr', 'icMov', 'icAdd', 'icDjn']) assert.equal(vm.peek(at(l)).op, ours.instructions[at(l)].op, `${l} intact`);
    void core;
  }
});

// TRIP: against the same spiral with a one-process jmp 0 started 45% of the core away, the clear must
// kill the imps and then go on to find the survivor. Without the trip the re-aimed walk climbs into
// the clear's own loop in some rounds; with it the pointer goes back to an ordinary lap.
test('impstep-clear TRIP: after the kill the clear goes back to an ordinary lap and finds a far survivor', () => {
  const settings = treeSettings('94x', 100), core = settings.coreSize, far = Math.floor(core * 0.45), S = 34117;
  const opp = compile([';name spiral+survivor', 'ORG xx', `xx mov.i surv, surv+${far}`, ` spl.b surv+${far}, 0`, ' jmp go, 0', 'surv jmp 0, 0',
    'go spl 1', ' spl 1', ' spl 1', ' spl 1', ' spl 1', ' spl 1', ' spl ad', ' jmp @vec', `ad add.ab #${S}, vec`, 'vec dat #0, #imp-vec', `imp mov.i 0, ${S}`, 'END'].join('\n'), 'redcode', settings);
  assert.ok(opp.ok, JSON.stringify(opp.errors));
  const play = (P) => {
    const linked = link({ id: 'impstep-clear', P: { ...leaves['impstep-clear'].defaults, ...P } }, settings), w = compile(linked.source, 'redcode', settings);
    const t = { win: 0, tie: 0, loss: 0 }; let resets = 0;
    for (const offset of [3000, 15000, 21013, 31000]) {
      const vm = new VM(settings); vm.load([w, opp], { positions: [0, offset] });
      const rst = linked.labels.b0icRst;
      while (!vm.done) { if (rst !== undefined && vm.processes(0)[0] === rst) resets++; vm.step(); }
      t[vm.warriors[0].alive && !vm.warriors[1].alive ? 'win' : !vm.warriors[0].alive ? 'loss' : 'tie']++;
    }
    return { ...t, resets };
  };
  const tripped = play({}), plain = play({ TRIP: 0, PAD: 20 });
  assert.equal(tripped.win, 4, JSON.stringify(tripped));
  assert.ok(tripped.resets >= 1, 'the trip sent the pointer back at least once');
  assert.ok(plain.loss >= 1, `without the trip the clear dies in some rounds: ${JSON.stringify(plain)}`);
  // A trip check that never fires is refused by the watch's survivor duels.
  const nid = 'broken-trip-impstep-clear', orig = leaves['impstep-clear'];
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, pc: ctx.pc, ins: (l, o, m, a, b = '0') => (l === 'icChk' ? ctx.ins(l, 'JMP', 'B', a, '0') : ctx.ins(l, o, m, a, b)) }) };
  leaves[nid].watch = (api) => orig.watch(api);
  assert.throws(() => buildTree({ id: nid }, { rules: '94x', length: 100 }), /with a survivor|died after the kill|climbed past its trip/);
});
