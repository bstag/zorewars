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

test('a download stops at the size limit instead of buffering the whole file', async () => {
  const { fetchWarriorText, MAX_BYTES } = await import('../cli/remote.js');
  const realFetch = globalThis.fetch;
  let pulled = 0;
  try {
    const chunk = new Uint8Array(64 * 1024).fill(59);
    globalThis.fetch = async (url) => Object.defineProperty(new Response(new ReadableStream({
      pull(controller) { pulled += chunk.length; controller.enqueue(chunk); },
    }, { highWaterMark: 0 }), { headers: { 'content-type': 'text/plain' } }), 'url', { value: String(url) });
    await assert.rejects(fetchWarriorText('https://corewar.co.uk/big.red'), /larger than/);
    assert.ok(pulled <= MAX_BYTES + 2 * chunk.length, `read ${pulled} bytes`);
    globalThis.fetch = async (url) => Object.defineProperty(new Response('x', { headers: { 'content-length': String(MAX_BYTES + 1) } }), 'url', { value: String(url) });
    await assert.rejects(fetchWarriorText('https://corewar.co.uk/big.red'), /larger than/);
    globalThis.fetch = async (url) => Object.defineProperty(new Response('MOV 0, 1\n'), 'url', { value: String(url) });
    assert.equal((await fetchWarriorText('https://corewar.co.uk/imp.red')).text, 'MOV 0, 1\n');
  } finally { globalThis.fetch = realFetch; }
});
