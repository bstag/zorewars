import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, RULESETS } from '../src/engine/index.js';
import { parseTunable, withConstants } from '../tools/tune.js';
import { buildMolting, verifyMolting, clearControl } from '../tools/molting-generator.js';
import { genomeOf } from '../tools/genes.js';

const source = fs.readFileSync(new URL('../examples/experimental-94x/molting-phases.js', import.meta.url), 'utf8');
const old = fs.readFileSync(new URL('../examples/experimental-94x/molting.js', import.meta.url), 'utf8');
const { current } = parseTunable(source);
const settings = { ...RULESETS['94x'], maxLength: 50 };

test('all structures preserve relocation and exact stun/DAT timing in both directions', () => {
  for (let i = 0; i < 8; i++) for (const [PHASE, STUN] of [[0, 512], [1, 32], [1, 4096], [2, 512]]) {
    const P = { ...current, OPENING: i & 1, TRIGGER: (i >> 1) & 1, BACKWARD: (i >> 2) & 1, PHASE, STUN };
    const built = buildMolting(source, P, settings);
    assert.deepEqual(built.w.warnings, []);
    const payloadSize = PHASE === 0 ? 9 : 13;
    const writes = PHASE === 0 ? 0 : PHASE === 2 ? settings.coreSize - payloadSize : STUN;
    assert.equal(built.verification.payloadLength, payloadSize);
    for (const observation of built.verification.observations) {
      assert.equal(observation.phase.stunWrites, writes);
      assert.equal(observation.phase.turnsToKill, PHASE === 0 ? 3 : 2 * writes + 5);
    }
    assert.equal(clearControl(built.w, settings).instructions.length, payloadSize);
    assert.equal(clearControl(built.w, settings, { bare: false }).instructions.length, built.w.instructions.length);
    if (PHASE === 2) {
      const { PHASE: unusedMode, STUN: unusedCount, ...oldP } = P;
      assert.deepEqual(genomeOf(built.w), genomeOf(compile(withConstants(old, oldP), 'javascript', settings)));
    }
  }
});

test('phase checks reject off-by-one stun counts and DAT passes that skip stunned cells', () => {
  const built = buildMolting(source, current, settings);
  const payload = built.w.instructions.length - 13;
  const badCount = structuredClone(built.w);
  badCount.instructions[payload + 1].a++;
  assert.throws(() => verifyMolting(badCount, current, settings), /incorrect stun duration/);
  const badReset = structuredClone(built.w);
  badReset.instructions[payload + 4].a++;
  assert.throws(() => verifyMolting(badReset, current, settings), /DAT did not restart/);
  for (const P of [{ ...current, PHASE: 3 }, { ...current, STUN: 0 }, { ...current, STUN: 4097 }]) {
    assert.equal(compile(withConstants(source, P), 'javascript', settings).ok, false);
  }
});

test('playable direct-DAT specimen matches the template with its stun phase removed', () => {
  const text = fs.readFileSync(new URL('../examples/experimental-94x/molting-direct-dat.js', import.meta.url), 'utf8');
  const P = parseTunable(text).current;
  assert.equal(P.PHASE, 0);
  const built = buildMolting(text, P, settings);
  assert.deepEqual(genomeOf(built.w), genomeOf(buildMolting(source, { ...current, PHASE: 0 }, settings).w));
  assert.equal(built.w.instructions.length, 23);
});
