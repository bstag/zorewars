import test from 'node:test';
import assert from 'node:assert/strict';
import { Highlights } from '../web/highlights.js';
import { HighlightModel } from '../web/highlight-model.js';
import { compile, VM } from '../src/engine/index.js';

const packet = (...records) => records.flat();
const model = (size = 16) => { const h = new Highlights(); h.reset(size); return h; };

test('heat decays after a first update at timestamp zero', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 0]), 0);
  h.ingest([], 1500);
  assert.equal(h.heat[1], 0.5);
  assert.equal(h.active, false);
});

test('a kill replaces a recent write effect even during its cooldown', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 0]), 100);
  h.ingest(packet([1, 1, 0, 1]), 116);
  assert.equal(h.effects.length, 1);
  assert.equal(h.effects[0].kind, 1);
  assert.equal(h.effects[0].attacker, 1);
});

test('refreshing a cell after cooldown retains at most one visible effect', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 0]), 100);
  h.ingest(packet([1, 1, 0, 0]), 491);
  assert.equal(h.effects.length, 1);
  assert.equal(h.effects[0].t0, 491);
});

test('duplicate or cooling-down kills do not starve other cells of the frame budget', () => {
  for (const cooling of [false, true]) {
    const h = model();
    if (cooling) h.ingest(packet([1, 0, 1, 1]), 100);
    h.ingest([...Array.from({ length: 30 }, () => [1, 0, 1, 1]).flat(), 2, 1, 0, 0], 116);
    assert.deepEqual(h.effects.map(e => e.cell).sort(), [1, 2]);
  }
});

test('a live kill remains visible through later writes until its lifetime ends', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 1]), 100);
  h.ingest(packet([1, 1, 0, 0]), 641);
  assert.equal(h.effects.length, 1);
  assert.equal(h.effects[0].kind, 1);
  assert.equal(h.effects[0].t0, 100);
  h.ingest(packet([1, 1, 0, 0]), 1000);
  assert.equal(h.effects.length, 1);
  assert.equal(h.effects[0].kind, 0);
});

test('same-batch writes and kills keep the first killer and all of their heat', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 0], [1, 1, 0, 1], [1, 2, 0, 1]), 100);
  assert.equal(h.effects.length, 1);
  assert.equal(h.effects[0].kind, 1);
  assert.equal(h.effects[0].attacker, 1);
  assert.equal(h.heat[1], 13);
});

test('sampling keeps kills first and spreads write effects across the full batch', () => {
  const h = model(128);
  const writes = Array.from({ length: 100 }, (_, cell) => [cell, 0, 1, 0]).flat();
  h.ingest([...writes, 100, 1, 0, 1, 101, 1, 0, 1], 100);
  assert.equal(h.effects.length, 24);
  assert.deepEqual(h.effects.slice(0, 2).map(e => e.cell), [100, 101]);
  const sampled = h.effects.filter(e => e.kind === 0).map(e => e.cell);
  assert.equal(sampled.length, 22);
  assert.equal(Math.min(...sampled), 0);
  assert.ok(Math.max(...sampled) >= 90);
  assert.equal(h.heat[99], 1, 'unshown events still contribute heat');
  assert.equal(h.hottest(), 100);
  const kills = model(64);
  kills.ingest([...Array.from({ length: 30 }, (_, cell) => [cell, 0, 1, 1]).flat(), 40, 1, 0, 0], 100);
  assert.equal(kills.effects.length, 24);
  assert.ok(kills.effects.every(e => e.kind === 1));
});

test('active effects remain bounded and an evicted cell has no stale cooldown', () => {
  const h = model(256);
  for (let frame = 0; frame < 8; frame++) {
    h.ingest(Array.from({ length: 24 }, (_, k) => [frame * 24 + k, 0, 1, 0]).flat(), 100 + frame * 10);
  }
  assert.equal(h.effects.length, 140);
  assert.equal(new Set(h.effects.map(e => e.cell)).size, 140);
  assert.ok(!h.effects.some(e => e.cell === 0));
  h.ingest(packet([0, 1, 0, 0]), 181);
  assert.equal(h.effects.length, 140);
  assert.ok(h.effects.some(e => e.cell === 0 && e.t0 === 181));
  h.ingest(null, 5000);
  assert.equal(h.active, false);
  assert.equal(h.effects.length, 0);
});

test('cooldowns suppress repeated flashes without losing heat', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 0], [2, 0, 1, 1]), 100);
  h.ingest(packet([1, 0, 1, 0], [2, 0, 1, 1]), 116);
  assert.equal(h.effects.length, 2);
  assert.ok(h.effects.every(e => e.t0 === 100));
  assert.ok(h.heat[1] > 1.9);
  assert.ok(h.heat[2] > 11.9);
  h.ingest(packet([2, 0, 1, 1]), 640);
  assert.equal(h.effects.filter(e => e.cell === 2).length, 1);
  assert.equal(h.effects.find(e => e.cell === 2).t0, 640);
});

test('incomplete and invalid packets cannot create effects or poison the heat map', () => {
  const h = model(8);
  h.ingest(packet([-1, 0, 1, 0], [8, 0, 1, 0], [1.5, 0, 1, 0], [NaN, 0, 1, 0],
    [1, -1, 0, 0], [1, 0.5, 0, 0], [1, NaN, 0, 0], [1, 0, 0, 2], [2, 0, 1, 0]).concat([3, 0]), 100);
  assert.deepEqual(h.effects.map(e => e.cell), [2]);
  assert.equal([...h.heat].reduce((sum, value) => sum + value, 0), 1);
  assert.ok([...h.heat].every(Number.isFinite));
  const empty = new HighlightModel();
  empty.ingest(new Uint32Array([0, 0, 1, 1]), 100);
  assert.equal(empty.active, false);
  empty.ingest(undefined, 200);
});

test('heat thresholds, fading and reset remain independent of visible effects', () => {
  const h = model(8);
  h.heat[0] = 0.005;
  h.heat[2] = 2;
  h.heat[3] = 4;
  h.heat[5] = 4;
  assert.equal(h.hottest(4), -1);
  assert.equal(h.hottest(2), 3);
  h.ingest([], 0);
  h.ingest([], 1500);
  assert.equal(h.heat[0], 0);
  assert.equal(h.heat[3], 2);
  assert.equal(h.hottest(), -1);
  h.reset(4);
  assert.equal(h.size, 4);
  assert.equal(h.heat.length, 4);
  assert.equal(h.active, false);
  assert.equal(h.hottest(0), -1);
  h.ingest(new Uint32Array([3, 0, 1, 1]), 0);
  assert.equal(h.heat[3], 6);
});

test('real VM write and death packets produce a visible kill on successive frames', () => {
  const settings = { coreSize: 80, maxCycles: 20, maxLength: 10, minDistance: 10 };
  const vm = new VM(settings);
  vm.enableEvents();
  vm.load([compile(';name Writer\nMOV.I 1, 10\nDAT 0, 0', 'redcode', settings), compile(';name Wait\nJMP 0', 'redcode', settings)], { positions: [0, 10] });
  const h = model(vm.size);
  vm.step();
  const write = vm.takeEvents();
  assert.deepEqual(write, [10, 0, 1, 0]);
  h.ingest(write, 100);
  vm.step();
  const kill = vm.takeEvents();
  assert.deepEqual(kill, [10, 0, 1, 1]);
  h.ingest(kill, 116);
  assert.deepEqual(h.effects.map(({ cell, kind, attacker }) => ({ cell, kind, attacker })), [{ cell: 10, kind: 1, attacker: 0 }]);
  assert.ok(h.heat[10] > 6.9);
});

function recordingContext() {
  const commands = [], ctx = { globalAlpha: 0.3 };
  for (const name of ['beginPath', 'arc', 'fill', 'stroke', 'moveTo', 'lineTo']) {
    ctx[name] = function (...args) { commands.push({ name, args, alpha: this.globalAlpha, stroke: this.strokeStyle, fill: this.fillStyle }); };
  }
  return { ctx, commands };
}

test('Canvas adapter draws colored writes, handles missing projections and restores alpha', () => {
  const h = model();
  h.ingest(packet([1, 5, 0, 0]), 100);
  const { ctx, commands } = recordingContext();
  h.draw(ctx, 100, () => [10, 20, 0], ['#111111', '#222222']);
  assert.equal(commands.filter(c => c.name === 'arc').length, 1);
  assert.equal(commands.find(c => c.name === 'stroke').stroke, '#222222');
  assert.equal(commands.find(c => c.name === 'stroke').alpha, 0.9);
  assert.equal(ctx.globalAlpha, 1);
  commands.length = 0;
  h.draw(ctx, 100, () => null, []);
  assert.equal(commands.length, 0);
  assert.equal(ctx.globalAlpha, 1);
  h.draw(ctx, 100, () => [0, 0, 1], []);
  assert.equal(commands.find(c => c.name === 'stroke').stroke, '#ffffff');
});

test('Canvas adapter emits a kill flash and eight finite spark segments, fading to red', () => {
  const h = model();
  h.ingest(packet([1, 0, 1, 1]), 100);
  for (const now of [100, 600, 1000]) {
    const { ctx, commands } = recordingContext();
    h.draw(ctx, now, () => [10, 20, 3], ['#ff0000']);
    assert.equal(commands.filter(c => c.name === 'fill').length, 1);
    assert.equal(commands.filter(c => c.name === 'moveTo').length, 8);
    assert.equal(commands.filter(c => c.name === 'lineTo').length, 8);
    assert.equal(commands.find(c => c.name === 'stroke').stroke, now === 100 ? '#ffffff' : '#fca5a5');
    assert.ok(commands.every(c => c.args.every(Number.isFinite)));
    assert.ok(commands.every(c => c.alpha >= 0 && c.alpha <= 1));
    assert.equal(ctx.globalAlpha, 1);
  }
});
