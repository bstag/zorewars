import { parentPort, workerData } from 'node:worker_threads';
import { assemble } from '../src/engine/assembler.js';
import { runMatch } from '../src/engine/battle.js';
import { RULESETS } from '../src/engine/constants.js';
import { createHash } from 'node:crypto';

const { files, rules, rounds, seed, members } = workerData;
const settings = { ...RULESETS[rules], rounds };
const warriors = files.map(({ source, filename }) => {
  const warrior = assemble(source, settings);
  if (warrior.name === 'Unnamed') warrior.name = filename;
  return warrior;
});
const errors = warriors.flatMap(({ errors }, index) => errors.slice(0, 2).map(({ line, message }) => ({
  slot: index + 1, line, message,
})));

if (errors.length) {
  parentPort.postMessage({ errors });
} else if (members) {
  const [warrior] = warriors;
  const code = warrior.instructions.map(({ op, mod, aMode, a, bMode, b }) => [op, mod, aMode, a, bMode, b]);
  const id = createHash('sha256').update(JSON.stringify([warrior.start, code])).digest('hex');
  const entry = { id, name: warrior.name.slice(0, 80), source: files[0].source };
  if (members.some(member => member.id === id)) {
    parentPort.postMessage({ duplicate: id });
  } else {
    const matches = members.map(member => {
      const opponent = assemble(member.source, settings);
      if (!opponent.ok) throw new Error('Saved hill warrior failed to assemble');
      const [first, second] = [id, member.id].sort();
      const pair = first === id ? [warrior, opponent] : [opponent, warrior];
      const { warriors: scores } = runMatch(pair, settings, { seed, executionHistory: false });
      return { first, second, rounds, seed, scores: scores.map(({ wins, losses, ties, score }) => ({ wins, losses, ties, score })) };
    });
    parentPort.postMessage({ entry, matches });
  }
} else {
  const { warriors: scores } = runMatch(warriors, settings, { seed, executionHistory: false });
  parentPort.postMessage({ scores });
}
