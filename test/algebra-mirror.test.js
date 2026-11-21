import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { switchChoice } from '../tools/algebra/link.js';

const paper = { id: 'boot', P: { HOP: 12600 }, kids: [{ id: 'paper', P: { PSTEP: 718, PDELTA: 725 } }] };
const sweep = { id: 'boot', P: { HOP: 12600, DIRECT: 1 }, kids: [{ id: 'sweep', P: { G: 7, STEPF: 8600, STARTF: 6100, CLR: 0, TRIP: 0, LAPF: 34 } }] };

test('switch POLICY 3 moves on after a win and keeps its member after a loss or a tie', () => {
  assert.equal(switchChoice(3, 2, -1, 0, 0), 0, 'first round');
  assert.equal(switchChoice(3, 2, 1, 0, 0), 1, 'a win moves on');
  assert.equal(switchChoice(3, 2, 1, 1, 0), 0);
  assert.equal(switchChoice(3, 2, 0, 1, 0), 1, 'a loss keeps');
  assert.equal(switchChoice(3, 2, 2, 0, 0), 0, 'a tie keeps');
  // With TIES t the t-th tie in a row also moves on (the mirror has lost step).
  assert.equal(switchChoice(3, 2, 2, 0, 0, 3, 1), 0);
  assert.equal(switchChoice(3, 2, 2, 0, 0, 3, 2), 1);
  assert.equal(switchChoice(0, 2, 2, 0, 0, 3, 2), 1, 'POLICY 0 still scores it as a loss');
});

test('a switch nested in switch-score passes the gate, its histories checked against the model', () => {
  const tree = { id: 'switch-score', P: { CELL: 20, FIRST: 1, HOLD: 1 }, kids: [sweep, { id: 'switch', P: { CELL: 60, POLICY: 3, TIES: 4 }, kids: [paper, JSON.parse(JSON.stringify(sweep))] }] };
  const t = buildTree(tree, { rules: 'modelwar', length: 600 });
  assert.equal(t.verification.ok, true, JSON.stringify(t.verification.issues ?? t.verification));
});
