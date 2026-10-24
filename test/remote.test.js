import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWarriorUrl, nameFromUrl } from '../cli/remote.js';

test('archive URLs are accepted, other hosts only when allowed', () => {
  assert.equal(parseWarriorUrl('https://gallium.inria.fr/~doligez/corewar/rc/Imp.txt').hostname, 'gallium.inria.fr');
  assert.throws(() => parseWarriorUrl('https://example.com/w.red'), /not a known Core War archive/);
  assert.equal(parseWarriorUrl('https://example.com/w.red', { anyHost: true }).hostname, 'example.com');
});

test('only Redcode is loaded from the network', () => {
  for (const u of ['https://asdflkj.net/x.js', 'https://asdflkj.net/x.py', 'https://asdflkj.net/x.cpp']) {
    assert.throws(() => parseWarriorUrl(u, { anyHost: true }), /only Redcode/);
  }
  assert.throws(() => parseWarriorUrl('file:///etc/passwd', { anyHost: true }), /http and https/);
});

test('names come from the file name when a warrior has none', () => {
  assert.equal(nameFromUrl('https://gallium.inria.fr/~doligez/corewar/rc/IronGate%5B2%5D.txt'), 'IronGate');
  assert.equal(nameFromUrl('https://asdflkj.net/COREWAR/94/HILL32/arvon.red'), 'arvon');
});
