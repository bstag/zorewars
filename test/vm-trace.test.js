import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, VM } from '../src/engine/index.js';

const plane = { topology: 'torus', coreSize: 8000, sizeX: 100, sizeY: 80, sizeZ: 1 };
function boot(source, settings = {}, traceSize = 3) {
  const warrior = compile(source, 'redcode', settings);
  assert.ok(warrior.ok, JSON.stringify(warrior.errors));
  const vm = new VM(settings);
  vm.enableTrace(traceSize);
  vm.load([warrior], { positions: [0] });
  return vm;
}

test('trace: formats only retained instructions when their text is read', () => {
  const vm = boot('JMP 0', plane);
  let formats = 0;
  const format = vm.geo.format;
  vm.geo.format = (value) => { formats++; return format(value); };
  vm.run(20);
  assert.equal(formats, 0, 'discarded trace entries must not be formatted');
  const trace = vm.trace;
  assert.deepEqual(trace.map((entry) => entry.step), [18, 19, 20]);
  assert.deepEqual(trace.map((entry) => entry.instruction), Array(3).fill('JMP.B $0, $0'));
  assert.equal(formats, 6);
  assert.equal(trace[0].instruction, 'JMP.B $0, $0');
  assert.equal(formats, 6, 'reading a retained instruction again reuses its text');
  assert.deepEqual(JSON.parse(JSON.stringify(trace)), trace.map((entry) => ({ ...entry })));
  trace[0].instruction = 'annotation';
  assert.equal(trace[0].instruction, 'annotation');
  vm.step();
  assert.equal(vm.trace, trace, 'an exposed trace remains a live array');
  assert.deepEqual(trace.map((entry) => entry.step), [19, 20, 21]);
  assert.equal(trace.at(-1).instruction, 'JMP.B $0, $0');
  assert.equal(formats, 8, 'future entries in an exposed trace contain ordinary text');
});

test('trace: snapshots code before addressing side effects and later overwrites', () => {
  const vm = boot('MOV.I >0, $1\nDAT #0, #0');
  vm.step();
  assert.equal(vm.peek(0).b, 2, 'postincrement modified the executed instruction');
  vm.poke(0, { op: 'DAT', mod: 'F', aMode: '#', a: 123, bMode: '#', b: 456 });
  assert.equal(vm.trace[0].instruction, 'MOV.I >0, $1');
  vm.step();
  assert.equal(vm.done, true);
  assert.equal(vm.trace.at(-1).instruction, 'DAT.F #0, #0');
  assert.equal(vm.trace.at(-1).died, 'ownCode');
});

test('trace: preserves torus vectors and starts a fresh array when reloaded', () => {
  const vm = boot('TRN $[0,-5]', plane);
  vm.step();
  const previous = vm.trace;
  const warrior = compile('JMP 0', 'redcode', plane);
  vm.load([warrior], { positions: [0] });
  assert.notEqual(vm.trace, previous);
  assert.deepEqual(vm.trace, []);
  assert.equal(previous[0].instruction, 'TRN.B $[0,-5], $0');
  vm.enableTrace(1);
  vm.run(10);
  assert.equal(vm.trace.length, 1);
  assert.equal(vm.trace[0].step, 10);
});
