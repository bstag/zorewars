import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, assemble, VM, runMatch } from '../src/engine/index.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Load a single program at address 0 and return the VM.
function boot(src, settings = {}) {
  const w = compile(src, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  return vm;
}

test('assembler: labels, EQU, ORG and default modifiers', () => {
  const w = assemble(`
    ;name T
    step EQU 4
         ORG go
    bomb DAT #0
    go:  ADD #step, bomb
         MOV bomb, @bomb
         JMP go
  `);
  assert.ok(w.ok, JSON.stringify(w.errors));
  assert.equal(w.name, 'T');
  assert.equal(w.start, 1);
  const [dat, add, mov, jmp] = w.instructions;
  assert.deepEqual([dat.aMode, dat.a, dat.bMode, dat.b], ['#', 0, '#', 0]);
  assert.equal(add.mod, 'AB');
  assert.equal(add.a, 4);
  assert.equal(add.b, -1);
  assert.equal(mov.mod, 'I');
  assert.equal(jmp.mod, 'B');
  assert.equal(jmp.a, -2);
});

test('assembler: records the ruleset a warrior declares', () => {
  assert.equal(assemble(';redcode-94nop\n;name X\nJMP 0').dialect, 'redcode-94nop');
  assert.equal(assemble(';redcode\nJMP 0').dialect, 'redcode');
  assert.equal(assemble('JMP 0').dialect, null);
});

test('assembler: reports errors with line numbers', () => {
  const w = assemble('MOV 0, 1\nFOO 1, 2\nJMP nowhere');
  assert.equal(w.ok, false);
  assert.deepEqual(w.errors.map((e) => e.line), [2, 3]);
});

test('assembler: expressions', () => {
  const w = assemble('x EQU (3+4)*2\nDAT #x%5, #CORESIZE/2');
  assert.equal(w.instructions[0].a, 4);
  assert.equal(w.instructions[0].b, 4000);
});

test('assembler: FOR/ROF with counter, & concatenation and FOR 0', () => {
  const w = assemble(`
    n EQU 3
    skip z for 0
         DAT #99
         rof
    i for n
    b&i  DAT #i, #i*10
    rof
         JMP b02
  `);
  assert.ok(w.ok, JSON.stringify(w.errors));
  assert.equal(w.instructions.length, 4);
  assert.deepEqual(w.instructions.slice(0, 3).map((x) => [x.a, x.b]), [[1, 10], [2, 20], [3, 30]]);
  assert.equal(w.instructions[3].a, -2); // b02 is two lines back
});

test('assembler: FOR counter does not touch modifiers, CURLINE pads', () => {
  const w = assemble('MOV 0, 1\ni for MAXLENGTH-CURLINE\ndat.i #i, 0\nrof', { maxLength: 5 });
  assert.ok(w.ok, JSON.stringify(w.errors));
  assert.equal(w.instructions.length, 5);
  assert.equal(w.instructions[4].mod, 'I');
  assert.equal(w.instructions[4].a, 4);
});

test('assembler: pMARS registers, textual EQU modes, ;redcode header, ;assert', () => {
  const w = assemble(`From: someone
Subject: my warrior
;redcode-94
;name R
;assert CORESIZE == 55440
bomb EQU <100
     SEQ a=10, b=a+5
     DAT a, b
     MOV 0, bomb
`);
  assert.ok(w.ok, JSON.stringify(w.errors));
  assert.equal(w.name, 'R');
  assert.deepEqual([w.instructions[1].a, w.instructions[1].b], [10, 15]);
  assert.equal(w.instructions[2].bMode, '<');
  assert.equal(w.instructions[2].b, 100);
  assert.match(w.warnings[0].message, /CORESIZE == 55440 is false/);
});

test('P-space: STP and LDP, and results carry between rounds', () => {
  const vm = boot('STP.AB #42, #7\nLDP.AB #7, 2\nDAT #0, #0');
  vm.step(); vm.step();
  assert.equal(vm.warriors[0].pspace[7], 42);
  assert.equal(vm.peek(3).b, 42);
  assert.equal(vm.warriors[0].pspace[0], 7999); // -1: first round
  vm.recordResults();
  assert.equal(vm.warriors[0].pspace[0], 1); // survived alone
});

test('imp crawls forward one cell per cycle', () => {
  const vm = boot('MOV.I $0, $1');
  vm.run(10);
  for (let i = 0; i <= 10; i++) assert.equal(vm.peek(i).op, 'MOV');
  assert.deepEqual(vm.processes(0), [10]);
});

test('DAT kills the process', () => {
  const vm = boot('DAT #0, #0');
  vm.step();
  assert.equal(vm.done, true);
  assert.equal(vm.warriors[0].alive, false);
});

test('SPL queues the next instruction before the new one', () => {
  const vm = boot('SPL 2\nJMP 0\nJMP 0');
  vm.step();
  assert.deepEqual(vm.processes(0), [1, 2]);
});

test('SPL respects the process limit', () => {
  const vm = boot('SPL 0\nJMP -1', { maxProcesses: 5 });
  vm.run(50);
  assert.equal(vm.warriors[0].queue.size, 5);
});

test('predecrement and postincrement addressing', () => {
  const vm = boot('MOV.I $2, <1\nDAT #0, #5\nNOP');
  vm.step();
  assert.equal(vm.peek(1).b, 4);          // decremented before use
  assert.equal(vm.peek(5).op, 'NOP');     // 1 + 4

  const vm2 = boot('MOV.I $2, }1\nDAT #3, #0\nNOP');
  vm2.step();
  assert.equal(vm2.peek(1).a, 4);         // incremented after use
  assert.equal(vm2.peek(4).op, 'NOP');    // 1 + 3
});

test('postincrement happens after the operand instruction is copied', () => {
  // A-operand }1 points at cell 1 itself (A-field 0). ICWS'94 copies cell 1
  // into the A-instruction register first, then increments its A-field.
  const vm = boot('MOV.I }1, $2\nDAT #0, #7');
  vm.step();
  assert.equal(vm.peek(1).a, 1);   // incremented in core
  assert.equal(vm.peek(2).a, 0);   // but the copy holds the old value
  assert.equal(vm.peek(2).b, 7);
});

test('arithmetic wraps modulo core size', () => {
  const vm = boot('SUB.AB #1, 1\nDAT #0, #0');
  vm.step();
  assert.equal(vm.peek(1).b, 7999);
});

test('DIV by zero kills the process but writes the other field', () => {
  const vm = boot('DIV.F 2, 1\nDAT #10, #10\nDAT #0, #5');
  vm.step();
  assert.equal(vm.peek(1).b, 2);
  assert.equal(vm.peek(1).a, 10);
  assert.equal(vm.warriors[0].alive, false);
});

test('DJN decrements then jumps while non-zero', () => {
  const vm = boot('DJN.B 0, #3');
  vm.step(); vm.step();
  assert.deepEqual(vm.processes(0), [0]);
  vm.step();
  assert.deepEqual(vm.processes(0), [1]);
});

test('SEQ.I skips when instructions match, SNE when they differ', () => {
  const vm = boot('SEQ.I 3, 4\nNOP\nNOP\nDAT #1, #2\nDAT #1, #2');
  vm.step();
  assert.deepEqual(vm.processes(0), [2]);
  const vm2 = boot('SNE.I 3, 4\nNOP\nNOP\nDAT #1, #2\nDAT #1, #3');
  vm2.step();
  assert.deepEqual(vm2.processes(0), [2]);
});

test('SLT compares unsigned field values', () => {
  const vm = boot('SLT.AB #5, 1\nDAT #0, #-1');
  vm.step();
  assert.deepEqual(vm.processes(0), [2]); // 5 < 7999
});

test('JMZ.F only jumps when both fields are zero', () => {
  const vm = boot('JMZ.F 5, 1\nDAT #0, #1');
  vm.step();
  assert.deepEqual(vm.processes(0), [1]);
});

test('every library warrior compiles and survives alone', () => {
  const list = JSON.parse(read('warriors/index.json'));
  for (const entry of list.filter((e) => e.language !== 'python')) {
    const w = compile(read(`warriors/${entry.file}`), entry.language);
    assert.ok(w.ok, `${entry.file}: ${JSON.stringify(w.errors)}`);
    const vm = new VM();
    vm.load([w], { seed: 3 });
    vm.run();
    assert.ok(vm.warriors[0].alive, `${entry.file} killed itself`);
  }
});

test('replicator beats a bomber most of the time', () => {
  const mice = compile(read('warriors/mice.red'));
  const dwarf = compile(read('warriors/dwarf.red'));
  const m = runMatch([mice, dwarf], { rounds: 10 }, { seed: 42 });
  assert.ok(m.warriors[0].wins > m.warriors[1].wins);
});

test('matches are reproducible from a seed', () => {
  const a = compile(read('warriors/scanner.red'));
  const b = compile(read('warriors/vampire.red'));
  const r1 = runMatch([a, b], { rounds: 5 }, { seed: 9 });
  const r2 = runMatch([a, b], { rounds: 5 }, { seed: 9 });
  assert.deepEqual(r1, r2);
});

test('JavaScript generator produces the same program as Redcode', () => {
  const js = compile(read('warriors/dwarf.js'), 'javascript');
  const red = compile(read('warriors/dwarf.red'));
  assert.ok(js.ok, JSON.stringify(js.errors));
  const strip = (w) => w.instructions.map(({ line, ...i }) => i);
  assert.deepEqual(strip(js), strip(red));
  assert.equal(js.start, red.start);
});

// ---- pMARS compatibility (see COMPLIANCE.md and scripts/pmars-compare.js) ----
import { pmarsRng } from '../src/engine/random.js';
import { ringTopology } from '../src/engine/topology.js';
import { roundPoints, pSpaceSizeFor } from '../src/engine/constants.js';

test('pMARS RNG is the Park-Miller minimal standard generator', () => {
  assert.equal(pmarsRng(1), 16807);
  assert.equal(pmarsRng(16807), 282475249);
});

test('ring placement: -F puts warrior 2 there; 3+ warriors keep their distance', () => {
  const ring = ringTopology({ coreSize: 8000, maxLength: 100, minDistance: 100 });
  assert.deepEqual(ring.place(2, 4000 - 100)[0], [0, 4000]);
  for (const seed of [1, 12345, 999999, 2147483646]) {
    for (const count of [3, 4, 6]) {
      const [pos] = ring.place(count, seed);
      assert.equal(pos.length, count);
      for (let i = 0; i < count; i++) for (let j = 0; j < i; j++) assert.ok(ring.distance(pos[i], pos[j]) >= 100, `${seed}/${count}`);
    }
  }
  // A crowded core falls back to even spacing.
  const tight = ringTopology({ coreSize: 400, maxLength: 100, minDistance: 100 });
  const [pos] = tight.place(4, 7);
  for (let i = 0; i < 4; i++) for (let j = 0; j < i; j++) assert.ok(tight.distance(pos[i], pos[j]) >= 100);
});

test('pMARS scoring (W*W-1)/S and P-space size', () => {
  assert.equal(roundPoints(2, 1), 3);
  assert.equal(roundPoints(2, 2), 1);
  assert.equal(roundPoints(3, 1), 8);
  assert.equal(roundPoints(3, 2), 4);
  assert.equal(pSpaceSizeFor({ coreSize: 8000 }), 500);
  assert.equal(pSpaceSizeFor({ coreSize: 55440 }), 3465);
});

test('assembler follows pMARS: trailing labels dropped, one operand only for DAT/JMP/SPL/NOP', () => {
  const w = assemble('ptr DAT #0, #fin-ptr\nfin');
  assert.equal(w.ok, false);
  assert.match(w.warnings[0].message, /discarded, as in pMARS/);
  assert.equal(assemble('JMZ 0').ok, false);
  assert.equal(assemble('JMP 0\nSPL 1\nNOP 0\nDAT 5').ok, true);
});

test('cycle budget: 2 warriors that never die tie after maxCycles turns each', () => {
  const imp = compile('MOV.I $0, $1');
  const vm = new VM({ maxCycles: 500 });
  vm.load([imp, imp], { positions: [0, 4000] });
  vm.run();
  assert.equal(vm.steps, 1000);
  assert.equal(vm.winner, null);
});

// ---- post-mortems ----
import { postMortem } from '../src/engine/report.js';

test('post-mortem names the killing blow and who wrote it', () => {
  const dwarf = compile(read('warriors/dwarf.red'));
  const scout = compile(read('warriors/scanner.red'));
  const vm = new VM();
  vm.load([dwarf, scout], { positions: [0, 3000] });
  vm.run();
  const r = postMortem(vm);
  assert.equal(r.result.outcome, 'win');
  assert.equal(r.result.winner, 'Dwarf');
  assert.equal(r.killingBlow.victim, 'Scout');
  assert.equal(r.killingBlow.cause, 'enemyCode');
  assert.equal(r.killingBlow.codeOwnerName, 'Dwarf');
  assert.match(r.killingBlow.writerInstructionNow, /^MOV\.I/);
  assert.ok(r.timeline.some((e) => e.kind === 'eliminated'));
  const scoutReport = r.warriors[1];
  assert.ok(scoutReport.code.some((c) => c.changed && c.ownerName === 'Dwarf'));
});

test('post-mortem classifies self-inflicted deaths and conversions', () => {
  const vm = new VM();
  vm.load([compile('JMP 2\nDAT #0, #0\nDAT #0, #0')], { positions: [0] });
  vm.run();
  assert.equal(postMortem(vm).warriors[0].lastDeath.cause, 'ownCode');

  const imp = compile(read('warriors/imp.red'));
  const mice = compile(read('warriors/mice.red'));
  const m = runMatch([imp, mice], { rounds: 3 }, { seed: 1, report: true });
  assert.ok(m.rounds.some((rd) => /has been converted/.test(rd.report.summary)));
});

test('trace keeps the last instructions and marks the fatal one', () => {
  const m = runMatch([compile(read('warriors/dwarf.red')), compile(read('warriors/scanner.red'))], { rounds: 1 }, { fixed: 3000, traceRound: 1, traceSize: 10 });
  const t = m.rounds[0].trace;
  assert.equal(t.length, 10);
  assert.equal(t.at(-1).died, 'enemyCode');
});
