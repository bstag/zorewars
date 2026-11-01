import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarView } from '../web/avatars.js';
import { AvatarModel } from '../web/avatar-model.js';
import { spine, positionAvatar } from '../web/avatar-layout.js';
import { WARRIOR_COLORS, setColorSlots } from '../web/arena.js';
import { compile, VM } from '../src/engine/index.js';

const settings = { coreSize: 80, maxCycles: 10, maxLength: 10, minDistance: 10, maxProcesses: 16 };

function load(sources, positions) {
  const vm = new VM(settings);
  vm.load(sources.map(source => compile(source, 'redcode', settings)), { positions });
  return vm;
}

function recordingView(time = 100, width = 800) {
  const clock = { time }, commands = [], listeners = new Map();
  const ctx = { globalAlpha: 1 };
  for (const name of ['setTransform', 'beginPath', 'closePath', 'arc', 'ellipse', 'fill', 'stroke', 'fillRect', 'fillText', 'moveTo', 'lineTo', 'quadraticCurveTo', 'rect']) {
    ctx[name] = function (...args) { commands.push({ name, args, fill: this.fillStyle, stroke: this.strokeStyle, alpha: this.globalAlpha }); };
  }
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  const rect = { left: 10, top: 20, width: width || 800, height: Math.round((width || 800) * 0.62) };
  const canvas = { style: {}, parentElement: { clientWidth: width }, getContext: () => ctx,
    addEventListener: (name, handler) => listeners.set(name, handler), getBoundingClientRect: () => rect };
  return { view: new AvatarView(canvas, { now: () => clock.time }), clock, commands, listeners, canvas, ctx, rect };
}

function finiteDrawing(commands) {
  assert.ok(commands.length > 0);
  for (const command of commands) {
    assert.ok(command.args.filter(value => typeof value === 'number').every(Number.isFinite), command.name);
    assert.ok(command.alpha >= 0 && command.alpha <= 1, `${command.name}: invalid alpha`);
    assert.doesNotMatch(String(command.fill), /NaN|Infinity/);
    assert.doesNotMatch(String(command.stroke), /NaN|Infinity/);
    if (command.name === 'arc') assert.ok(command.args[2] >= 0);
    if (command.name === 'ellipse') assert.ok(command.args[2] >= 0 && command.args[3] >= 0);
  }
}

test('avatar death time remains zero when a later census is requested', () => {
  const vm = load(['DAT 0, 0'], [0]);
  vm.run();
  const model = new AvatarModel();
  model.update(vm, 0, 100);
  assert.equal(model.bodies[0].deadAt, 0);
  model.update(vm, 200, 101);
  assert.equal(model.bodies[0].deadAt, 0);
});

test('conversion smoothing does not advance when the clock remains at zero', () => {
  const vm = load([';name Wait\nJMP 0', ';name Imp\nMOV.I 0, 1'], [3, 0]);
  vm.run();
  const model = new AvatarModel();
  model.update(vm, 0);
  assert.equal(model.bodies[0].share, 1);
  const capture = model.bodies[0].capture;
  model.update(vm, 0);
  assert.equal(model.bodies[0].capture, capture);
});

test('equally close overlapping parts select the one drawn on top', () => {
  const view = Object.create(AvatarView.prototype);
  view.canvas = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 100 }) };
  view.w = 100; view.h = 100;
  view.hits = [{ x: 50, y: 50, r: 10, cell: 1 }, { x: 50, y: 50, r: 10, cell: 2 }];
  assert.equal(view.addressAt(60, 70), 2);
});

test('small pointer moves accumulate into a drag instead of becoming an accidental selection', () => {
  const listeners = new Map();
  const canvas = { getContext: () => ({}), addEventListener: (name, handler) => listeners.set(name, handler) };
  const view = new AvatarView(canvas);
  view.active = true;
  listeners.get('pointerdown')({ clientX: 10 });
  for (let i = 1; i <= 20; i++) listeners.get('pointermove')({ clientX: 10 + i * 0.5 });
  listeners.get('pointerup')({});
  assert.ok(view.dragYaw > 0);
  assert.equal(view.consumeDrag(), true);
  assert.equal(view.consumeDrag(), false);
});

test('flat view paints every opcode shape and uses its rendered coordinates for selection', () => {
  const vm = load([';name Shapes\nSPL 0\nMOV 0,1\nADD #1,1\nJMP 0\nJMZ 0,1\nDAT 0,0\nNOP'], [0]);
  const f = recordingView();
  f.view.draw(vm, 100);
  const body = f.view.bodies[0];
  assert.deepEqual(body.kind, ['arm', 'claw', 'gear', 'joint', 'eye', 'pod', 'plate']);
  assert.equal(f.view.hits.length, body.cells.length);
  assert.equal(f.view.addressAt(f.rect.left + body.screen[0], f.rect.top + body.screen[1]), 0);
  assert.equal(f.view.addressAt(-1000, -1000), -1);
  f.view.pinned = 0; f.view.hover = 1;
  f.clock.time = 600;
  f.view.draw(vm, 100);
  assert.ok(f.commands.some(command => command.name === 'stroke' && command.stroke === '#ffffff'));
  finiteDrawing(f.commands);
  assert.equal(f.ctx.globalAlpha, 1);
});

test('body geometry is finite for small warriors and long coiled programs', () => {
  for (const count of [1, 8, 9, 100]) {
    const shape = spine(count);
    assert.equal(shape.seg.length, count);
    assert.ok(shape.r > 0);
    assert.ok(shape.seg.every(point => point.every(Number.isFinite)));
    const body = { ...shape, cells: Array.from({ length: count }, (_, i) => i), screen: new Float32Array(count * 3), base: [200, 300], scale: 100, face: -1, shake: -Infinity, deadAt: null };
    positionAvatar(body, 0, true, 100);
    assert.ok([...body.screen].every(Number.isFinite));
    assert.ok(body.screen[2] > 0);
    assert.deepEqual(body.center, [200, 245]);
  }
});

test('a hit at timestamp zero shakes the body and a zero-time death collapses correctly', () => {
  const body = { ...spine(1), cells: [0], screen: new Float32Array(3), base: [200, 300], scale: 100, face: 1, shake: 0, deadAt: null };
  positionAvatar(body, 0, true, 100);
  assert.notEqual(body.screen[0], 200);
  body.shake = -Infinity;
  positionAvatar(body, 0, true, 100);
  assert.equal(body.screen[0], 200);
  const vm = load(['DAT 0, 0'], [0]), f = recordingView(0);
  vm.run();
  f.view.draw(vm, 100);
  const before = f.view.bodies[0].screen[1];
  assert.ok(f.commands.some(command => String(command.fill).startsWith('rgba(71,85,105,')), 'death color applies immediately');
  f.clock.time = 900;
  f.view.draw(vm, 100);
  assert.equal(f.view.bodies[0].deadAt, 0);
  assert.ok(f.view.bodies[0].screen[1] > before);
  finiteDrawing(f.commands);
});

test('real writes choose bombed, stunned, chipped and converted part drawing', t => {
  for (const [kind, payload, original, method] of [
    ['bombed', 'DAT #0,#0', 'JMP 0', 'drawBombed'],
    ['stunned', 'SPL 0', 'JMP 0', 'drawWeb'],
    ['chipped', 'MOV 2,3', 'MOV 0,1', 'drawChips'],
    ['converted', 'MOV 0,1', 'JMP 0', 'drawPart'],
  ]) {
    const vm = load([`;name Writer\nMOV.I 2,10\nJMP 0\n${payload}`, `;name Victim\n${original}`], [0, 10]);
    vm.enableEvents(); vm.step();
    const f = recordingView(), calls = [], draw = f.view[method].bind(f.view);
    t.mock.method(f.view, method, (...args) => { calls.push(args); return draw(...args); });
    f.view.ingest(vm, vm.takeEvents(), f.clock.time);
    f.view.draw(vm, 100);
    const body = f.view.bodies[1], x = body.screen[0];
    assert.equal(body.damage[0], kind);
    const call = calls.find(args => (method === 'drawPart' ? args[1] : args[0]) === x);
    assert.ok(call, `${kind} draw path used`);
    if (kind === 'converted') assert.equal(call[5], WARRIOR_COLORS[0]);
    assert.equal(f.view.flying.length, 1);
    finiteDrawing(f.commands);
  }
});

test('captured avatars morph into their captor while preserving finite draw output', t => {
  const vm = load([';name Writer\nMOV.I 2,10\nJMP 0\nMOV 0,1', ';name Victim\nJMP 0'], [0, 10]);
  vm.step();
  const f = recordingView(), ghosts = [], draw = f.view.drawGhost.bind(f.view);
  t.mock.method(f.view, 'drawGhost', (...args) => { ghosts.push(args); return draw(...args); });
  for (const now of [100, 350, 600]) { f.clock.time = now; f.view.draw(vm, 100); }
  assert.ok(f.view.bodies[1].morph > 0.5);
  assert.equal(f.view.bodies[1].morphTo, 0);
  assert.ok(ghosts.length > 0);
  assert.ok(f.commands.some(command => command.name === 'fillText' && String(command.args[0]).includes('converted → Writer')));
  finiteDrawing(f.commands);
});

test('away and captive processes orbit in the correct warrior colors', () => {
  setColorSlots([]);
  const vm = load([';name Away\nSPL 10\nDAT 0,0', ';name Imp\nMOV 0,1'], [0, 10]);
  vm.step();
  const f = recordingView();
  f.view.draw(vm, 100);
  assert.equal(f.view.bodies[0].away, 1);
  assert.equal(f.view.bodies[0].possessed, 1);
  assert.ok(f.commands.some(command => command.name === 'fill' && command.fill === WARRIOR_COLORS[1]));
  finiteDrawing(f.commands);
});

test('dead opponents and multi-warrior stage positions render without invalid coordinates', () => {
  const vm = load([';name Winner\nJMP 0', ';name Out\nDAT 0,0', ';name Gone\nDAT 0,0'], [0, 20, 40]);
  vm.run();
  const f = recordingView();
  f.view.draw(vm, 100);
  assert.ok(f.commands.some(command => command.name === 'fillText' && command.args[0] === '★ winner'));
  assert.ok(f.view.bodies.every(body => body.face === 1 || body.face === -1));
  finiteDrawing(f.commands);
});

test('projectiles land, flash and expire on their wall-clock timeline', () => {
  for (const payload of ['DAT 0,0', 'SPL 0', 'MOV 0,1', 'ADD #1,1']) {
    const vm = load([`MOV.I 2,10\nJMP 0\n${payload}`, 'JMP 0'], [0, 10]);
    vm.enableEvents(); vm.step();
    const f = recordingView();
    f.view.ingest(vm, vm.takeEvents(), 100);
    f.view.draw(vm, 100);
    f.clock.time = 200; f.view.draw(vm, 100);
    f.clock.time = 550; f.view.draw(vm, 100);
    assert.equal(f.view.flying.length, 0);
    assert.equal(f.view.impacts.length, 1);
    assert.equal(f.view.impacts[0].t0, 520);
    f.clock.time = 600; f.view.draw(vm, 100);
    f.clock.time = 1300; f.view.draw(vm, 100);
    assert.equal(f.view.impacts.length, 0);
    finiteDrawing(f.commands);
  }
});

test('a delayed frame cannot revive an old projectile impact or body hit flash', () => {
  const vm = load(['MOV.I 2,10\nJMP 0\nDAT 0,0', 'JMP 0'], [0, 10]);
  vm.enableEvents(); vm.step();
  const f = recordingView();
  f.view.ingest(vm, vm.takeEvents(), 100);
  f.view.draw(vm, 100);
  f.clock.time = 5000;
  f.view.draw(vm, 100);
  assert.equal(f.view.impacts.length, 0);
  assert.equal(f.view.bodies[1].lastHit[0], -Infinity);
});

test('real off-body hits and kills animate at the avatar center without false body flashes', () => {
  const vm = load([';name Bomber\nNOP\nNOP\nMOV.I 2,10\nJMP 0\nDAT 0,0', ';name Imp\nMOV.I 0,1'], [0, 10]);
  vm.enableEvents();
  for (let i = 0; i < 5; i++) vm.step();
  const write = vm.takeEvents();
  assert.deepEqual(write, [12, 0, 1, 0]);
  const f = recordingView();
  f.view.active = true;
  f.view.ingest(vm, write, 100);
  assert.equal(f.view.flying[0].minor, true);
  assert.equal(f.view.flying[0].to.i, -1);
  assert.equal(f.view.animating, true);
  f.view.draw(vm, 100);
  vm.step();
  const kill = vm.takeEvents();
  assert.deepEqual(kill, [12, 0, 1, 1]);
  f.clock.time = 116;
  f.view.ingest(vm, kill, 116);
  f.view.draw(vm, 100);
  assert.ok(f.commands.some(command => command.name === 'fill' && command.fill === 'rgba(255, 255, 255, 0.8)'));
  f.clock.time = 550; f.view.draw(vm, 100);
  f.clock.time = 600; f.view.draw(vm, 100);
  assert.equal(f.view.bodies[1].lastHit[0], -Infinity);
  assert.ok(f.view.impacts.some(impact => impact.minor));
  finiteDrawing(f.commands);
});

test('expired impacts are removed before painting and missing endpoints are discarded', t => {
  const f = recordingView(), vm = load(['JMP 0'], [0]);
  f.view.draw(vm, 100);
  f.view.impacts.push({ to: { w: 0, i: 0 }, attacker: 0, kind: 'kill', t0: 0 });
  f.view.flying.push({ from: { w: 99, i: -1 }, to: { w: 0, i: 0 }, attacker: 0, kind: 'converted', t0: 100 });
  const draw = t.mock.method(f.view, 'drawImpact', () => assert.fail('expired impact must not paint'));
  f.clock.time = 1000;
  f.view.draw(vm, 100);
  assert.equal(draw.mock.callCount(), 0);
  assert.equal(f.view.flying.length, 0);
});

test('drag lifecycle, stationary jitter, pending impacts and coordinate zero keep their meanings', () => {
  const f = recordingView(10000);
  f.view.active = true;
  assert.equal(f.view.animating, false);
  f.listeners.get('pointerdown')({ clientX: 0 });
  assert.equal(f.view.animating, true);
  for (const clientX of [0.5, 0.1, -0.4]) f.listeners.get('pointermove')({ clientX });
  assert.equal(f.view.consumeDrag(), false);
  for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
    f.listeners.get(event)({});
    assert.equal(f.view.pointer, null);
    f.listeners.get('pointerdown')({ clientX: 0 });
  }
  f.listeners.get('pointerup')({});
  f.clock.time = 20000;
  assert.equal(f.view.animating, false);
  f.view.impacts.push({ t0: f.clock.time });
  assert.equal(f.view.animating, true);
  f.view.active = false;
  f.listeners.get('pointermove')({ clientX: 500 });
  assert.equal(f.view.animating, false);
});

test('layout caps device pixels and hit testing handles a scaled client rectangle', t => {
  const oldRatio = globalThis.devicePixelRatio;
  t.after(() => { if (oldRatio === undefined) delete globalThis.devicePixelRatio; else globalThis.devicePixelRatio = oldRatio; });
  globalThis.devicePixelRatio = 3;
  const f = recordingView(100, 0), vm = load(['JMP 0'], [0]);
  f.view.draw(vm, 100);
  assert.equal(f.canvas.width, 1600);
  const body = f.view.bodies[0];
  f.rect.width /= 2; f.rect.height /= 2;
  assert.equal(f.view.addressAt(f.rect.left + body.screen[0] / 2, f.rect.top + body.screen[1] / 2), 0);
});
