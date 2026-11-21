import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, recipes } from '../tools/algebra/index.js';
import { compile, RULESETS } from '../src/engine/index.js';
import { strip } from '../tools/hill.js';

const options = { rules: '88', length: 100, verification: 'full' };

function expectProgram(tree, source) {
  const built = buildTree(tree, options);
  const expected = compile(source, 'redcode', RULESETS['88']);
  assert.equal(expected.ok, true);
  const { start, instructions } = strip(expected);
  assert.deepEqual(strip(built.w).instructions, instructions);
  assert.equal(built.w.start, start);
}

test('the Gymnosperm seed matches the published five-cell program', () => {
  expectProgram(recipes['gymnosperm-88'].tree(), `
    spl 0, <-2
    spl 0, <-3
    mov 1, <1
    mov <0, <3432
    djn -2, <-6
    end 0
  `);
});

test('Iron Sword preserves the original and distance-54 variant bytecode', () => {
  for (const gap of [34, 54]) {
    expectProgram({ id: 'iron-sword-88', P: { GAP: gap } }, `
      sub 11, @5
      cmp ${gap}, 0
      slt #20, @3
      djn -3, 4
      mov 3, @-3
      mov 3, <-4
      sub 3, -5
      jmn @-1, #-20
      spl 0
      mov @-${gap}, <-${gap + 1}
      sub #2666, @-1
      dat <-${2 * gap}, <-${2 * gap}
      end 0
    `);
  }
});

test('the booted bomber and quickscan-to-Iron Sword pass full verification', () => {
  const bomber = buildTree(recipes['gymnosperm-boot-88'].tree(), options);
  assert.equal(bomber.total, 11);
  const scanner = buildTree(recipes['iron-sword-q2-88'].tree(), options);
  assert.equal(scanner.total, 38);
  const scenarios = scanner.verification.observations.map(({ scenario }) => scenario);
  assert.ok(scenarios.includes('opening-q2-stun-88: planted target'));
  assert.ok(scenarios.includes('iron-sword-88: planted target'));
});
