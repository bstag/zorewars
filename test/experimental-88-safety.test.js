import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, VM, RULESETS, measureSpecies } from '../src/engine/index.js';

const settings = { ...RULESETS['88'], maxLength: 50 };
const read = (name) => fs.readFileSync(new URL(`../examples/experimental-88/${name}.red`, import.meta.url), 'utf8');
function fixture(name) {
  const source = read(name);
  const w = compile(source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const index = (label) => {
    const line = source.split(/\r?\n/).findIndex((s) => new RegExp(`^${label}\\s`).test(s)) + 1;
    const i = w.instructions.findIndex((ins) => ins.line === line);
    assert.ok(i >= 0, `${name}: missing ${label}`);
    return i;
  };
  const vm = new VM(settings);
  vm.load([w, compile('JMP 0', 'redcode', settings)], { positions: [0, 4000] });
  return { vm, w, index };
}
const dat = { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 };
const norm = (v) => (v + 8000) % 8000;
const words = (vm, w) => w.instructions.flatMap((i, k) => i.op === 'DAT' ? [] : [{ k, word: vm.disassemble(k) }]);
function reach(vm, pc) {
  for (let i = 0; i < 160000 && !vm.done; i++) {
    if (vm.turn === 0 && [...vm.warriors[0].queue][0] === pc) return;
    vm.step();
  }
  assert.fail(`never reached ${pc}`);
}

test('Afterimage rebuilds a prologue bombed while the old body is being copied', () => {
  const { vm, index } = fixture('afterimage');
  const marker = norm(index('watch') + vm.peek(index('watch')).b);
  vm.poke(marker, dat, 1);
  reach(vm, index('copy'));
  vm.poke(index('go'), dat, 1); // source entry is no longer executing
  vm.poke(index('go') + 1, dat, 1); // a damaged prologue must not propagate either
  vm.run(2000);
  assert.ok(vm.warriors[0].alive, 'must not launch the copied DAT');
});

for (const label of ['src', 'dst']) test(`Afterimage rejects a corrupted ${label} copy pointer`, () => {
  const { vm, w, index } = fixture('afterimage');
  const marker = norm(index('watch') + vm.peek(index('watch')).b);
  vm.poke(marker, dat, 1);
  reach(vm, index('copy'));
  const before = words(vm, w);
  vm.poke(index(label), { ...vm.peek(index(label)), b: label === 'src' ? 7999 : 0 }, 1);
  vm.run(2000);
  assert.ok(vm.warriors[0].alive);
  for (const x of before) assert.equal(vm.disassemble(x.k), x.word);
});

test('Afterimage refuses a sweep pointer redirected into its own prologue', () => {
  const { vm, w, index } = fixture('afterimage');
  reach(vm, index('sweep'));
  const before = words(vm, w);
  vm.poke(index('ptr'), { ...vm.peek(index('ptr')), b: norm(index('go') - index('ptr')) }, 1);
  vm.run(2000);
  assert.ok(vm.warriors[0].alive);
  for (const x of before) assert.equal(vm.disassemble(x.k), x.word);
});

for (const name of ['riptide', 'telltale', 'undercurrent']) {
  for (const label of ['fuse', 'last']) test(`${name} protects its executable body when ${label} is destroyed`, () => {
    const { vm, w, index } = fixture(name);
    const before = words(vm, w);
    vm.poke(index(label), dat, 1);
    vm.run(160000);
    assert.ok(vm.warriors[0].alive, 'missing marker must not cause self-destruction');
    for (const x of before) assert.equal(vm.disassemble(x.k), x.word, `corrupted own instruction ${x.k}`);
  });
}

for (const name of ['riptide', 'telltale']) {
  for (const phase of name === 'telltale' ? ['freeze', 'kill'] : ['kill']) test(`${name} refuses a ${phase} pointer redirected into its own body`, () => {
    const { vm, w, index } = fixture(name);
    reach(vm, index(phase));
    const before = words(vm, w);
    vm.poke(index('base'), { ...vm.peek(index('base')), b: w.instructions.length - 1 }, 1);
    vm.run(1000);
    assert.ok(vm.warriors[0].alive);
    for (const x of before) assert.equal(vm.disassemble(x.k), x.word, `overwrote own instruction ${x.k}`);
  });
}

test('Levy survives a full captured process queue sharing its work pointer', () => {
  const { vm, index } = fixture('levy');
  const enemy = vm.warriors[1];
  while (enemy.queue.size) enemy.queue.shift();
  for (let i = 0; i < settings.maxProcesses; i++) enemy.queue.push(index('pit'));
  vm.run(160000);
  assert.ok(vm.warriors[0].alive, 'captured workers must not clear the original body');
  assert.equal(vm.winner, 0, 'bounded workers must eventually terminate');
});

test('all five experimental warriors remain legal and survive a long solo run', () => {
  for (const name of ['afterimage', 'levy', 'riptide', 'telltale', 'undercurrent']) {
    const w = compile(read(name), 'redcode', settings);
    assert.ok(w.ok, `${name}: ${JSON.stringify(w.errors)}`);
    assert.ok(w.instructions.length <= 50);
    assert.ok(measureSpecies(w, { ...settings, maxCycles: 800000 }).survives, name);
  }
});
