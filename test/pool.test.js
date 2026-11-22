import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool, strip } from '../tools/hill.js';
import { compile } from '../src/engine/index.js';

const dwarf = strip(compile('ADD #4, 3\nMOV 2, @2\nJMP -2\nDAT #0, #0', 'redcode'));
const imp = strip(compile('MOV 0, 1', 'redcode'));
const task = { a: dwarf, b: imp, settings: { rounds: 2 }, seed: 1 };

test('the CPU pool queues more matches than it has threads', async () => {
  const pool = createPool(2);
  try {
    const results = await Promise.all(Array.from({ length: 7 }, () => pool.match(task)));
    assert.equal(results.length, 7);
    for (const r of results) assert.deepEqual([r.w, r.l, r.t], [results[0].w, results[0].l, results[0].t]);
  } finally { pool.close(); }
});

test('a task that cannot be posted fails alone and frees its thread', async () => {
  const pool = createPool(1);
  try {
    await assert.rejects(pool.match({ ...task, settings: { rounds: 2, hook() {} } }));
    const r = await pool.match(task);
    assert.equal(r.w + r.l + r.t, 2);
  } finally { pool.close(); }
});

test('closing the pool rejects matches still waiting', async () => {
  const pool = createPool(1);
  const waiting = [pool.match(task), pool.match(task)];
  pool.close();
  for (const p of waiting) await assert.rejects(p, /closed/);
  await assert.rejects(pool.match(task), /closed/);
});
