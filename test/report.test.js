import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, VM, DEFAULT_SETTINGS, postMortem, formatPostMortem } from '../src/engine/index.js';

const ring = { ...DEFAULT_SETTINGS, coreSize: 80, maxCycles: 10, maxLength: 10, minDistance: 10, maxProcesses: 8 };

function load(sources, settings = ring, positions = [0]) {
  const warriors = sources.map(source => {
    const compiled = compile(source, 'redcode', settings);
    assert.equal(compiled.ok, true, JSON.stringify(compiled.errors));
    return compiled;
  });
  const vm = new VM(settings);
  vm.load(warriors, { positions });
  return vm;
}

for (const sizeZ of [1, 10]) test(`untouched ${sizeZ === 1 ? 'plane' : 'volume'} code retains its original vectors and program attribution`, () => {
  const settings = { ...ring, topology: 'torus', sizeX: 40, sizeY: 20, sizeZ, coreSize: 800 * sizeZ };
  const v = (y, z) => sizeZ > 1 ? `[0,${y},${z}]` : `[0,${y}]`;
  const vm = load([`;name A\nJMP ${v(1, 1)}\nDAT ${v(-1, 0)}, ${v(0, -1)}`, `;name B\nJMP ${v(2, 2)}`], settings, [19, 400]);
  const report = postMortem(vm);
  for (const warrior of report.warriors) {
    assert.equal(warrior.codeIntact, warrior.code.length);
    assert.ok(warrior.code.every(c => !c.changed && c.original === c.instruction));
    assert.deepEqual(warrior.runningProgram, { [`${warrior.name}'s program`]: 1 });
  }
  assert.match(report.warriors[0].code[0].original, /\$/);
  const text = formatPostMortem(report);
  assert.match(text, /ending code \(2\/2 unchanged/);
  assert.doesNotMatch(text, /Timeline:|Killing blow|process deaths|\*/);
});

for (const sizeZ of [1, 10]) test(`real writes on a ${sizeZ === 1 ? 'plane' : 'volume'} are distinguished from untouched vector code`, () => {
  const settings = { ...ring, topology: 'torus', sizeX: 40, sizeY: 20, sizeZ, coreSize: 800 * sizeZ };
  const hop = sizeZ > 1 ? '[0,1,1]' : '[0,1]';
  const target = sizeZ > 1 ? 840 : 40;
  const vm = load([`;name Writer\nMOV.I 1, ${hop}\nDAT #0, #0`, ';name Wait\nJMP 0'], settings, [0, target]);
  vm.run();
  const report = postMortem(vm), [writer, victim] = report.warriors;
  assert.equal(writer.codeIntact, 2);
  assert.equal(victim.codeIntact, 0);
  assert.equal(victim.code[0].ownerName, 'Writer');
  assert.equal(victim.code[0].writtenAtCycle, 0);
  assert.equal(victim.deaths.enemyCode, 1);
  assert.equal(report.killingBlow.victim, 'Wait');
  const text = formatPostMortem(report);
  assert.match(text, /Killing blow \(Wait, cycle 0\)/);
  assert.match(text, /1 process deaths: 1 on a cell written by an opponent/);
  assert.match(text, /by Writer @0/);
  assert.match(text, /Timeline:/);
});

test('text reports distinguish own-code, empty-core and division deaths', () => {
  for (const [source, cause, description] of [
    ['DAT #0, #0', 'ownCode', 'its own code or data'],
    ['JMP 1', 'emptyCore', 'empty core (it ran past its own code)'],
    ['DIV.A #0, 0', 'divideByZero', 'a division by zero'],
  ]) {
    const vm = load([`;name Trap\n${source}`]);
    vm.run();
    const report = postMortem(vm), text = formatPostMortem(report);
    assert.equal(report.warriors[0].deaths[cause], 1);
    assert.ok(text.includes(`1 process deaths: 1 on ${description}`));
    assert.match(text, /Trap: eliminated at cycle/);
    assert.match(text, /empty/);
    assert.match(text, /ending code \(1\/1 unchanged/);
    assert.ok(report.killingBlow.context.some(c => c.here));
  }
});

test('text reports show surviving processes converted to another program', () => {
  const vm = load([';name Imp\nMOV.I 0, 1', ';name Wait\nJMP 0'], ring, [0, 3]);
  vm.run();
  const report = postMortem(vm), text = formatPostMortem(report);
  assert.match(report.summary, /Wait has been converted/);
  assert.match(text, /Wait: alive, 1 processes/);
  assert.match(text, /processes are running: 1 Imp's program/);
  assert.match(text, /\* 0003\s+JMP.B \$0, \$0\s+MOV.I \$0, \$1\s+by Imp @2/);
  assert.doesNotMatch(text, /Killing blow|process deaths/);
});

test('loaded ownership is labelled as loaded rather than a null write cycle', () => {
  const vm = load([';name A\nJMP 0', ';name B\nDAT #1, #2'], ring, [0, 0]);
  const text = formatPostMortem(postMortem(vm));
  assert.match(text, /by B \(loaded\)/);
  assert.doesNotMatch(text, /@null/);
});

test('loaded and written context cells retain their different provenance labels', () => {
  const loaded = load([';name Trap\nDAT #0, #0']);
  loaded.run();
  assert.match(formatPostMortem(postMortem(loaded)), /> 0000\s+DAT.F #0, #0\s+Trap \(loaded\)/);
  const written = load([';name Zero\nDIV.A #0, 0']);
  written.run();
  assert.match(formatPostMortem(postMortem(written)), /> 0000\s+DIV.A #0, \$0\s+Zero @0/);
});
