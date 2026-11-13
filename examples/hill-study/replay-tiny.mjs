import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VM } from '../../src/engine/index.js';
import { gate, link } from '../../tools/algebra/index.js';
import { assemble, tally } from './stateless-replay.mjs';

const [sourceFile, ...opponentFiles] = process.argv.slice(2);
if (!sourceFile) throw new Error('Usage: node examples/hill-study/replay-tiny.mjs little_fluffy_clouds.red [opponent.red ...]');

const settings = {
  coreSize: 800,
  maxCycles: 8000,
  maxLength: 20,
  maxProcesses: 800,
  minDistance: 20,
  pSpaceSize: 50,
  assertErrors: true,
};
const source = readFileSync(sourceFile, 'utf8');
const openingMoves = /^([ \t]*(?:x0[ \t]+)?)mov(?=[ \t]+\{[ \t]*x0[ \t]*\+)/gim;
assert.equal([...source.matchAll(openingMoves)].length, 9);
const original = assemble(source, sourceFile, settings);
const ablation = assemble(source.replace(openingMoves, '$1nop.f'), 'opening ablation', settings);
assert.equal(original.name.toLowerCase(), 'little fluffy clouds');
assert.equal(original.instructions.length, ablation.instructions.length);

const tree = { ...link({ id: 'boot-paper' }, settings), settings };
assert.equal(tree.misfits.length, 0);
tree.w = assemble(tree.source, 'boot-paper', settings);
assert.equal(gate(tree, { verification: 'full' }).ok, true);

function observeBoot(warrior) {
  const vm = new VM(settings);
  vm.load([warrior], { positions: [0] });
  let turns = 0;
  const destination = 760;
  while (vm.processes(0)[0] !== destination && turns < 100) {
    vm.step();
    turns++;
  }
  assert.equal(vm.processes(0)[0], destination);
  const normalize = (value) => (value + settings.coreSize) % settings.coreSize;
  for (let i = 0; i < 6; i++) {
    const { op, mod, aMode, a, bMode, b } = vm.peek(destination + i);
    const expected = warrior.instructions[14 + i];
    assert.deepEqual({ op, mod, aMode, a, bMode, b }, {
      // The final copy predecrements silk1's A-field to zero before reading silk1.
      op: expected.op, mod: expected.mod, aMode: expected.aMode, a: i === 0 ? 0 : normalize(expected.a),
      bMode: expected.bMode, b: normalize(expected.b),
    });
  }
  return { destination, turnsBeforeFirstCopyExecutes: turns };
}

const boot = observeBoot(original);
assert.deepEqual(observeBoot(ablation), boot);
const matches = opponentFiles.map((file) => {
  const opponent = assemble(readFileSync(file, 'utf8'), file, settings);
  return {
    opponent: opponent.name,
    original: tally(original, opponent, settings),
    noOpeningCopies: tally(ablation, opponent, settings),
    catalogBootPaper: tally(tree.w, opponent, settings),
  };
});
console.log(JSON.stringify({ settings, boot, matches }, null, 2));
