import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, RULESETS } from '../src/engine/index.js';
import { buildRecipe, emitRecipe, verifyRecipe, recipeDefaults, recipeGenerator } from '../tools/blocks/recipes.js';
import { inspectSource } from '../tools/blocks/inventory.js';
import { blocks, instructionCatalog } from '../tools/blocks/catalog.js';
import { parseTunable, withConstants } from '../tools/tune.js';

for (const rules of Object.keys(RULESETS)) {
  test(`block contracts: ${rules}, both directions, every phase and opening`, () => {
    for (const BACKWARD of [0, 1]) for (const PHASE of [0, 1, 2]) for (const OPENING of [0, 1, 2]) {
      const built = buildRecipe({ ...recipeDefaults, BACKWARD, PHASE, OPENING }, { rules });
      assert.ok(built.w.instructions.length <= 50);
      assert.equal(built.verification.observations.length, 2);
      for (const observation of built.verification.observations) assert.equal(observation.stunWrites, PHASE === 0 ? 0 : PHASE === 1 ? recipeDefaults.STUN : built.settings.coreSize - built.payloadLength);
    }
  });
}
test('in-place controls, extreme timer/step/hop/stun and wrapping loads remain safe', () => {
  for (const rules of ['88', '94x']) for (const BACKWARD of [0, 1]) for (const RELOCATE of [0, 1]) {
    buildRecipe({ ...recipeDefaults, BACKWARD, RELOCATE, WAIT: 768, STEP: 1, HOP: 256, STUN: 4096 }, { rules });
    buildRecipe({ ...recipeDefaults, BACKWARD, RELOCATE, WAIT: 1, STEP: 2048, HOP: 7000, STUN: 1 }, { rules });
  }
});
test('behavior gate rejects a broken copy, wrong stun duration and ineffective opening', () => {
  for (const [from, to] of [['<copySource, <copyTarget', 'copySource, <copyTarget'], ['#64, remaining', '#63, remaining'], ['SLT.AB', 'SLT.B']]) {
    const b = emitRecipe(recipeDefaults);
    assert.ok(b.source.includes(from));
    b.source = b.source.replace(from, to); b.w = compile(b.source, 'redcode', b.settings);
    assert.throws(() => verifyRecipe(b), /copy|stun|phase|coverage/i);
  }
});
test('plain controls contain only the payload, with no startup wrapper', () => {
  for (const PHASE of [0,1,2]) {
    const b = buildRecipe({ ...recipeDefaults, OPENING: 0, RELOCATE: 0, PHASE });
    assert.equal(b.payloadStart, 0);
    assert.equal(b.w.start, 0);
    assert.equal(b.w.instructions.length, PHASE ? 13 : 9);
  }
});
test('contract rejects unknown dialect, too-small budget, malformed parameters', () => {
  assert.throws(() => buildRecipe(recipeDefaults, { rules: '86' }), /Unsupported/);
  assert.throws(() => buildRecipe(recipeDefaults, { length: 10 }), /budget/);
  assert.throws(() => buildRecipe({ ...recipeDefaults, HOP: 0 }), /HOP/);
  assert.throws(() => buildRecipe({ ...recipeDefaults, SHARED: 2 }), /Unexpected/);
});
test('standalone generators preserve all composed instructions after parameter tuning', () => {
  for (const rules of ['88', '94x']) {
    const source = recipeGenerator(recipeDefaults, { rules, length: 50 });
    assert.deepEqual(parseTunable(source).current, recipeDefaults);
    const P = { ...recipeDefaults, BACKWARD: 1, OPENING: 2, PHASE: 0, HOP: 7000 };
    const b = buildRecipe(P, { rules });
    const c = compile(withConstants(source, P), 'javascript', b.settings);
    assert.equal(c.ok, true, JSON.stringify(c.errors));
    const code = w => w.instructions.map(({ line, ...instruction }) => instruction);
    assert.deepEqual(code(c), code(b.w));
    assert.equal(c.start, b.w.start);
  }
});
test('inventory records section dependencies without treating labels as safe blocks', () => {
  const result = inspectSource(';name Example\nstart MOV bomb, @ptr\n JMP start\nptr DAT #0, #5\nbomb DAT #0, #0\nEND start');
  assert.equal(result.sections[0].line, 2);
  assert.deepEqual(result.sections[0].references, ['ptr', 'bomb']);
  assert.ok(result.sections.every(x => x.status === 'candidate-boundary'));
  assert.deepEqual(inspectSource("label('scan'); jmz.b('scan', ind('ptr'));", 'javascript').opcodes, ['JMZ']);
});
test('catalog references exist and instruction table covers engine opcodes', () => {
  for (const b of blocks) for (const file of b.sources) assert.ok(fs.existsSync(new URL('../' + file, import.meta.url)), file);
  assert.equal(blocks.filter(b => b.selectable).length, 7);
  assert.equal(instructionCatalog().instructions.length, 19);
});
