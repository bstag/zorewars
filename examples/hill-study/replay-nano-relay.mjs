import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound } from '../../src/engine/battle.js';
import { buildTree } from '../../tools/algebra/index.js';
import { assemble, tally } from './stateless-replay.mjs';

const files = process.argv.slice(2);
if (!files.length) throw new Error('Usage: node examples/hill-study/replay-nano-relay.mjs opponent.red [...]');

const built = buildTree({ id: 'nano-relay-clear' }, { rules: 'nano', verification: 'full' });
const { settings, source, w, labels, root } = built;
const primeOff = source.replace(/^(b0prime )MOV\.I/m, '$1NOP.F');
assert.notEqual(primeOff, source);
const noPrime = assemble(primeOff, 'prime suppressed', settings);

function keepCursorB(warriors, settings, options) {
  const round = createRound(warriors, settings, options);
  const { vm } = round;
  const base = options.positions[0];
  const feed = vm.norm(base + labels.b0feed);
  const strike = vm.norm(base + labels.b0strike);
  const cursor = vm.norm(feed + root.P.CURSOR);
  while (!vm.done) {
    const hitsCursor = vm.turn === 0 && vm.processes(0)[0] === strike
      && vm.norm(feed + vm.peek(feed).b) === cursor;
    const previousB = hitsCursor ? vm.peek(cursor).b : null;
    vm.step();
    if (hitsCursor && vm.lastWrite[cursor] === vm.steps && vm.writerPc[cursor] === strike) {
      const cell = vm.peek(cursor);
      if (cell.b !== previousB) vm.poke(cursor, { ...cell, b: previousB }, vm.owner[cursor]);
    }
  }
  return round.finish();
}

const results = files.map(file => {
  const opponent = assemble(readFileSync(file, 'utf8'), file, settings);
  return {
    opponent: opponent.name,
    original: tally(w, opponent, settings),
    noPrime: tally(noPrime, opponent, settings),
    cursorBHeld: tally(w, opponent, settings, keepCursorB),
  };
});
console.log(JSON.stringify(results, null, 2));
