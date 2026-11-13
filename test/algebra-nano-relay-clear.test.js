import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '../src/engine/index.js';
import { buildTree, gate, observeTree } from '../tools/algebra/index.js';

const build = () => buildTree({ id: 'nano-relay-clear' }, { rules: 'nano', verification: 'full' });
const suppress = (built, label) => {
  const source = built.source.replace(new RegExp('^(b0' + label + ' )MOV\\.I', 'm'), '$1NOP.F');
  assert.notEqual(source, built.source);
  const w = compile(source, 'redcode', built.settings);
  assert.ok(w.ok);
  return { ...built, w };
};

test('the strike redirects the following read, including when the image wraps', () => {
  const built = build();
  const control = suppress(built, 'strike');
  assert.equal(built.total, 5);
  for (const base of [0, 78]) {
    const at = offset => (base + offset) % 80;
    const injections = [
      { cycle: 0, address: at(36), instruction: { op: 'DAT', mod: 'F', aMode: '#', a: 7, bMode: '#', b: 3 } },
      { cycle: 0, address: at(39), instruction: { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 } },
    ];
    const replay = candidate => observeTree(candidate, { positions: [base], injections, cycles: 5 });
    const { observation, vm } = replay(built);
    const phases = observation.blocks[0].phases;
    assert.equal(phases['first-read'].source, at(36));
    assert.equal(phases['cursor-replaced'].target, at(37));
    assert.deepEqual(phases['second-read'], { cycle: 4, source: at(39), cursorWriter: at(2) });
    assert.equal(vm.peek(at(19)).op, 'JMP');
    const suppressed = replay(control);
    assert.equal(suppressed.observation.blocks[0].phases['second-read'].source, at(35));
    assert.equal(suppressed.vm.peek(at(19)).op, 'DAT');
  }
});

test('the gate rejects either missing write and the linker rejects unsafe lanes', () => {
  const built = build();
  for (const label of ['prime', 'strike']) {
    assert.throws(() => gate(suppress(built, label)), /fresh write/);
  }
  for (const P of [{ STEP: 6 }, { RELAY: 45 }]) {
    assert.throws(() => buildTree({ id: 'nano-relay-clear', P }, { rules: 'nano' }), /intersects the image or relay/);
  }
});
