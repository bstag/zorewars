// Regression tests for the arena fixes: real-time speed, multi-chunk steps,
// generators off the page thread.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceFrame } from '../web/frame-policy.js';
import { createRoundActions } from '../web/round-actions.js';
import { createJsGenerator } from '../web/js-generator.js';
import { canStartEditedRound } from '../web/compile-source.js';

const running = (extra = {}) => ({ vm: { done: false, warriors: [{ alive: true }] }, running: true, livePending: false, stepsPerFrame: 100, carry: 0, liveEpoch: 1, ...extra });

test('speed follows the clock, not the display refresh rate', () => {
  const total = (frameMs) => {
    const state = running();
    let steps = 0;
    for (let now = 0; now <= 1000; now += frameMs) advanceFrame(state, (want) => { steps += want; }, now);
    return steps;
  };
  const at60 = total(1000 / 60), at144 = total(1000 / 144);
  assert.ok(Math.abs(at60 - at144) < at60 * 0.03, `${at60} vs ${at144}`);
  // A long gap (a hidden tab) is not paid back in one burst.
  const state = running();
  const wants = [];
  advanceFrame(state, (want) => wants.push(want), 0);
  advanceFrame(state, (want) => wants.push(want), 60000);
  assert.ok(wants[1] <= 400);
});

function actions(state, live, clock) {
  state.live = live;
  return createRoundActions(state, {
    setStepDisabled() {}, setFinishDisabled() {}, checkDeaths() {}, finishRound() {}, sampleChart() {}, updateCycle() {},
    stopRunning() {}, onError(e) { throw e; }, yieldFrame: async () => {}, now: clock,
  });
}

test('a step larger than one engine chunk repeats until it is met', async () => {
  const state = { vm: { done: false } };
  const asked = [];
  const a = actions(state, { advance: async (n) => { asked.push(n); return Math.min(n, 4096); } }, () => 0);
  assert.equal(await a.step(10000), 10000);
  assert.deepEqual(asked, [10000, 5904, 1808]);
});

test('a step stops at the frame budget and Infinity takes one chunk', async () => {
  const state = { vm: { done: false } };
  let time = 0;
  const a = actions(state, { advance: async () => { time += 10; return 4096; } }, () => time);
  assert.equal(await a.step(1e6), 8192);            // 12 ms budget: two 10 ms chunks
  assert.equal(await a.step(Infinity), 4096);
});

test('a finished round is kept while its code is edited', () => {
  const slots = [{ status: 'ok' }];
  assert.equal(canStartEditedRound({ booting: false, vm: { steps: 500, done: true }, slots }), false);
  assert.equal(canStartEditedRound({ booting: false, vm: { steps: 0, done: false }, slots }), true);
});

function fakeWorker(behaviour) {
  const worker = { terminated: false, terminate() { worker.terminated = true; },
    postMessage(message) { behaviour(message, worker); } };
  return worker;
}

test('generators answer through the worker, one at a time', async () => {
  const generate = createJsGenerator({ createWorker: () => fakeWorker((m, w) => setTimeout(() => w.onmessage({ data: m.source === 'bad'
    ? { id: m.id, error: 'nope' } : { id: m.id, redcode: `; ${m.source}` } }))) });
  const [a, b] = await Promise.all([generate('one', {}), generate('two', {})]);
  assert.deepEqual([a, b], ['; one', '; two']);
  await assert.rejects(generate('bad', {}), /nope/);
  assert.equal(await generate('three', {}), '; three');
});

test('an endless generator is stopped and the next one gets a fresh worker', async () => {
  const made = [];
  const generate = createJsGenerator({ timeoutMs: 20, createWorker: () => {
    const hang = made.length === 0;
    const w = fakeWorker((m, self) => { if (!hang) setTimeout(() => self.onmessage({ data: { id: m.id, redcode: 'ok' } })); });
    made.push(w);
    return w;
  } });
  await assert.rejects(generate('for(;;){}', {}), /endless loop/);
  assert.ok(made[0].terminated);
  assert.equal(await generate('fine', {}), 'ok');
  assert.equal(made.length, 2);
});

test('without workers the generator still runs', async () => {
  const generate = createJsGenerator({ createWorker: () => { throw new Error('no workers'); } });
  assert.match(await generate('name("Solo"); mov(0, 1);', {}), /;name Solo/);
});

test('tournament scoring: winner takes the points, survivors of a tie share, the dead get nothing', async () => {
  const { scoreRound } = await import('../web/tournament.js');
  const stats = [0, 1, 2].map(() => ({ wins: 0, losses: 0, ties: 0, score: 0 }));
  scoreRound(stats, { winner: 1, survivors: [1] });
  scoreRound(stats, { winner: null, survivors: [0, 2] });
  assert.deepEqual(stats.map((s) => [s.wins, s.losses, s.ties]), [[0, 1, 1], [1, 1, 0], [0, 1, 1]]);
  assert.equal(stats[1].score, 8);            // (3*3-1)/1
  assert.equal(stats[0].score, 4);            // (3*3-1)/2
});
