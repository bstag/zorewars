import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, link, recipes } from '../tools/algebra/index.js';
import { compile, RULESETS, VM } from '../src/engine/index.js';

const settings = RULESETS['88'];
const build = (id, P) => buildTree({ id, P }, { rules: '88', length: 100, verification: 'full' });
const tinyLoop = compile('JMP 0\nEND 0', 'redcode', settings);

test('the extended launches still deploy after numeric changes', () => {
  assert.equal(build('repeat-burst-imp-88', { FAN: 3, POINTS: 7, SHIFT: 260 }).total, 10);
  assert.equal(build('leviathan-launch-88', { FAN: 2, START: 160 }).total, 27);
});

test('Iron Trap enters the spiral stun only for its exact imp template', () => {
  const tree = build('iron-trap-88', { STUN: 24 });
  const ordinaryMov = { ...tinyLoop.instructions[0], op: 'MOV', mod: 'I', b: 2666 };
  const imp = { ...ordinaryMov, b: 2667 };
  const compare = tree.labels.b0compare, spiral = tree.labels.b0spiral;
  const strikes = compare + 195;
  function phase(target) {
    const vm = new VM(settings);
    vm.load([tree.w], { positions: [0] });
    vm.poke(strikes, { ...imp, b: 12 });
    vm.poke(strikes + 98, target);
    let visits = 0;
    while (vm.cycle < 85 && !vm.done) {
      if (vm.step().pc === spiral) visits++;
    }
    return visits;
  }
  assert.equal(phase(imp), 24);
  assert.equal(phase(ordinaryMov), 0);
});

test('Tangle Trap’s deployed pit fills the process table and then releases it', () => {
  const limited = { ...settings, maxProcesses: 8 };
  const linked = link({ id: 'tangle-trap-88' }, limited);
  const compiled = compile(linked.source, 'redcode', limited);
  assert.equal(compiled.ok, true);
  const first = linked.labels.b0pit;
  const pit = { ...compiled, start: 0, instructions: compiled.instructions.slice(first, first + 3) };
  const vm = new VM(limited);
  vm.load([pit], { positions: [0] });
  let firstExitAt = null;
  while (vm.cycle < 120 && !vm.done) {
    const next = vm.step();
    if (next.pc === 3 && firstExitAt === null) firstExitAt = vm.warriors[0].peak;
  }
  assert.equal(firstExitAt, 8);
  assert.equal(vm.warriors[0].alive, false);
});

test('the top-200 recipes pass full strict verification on their documented lengths', () => {
  const expected = {
    'repeat-burst-imp-88': 11, 'iron-trap-88': 18, 'tangle-trap-88': 38,
    'shadow-seeker-88': 10, 'microwarrior-swarm-88': 10, 'leviathan-88': 87,
    'matreshka-dual-tail-88': 71, 'permafrost-dual-tail-88': 77, 'evil-spirit-imp-tail-88': 50,
    'gothik-quickscan-88': 49, 'torment-hydra-88': 46, 'no-mucking-carpet-88': 28,
    'triangular-sun-pump-88': 14,
  };
  for (const [name, length] of Object.entries(expected)) {
    const recipe = recipes[name];
    const built = buildTree(recipe.tree(), { rules: '88', length: recipe.length, verification: 'full' });
    assert.equal(built.total, length, name);
  }
});
