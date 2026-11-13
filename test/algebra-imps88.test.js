// The '88 imp delivery blocks (tools/algebra/blocks/imps88.js): the one-process
// imp pump and the stone/pump boot. Each builds and passes the gate with its
// defaults on the rule sets it supports, alone and in a combination; the pump's
// ring is checked cell by cell in the VM; broken settings are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, modInverse, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const PUMP = 'imp-pump-88', BOOT = 'stone-pump-boot-88';
const seven = { N: 7, STREAM: 500, IHOP: 2400 };
const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};

test('both blocks pass the gate alone on 88 and 94nop, with 3-point and 7-point rings', () => {
  for (const rules of ['88', '94nop']) {
    assert.equal(ok(rules, { id: PUMP }).total, 6);
    assert.equal(ok(rules, { id: PUMP, P: { N: 7 } }).total, 6);
    assert.equal(ok(rules, { id: BOOT }).total, 20);
    ok(rules, { id: BOOT, P: seven });
  }
  ok('94x', { id: PUMP, P: { N: 13 } });
});

test('the pump launches every imp a ring step and a cell past the last, and none dies', () => {
  for (const N of [3, 7]) {
    const built = ok('88', { id: PUMP, P: { N } });
    const core = built.settings.coreSize, S = modInverse(N, core), dummies = Math.max(0, N - 3);
    for (const base of [0, 7990]) {
      const vm = new VM(built.settings);
      vm.load([built.w], { positions: [base] });
      const jmp = (base + built.labels.b0pJmp) % core, q0 = (base + built.labels.b0pPtr + 1) % core;
      const landings = [];
      while (vm.cycle < 3000) {
        const pc = vm.processes(0)[0];
        vm.step();
        if (pc === jmp) landings.push(vm.processes(0).at(-1));
      }
      assert.ok(landings.length > 2 * N + dummies);
      landings.forEach((cell, k) => assert.equal(cell, (((q0 + (k - dummies) * (S + 1)) % core) + core) % core, `launch ${k}`));
      const procs = vm.processes(0);
      const imps = procs.filter((q) => { const x = vm.peek(q); return x.op === 'MOV' && x.a === 0 && x.b === S; });
      // Every live launch is still alive: imps, the N leaders waiting for their cell, and the four pump lines.
      const inPump = procs.length - (landings.length - dummies);
      assert.ok(inPump === 3 || inPump === 4, `pump processes: ${inPump}`);
      assert.ok(imps.length >= landings.length - dummies - N);
      let breaks = 0;
      for (let i = 1; i < imps.length; i++) if ((imps[i] - imps[i - 1] + core) % core !== S) breaks++;
      assert.ok(breaks <= 1, 'the imps stand a ring step apart');
      assert.equal(vm.warriors[0].peak, procs.length);
    }
  }
});

test('the boot sends PROCS-1 processes to the stone and one to the pump, for every fan size', () => {
  for (let PROCS = 2; PROCS <= 9; PROCS++) {
    const built = ok('88', { id: BOOT, P: { PROCS } });
    const { labels, settings } = built, core = settings.coreSize;
    const P = { ...leaves[BOOT].defaults, PROCS };
    const vm = new VM(settings);
    vm.load([built.w], { positions: [100] });
    const stone = (100 + labels.b0sHead + P.HOP) % core;
    // Step until the boot's last line has run.
    while (vm.processes(0).some((q) => q >= 100 && q <= 100 + labels.b0bJmp) && vm.cycle < 400) vm.step();
    const procs = vm.processes(0);
    const inStone = procs.filter((q) => (q - stone + core) % core < 5).length;
    assert.ok(inStone >= PROCS - 1, `${PROCS}: stone processes`);
    assert.equal(vm.peek(stone - 1).op, 'DAT');
    assert.equal(vm.peek(stone).op, 'SPL');
    assert.equal(vm.peek(stone + 4).op, 'DJN');
    // One process is outside the stone: the pump's.
    const pump = procs.filter((q) => (q - stone + core) % core >= 5);
    assert.ok(pump.length >= 1 && pump.every((q) => ['SPL', 'MOV', 'ADD', 'JMP'].includes(vm.peek(q).op)));
  }
});

test('the blocks combine: after a quickscan, over decoys, and beside a stone', () => {
  const built = ok('88', { id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 4 } }, { id: BOOT }] });
  assert.ok(built.total <= 50);
  ok('88', { id: 'image', kids: [{ id: BOOT }, { id: 'decoys' }] });
  ok('94nop', { id: 'seq', kids: [{ id: 'opening-none' }, { id: BOOT }] });
  ok('88', { id: 'par', kids: [{ id: 'stone' }, { id: PUMP }] });
  ok('88', { id: 'apart', kids: [{ id: 'stone' }, { id: PUMP, P: { N: 7 } }] });
});

test('broken settings are refused by the contract and by the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  const refuses = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), `${JSON.stringify(tree)} should be refused`);
  refuses({ id: PUMP, P: { N: 5 } }, s88, /no 5-point imp ring/);
  refuses({ id: PUMP }, { ...RULESETS.lp, maxLength: 50 }, /too few/);
  refuses({ id: PUMP }, { ...RULESETS['94x'], maxLength: 50 }, /no 3-point imp ring/);
  refuses({ id: BOOT, P: { STEP: 3044 } }, s88, /grain of at least 10/);
  refuses({ id: BOOT, P: { STREAM: 5000 } }, s88, /inside the DJN stream/);
  refuses({ id: BOOT, P: { IHOP: 3010 } }, s88, /copies overlap/);
  assert.throws(() => buildTree({ id: BOOT, P: { HOP: 7990, IHOP: 7400 } }, { rules: '88' }), /lands on the original image/);

  // A pump whose vector moves by the wrong amount leaves the ring.
  const pump = buildTree({ id: PUMP }, { rules: '88' });
  pump.w.instructions[pump.labels.b0pAdd].a++;
  assert.throws(() => gate(pump), /left the ring/);
  // A boot whose pump vector is a cell out starts the pump in the wrong place.
  const boot = buildTree({ id: BOOT }, { rules: '88' });
  boot.w.instructions[boot.labels.b0bJmp].b++;
  assert.throws(() => gate(boot), /did not enter the pump copy|pump copy is not the pump/);
  // A stone whose pointer starts a cell off its residue bombs itself.
  const stone = buildTree({ id: BOOT }, { rules: '88' });
  stone.w.instructions[stone.labels.b0sHit].b += 3;
  assert.throws(() => gate(stone), /bombed itself|bombed its pump/);
});

// The whole 80,000-cycle round, with the read-only observer attached.
const full = (tree) => {
  const built = buildTree(tree, { rules: '88', verification: 'full' });
  assert.equal(built.verification.ok, true);
  assert.equal(built.verification.profile, 'full');
  assert.equal(built.verification.horizon, built.settings.maxCycles);
};

test('full verification: both blocks at their defaults, alone and in their main combination', () => {
  full({ id: PUMP });
  full({ id: PUMP, P: { N: 7 } });
  full({ id: 'par', kids: [{ id: 'stone' }, { id: PUMP }] });
  full({ id: BOOT });
  full({ id: BOOT, P: { STEP: 1721, TIME: 1000 } });
  full({ id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 4 } }, { id: BOOT }] });
});

test('with TIME the stone takes any step, runs TIME passes and ends on its own ADD line, leaving the pump', () => {
  const P = { STEP: 1721, TIME: 1000 };
  const built = ok('88', { id: BOOT, P });
  const { labels, settings } = built, core = settings.coreSize, D = leaves[BOOT].defaults;
  const base = 300, s0 = (base + labels.b0sHead + D.HOP) % core;
  const vm = new VM(settings);
  vm.load([built.w], { positions: [base] });
  let adds = 0, endedAt = null;
  const bombs = new Set();
  while (vm.cycle < 30000) {
    const pc = vm.processes(0)[0];
    if (endedAt === null && pc === s0 + 3 && vm.peek(pc).op === 'ADD') adds++;
    if (endedAt === null && (pc === s0 + 1 || pc === s0 + 2) && vm.peek(pc).op === 'MOV') {
      const c = (s0 + 1 + vm.peek(s0 + 1).b) % core;
      bombs.add(pc === s0 + 2 ? c : (c + vm.peek(c).b - 1 + core) % core);
    }
    vm.step();
    if (endedAt === null && adds && vm.peek(s0 + 3).op === 'DAT') endedAt = adds;
  }
  // The ADD line was bombed on pass TIME (the group of five may be a pass or two apart), not before.
  assert.ok(endedAt >= P.TIME - 6 && endedAt <= P.TIME, `ended after ${endedAt} passes`);
  // Until then: about two cells a pass, none on the stone's first lines or the pump.
  assert.ok(bombs.size > 1.8 * P.TIME, `${bombs.size} cells bombed`);
  const pump = (base + labels.b0pHead + D.IHOP) % core;
  for (let i = 0; i < 4; i++) assert.equal(vm.peek(pump + i).op, built.w.instructions[labels.b0pHead + i].op);
  // The stone is gone and the imps go on.
  const procs = vm.processes(0);
  assert.ok(procs.filter((q) => vm.peek(q).op === 'MOV' && vm.peek(q).b === 2667).length > 50);
  assert.equal(vm.warriors[0].alive, true);
  // A step whose early passes cross the stone or the pump is refused, as is a dense step without TIME.
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  assert.ok(treeMismatches({ id: BOOT, P: { STEP: 2143, TIME: 1000 } }, s88).some((m) => /already bombs the stone or the pump/.test(m)));
  assert.ok(treeMismatches({ id: BOOT, P: { STEP: 1721 } }, s88).some((m) => /grain of at least 10/.test(m)));
});
