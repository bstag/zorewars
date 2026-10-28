import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, VM, RULESETS, mulberry32 } from '../src/engine/index.js';
import { parseTunable, withConstants } from '../tools/tune.js';
import { strip } from '../tools/hill.js';

const source = fs.readFileSync(new URL('../examples/experimental-94x/molting.js', import.meta.url), 'utf8');
const { current, space } = parseTunable(source);
const settings = { ...RULESETS['94x'], maxLength: 50 };
const variants = Array.from({ length: 8 }, (_, i) => ({ OPENING: i & 1, TRIGGER: (i >> 1) & 1, BACKWARD: (i >> 2) & 1 }));
const mod = (x) => ((x % settings.coreSize) + settings.coreSize) % settings.coreSize;
function build(overrides = {}, cfg = settings) {
  const P = { ...current, ...overrides };
  return { P, w: compile(withConstants(source, P), 'javascript', cfg) };
}
function loaded(w, base = 0) {
  assert.equal(w.ok, true, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [base] });
  return vm;
}
function reachPayload(vm, P, base = 0) {
  const target = mod(base + P.HOP);
  while (!vm.done && vm.cycle < 10000 && !vm.processes(0).includes(target)) vm.step();
  assert.ok(vm.processes(0).includes(target), `did not relocate to ${target}`);
  return vm.cycle;
}

test('all Molting structures copy an exact payload, execute it and survive full 94x rounds', () => {
  for (const variant of variants) for (const base of [0, settings.coreSize - 21]) {
    const { w, P } = build(variant);
    assert.ok(w.instructions.length <= 50);
    assert.deepEqual(w.warnings, []);
    assert.ok(w.instructions.every((x) => !['LDP', 'STP'].includes(x.op)));
    const vm = loaded(w, base);
    const movedAt = reachPayload(vm, P, base);
    // The 13-instruction payload is the complete final section. Compare before
    // its first instruction runs, so dynamic counters still have initial values.
    const template = strip(w).instructions.slice(-13).map((i) => ({ ...i, a: mod(i.a), b: mod(i.b) }));
    assert.deepEqual(template.map((_, i) => vm.peek(base + P.HOP + i)), template);
    if (P.TRIGGER) assert.deepEqual(vm.peek(base + P.SENSOR), strip(w).instructions[5]);
    assert.equal(vm.b[mod(base + 4)], 0, 'undisturbed marker must not fire before timer');
    vm.run();
    assert.equal(vm.cycle, settings.maxCycles);
    assert.equal(vm.warriors[0].alive, true);
    assert.equal(vm.warriors[0].peak, 1);
    assert.ok(vm.lastExec[mod(base + P.HOP + 6)] > movedAt, 'DAT phase must execute');
    assert.ok(vm.lastExec[mod(base + w.start)] < movedAt, 'old opening must be abandoned');
    // Static payload instructions survive multiple complete clear passes.
    for (let i = 0; i < template.length; i++) if (![9, 10].includes(i)) {
      assert.deepEqual(vm.peek(base + P.HOP + i), template[i]);
    }
    assert.equal(vm.peek(base + P.HOP - 1).op, 'DAT');
    assert.equal(vm.peek(base + P.HOP + 13).op, 'DAT');
  }
});

test('marker damage triggers an early molt, while timer-only structures ignore it', () => {
  for (const OPENING of [0, 1]) for (const TRIGGER of [0, 1]) {
    const { w, P } = build({ OPENING, TRIGGER, WAIT: 768 });
    const normal = loaded(w), disturbed = loaded(w);
    disturbed.step(); // marker has been planted if this structure uses it
    disturbed.poke(P.SENSOR, { op: 'DAT', mod: 'F', aMode: '#', a: 91, bMode: '#', b: 92 }, -1);
    const normalTime = reachPayload(normal, P), disturbedTime = reachPayload(disturbed, P);
    if (TRIGGER) {
      assert.ok(disturbedTime < normalTime / 4);
      assert.ok(disturbed.b[4] > 0, 'marker event leaves unused timer budget');
    } else assert.equal(disturbedTime, normalTime);
    disturbed.run();
    assert.equal(disturbed.warriors[0].alive, true);
  }
});

test('parameter boundaries and reproducible random settings remain solo-safe', () => {
  const random = mulberry32(4242);
  const trials = [
    ...variants.flatMap((v) => [0, 1].map((edge) => ({ ...Object.fromEntries(Object.entries(space).map(([k, range]) => [k, range[edge]])), ...v }))),
    ...Array.from({ length: 32 }, () => Object.fromEntries(Object.entries(space).map(([k, [lo, hi]]) => [k, lo + Math.floor(random() * (hi - lo + 1))]))),
  ];
  for (const P of trials) {
    const { w } = build(P), vm = loaded(w);
    reachPayload(vm, P);
    vm.run();
    assert.equal(vm.warriors[0].alive, true, JSON.stringify(P));
  }
});

test('generator rejects unsupported fields, insufficient length and unsafe parameters', () => {
  assert.equal(build({}, RULESETS['94nop']).w.ok, false);
  assert.equal(build({}, { ...settings, maxLength: 20 }).w.ok, false);
  assert.equal(build({}, { ...settings, topology: 'torus', sizeX: 5544, sizeY: 10 }).w.ok, false);
  for (const [key, [lo, hi]] of Object.entries(space)) for (const value of [lo - 1, hi + 1, 0.5]) {
    assert.equal(build({ [key]: value }).w.ok, false, `${key}=${value}`);
  }
});

test('saved evolved fragment specimens remain legal and survive full 94x solo rounds', () => {
  for (const name of ['four', 'eight']) {
    const text = fs.readFileSync(new URL(`../examples/experimental-94x/fragments-${name}.red`, import.meta.url), 'utf8');
    const w = compile(text, 'redcode', settings), vm = loaded(w);
    vm.run();
    assert.equal(vm.warriors[0].alive, true);
    assert.equal(vm.cycle, settings.maxCycles);
  }
});
