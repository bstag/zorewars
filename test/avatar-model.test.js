import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, VM, OP } from '../src/engine/index.js';
import { AvatarModel, damageOf, kindOf } from '../web/avatar-model.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const warrior = (f) => compile(fs.readFileSync(path.join(root, 'warriors', f), 'utf8'));

// Play a battle the way the arena does: steps in small batches, events fed to
// the model, a refresh every "frame" of 16 ms. Stops when `until` holds.
function fight(files, { seed = 7, until = () => false, maxSteps = 300000 } = {}) {
  const vm = new VM({});
  vm.enableEvents();
  vm.load(files.map(warrior), { seed });
  const model = new AvatarModel();
  const hits = [];
  let now = 0;
  while (!vm.done && vm.steps < maxSteps) {
    for (let k = 0; k < 20 && !vm.done; k++) vm.step();
    now += 16;
    model.ingest(vm, vm.takeEvents(), now);
    model.update(vm, now);
    hits.push(...model.takeHits());
    if (until(model, vm)) break;
  }
  return { vm, model, hits };
}

test('avatars: damage depends on what the enemy wrote', () => {
  assert.equal(damageOf(OP.DAT, OP.MOV), 'bombed');
  assert.equal(damageOf(OP.DAT, OP.DAT), 'bombed');
  assert.equal(damageOf(OP.ADD, OP.ADD), 'chipped');
  assert.equal(damageOf(OP.SPL, OP.MOV), 'stunned');
  assert.equal(damageOf(OP.JMP, OP.ADD), 'stunned');
  assert.equal(damageOf(OP.MOV, OP.ADD), 'converted');
  assert.equal(kindOf(OP.SPL), 'arm');
  assert.equal(kindOf(OP.NOP), 'plate');
});

test('avatars: a body is the warrior\'s code, head first', () => {
  const vm = new VM({});
  vm.load([warrior('dwarf.red')], { positions: [100] });
  const model = new AvatarModel();
  model.update(vm, 0);
  const b = model.bodies[0];
  // Dwarf: ORG loop; loop ADD, MOV, JMP, then the bomb DAT.
  assert.deepEqual(b.kind, ['gear', 'claw', 'joint', 'pod']);
  assert.deepEqual(b.cells, [100, 101, 102, 103]);
  assert.deepEqual(model.partAt(102), { w: 0, i: 2 });
  assert.equal(model.partAt(104), null);
});

test('avatars: a warrior alone takes no damage and is never captive', () => {
  const { model } = fight(['dwarf.red'], { maxSteps: 4000 });
  const b = model.bodies[0];
  assert.equal(b.integrity, 1);
  assert.ok(b.damage.every((d) => d === null));
  assert.equal(b.capture, 0);
  assert.equal(b.converted, false);
  assert.equal(b.total, 1);
  assert.ok(b.active[0] > 0, 'the loop has just run');
  assert.equal(b.active[3], 0, 'the bomb is never executed');
});

test('avatars: a core clear smashes the Dwarf and knocks it out', () => {
  const { vm, model, hits } = fight(['sweeper.red', 'dwarf.red']);
  const dwarf = model.bodies[1];
  assert.equal(vm.warriors[1].alive, false);
  assert.ok(dwarf.integrity < 1);
  assert.ok(dwarf.damage.includes('bombed'));
  assert.ok([...dwarf.enemy].some((e) => e === 0));
  assert.ok(hits.some((h) => h.kind === 'bombed' && h.to.w === 1 && h.to.i >= 0 && h.from.w === 0 && h.from.i >= 0),
    'a shot from the instruction that wrote it to the part it hit');
  assert.ok(hits.some((h) => h.kind === 'kill' && h.to.w === 1));
  assert.ok(dwarf.deadAt > 0);
  assert.match(model.status(vm, 1), /^KO at cycle/);
  assert.equal(model.status(vm, 0), '★ winner');
});

test('avatars: stun bombs web the parts they land on', () => {
  const { model, hits } = fight(['stunner.red', 'mice.red'], { until: (m) => m.bodies[1].damage.includes('stunned') });
  assert.ok(model.bodies[1].damage.includes('stunned'));
  assert.ok(model.bodies[1].enemy.includes(0));
  assert.ok(hits.some((h) => h.kind === 'stunned'));
});

test('avatars: a paper\'s copies run away from its body without being captive', () => {
  const { model } = fight(['mice.red', 'dwarf.red'], { until: (m) => m.bodies[0].away > 5, maxSteps: 20000 });
  const mice = model.bodies[0];
  assert.ok(mice.away > 5);
  assert.equal(mice.possessed, 0, 'its copies run its own program');
});

test('avatars: the Imp captures the Seeker, which turns into the Imp', () => {
  const { vm, model } = fight(['silk.red', 'dwarf.red', 'imp.red', 'seeker.red'], { until: (m) => m.bodies[3].morph > 0.95 });
  const seeker = model.bodies[3];
  assert.ok(vm.warriors[3].alive);
  assert.equal(seeker.converted, true);
  assert.equal(seeker.morphTo, 2);
  assert.ok(seeker.capture > 0.4);
  assert.equal(model.status(vm, 3), 'converted → Imp');
});
