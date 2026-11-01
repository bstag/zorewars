import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const supported = Number(process.versions.node.split('.')[0]) >= 22;
const { parseFileMethods } = supported ? await import('@barney-media/crap-typescript-core') : {};
const { methodMetrics, compareReports, sourceInventory, inputSignature } = supported ? await import('../tools/quality/crap.js') : {};
const qualityTest = (name, fn) => test(name, { skip: !supported && 'CRAP tooling requires Node 22' }, fn);

qualityTest('CRAP analyzes real JavaScript, separates nested functions and exposes missing coverage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-crap-'));
  const file = path.join(dir, 'sample.js');
  fs.writeFileSync(file, 'export function outer(x) { function inner(y) { if (y) return 1; return 0; } return x ? inner(x) : 0; }');
  const parsed = await parseFileMethods(file);
  assert.deepEqual(parsed.map(m => [m.functionName, m.complexity]), [['outer', 2], ['inner', 2]]);
  const rows = methodMetrics('sample.js', parsed, undefined);
  assert.ok(rows.every(m => m.coverage === null && m.crap === null && m.risk === 6));
});

qualityTest('known unexecuted files count as zero coverage, while unattributed branches stay unknown', () => {
  const method = { displayName: 'example', startLine: 1, endLine: 4, complexity: 3,
    bodySpan: { startLine: 1, startColumn: 0, endLine: 4, endColumn: 1 },
    expectsStatementCoverage: true, expectsBranchCoverage: true };
  const statement = { span: { startLine: 2, startColumn: 0, endLine: 2, endColumn: 10 }, hits: 0 };
  const coverage = { statements: [statement], branches: [], functions: [] };
  const [untested] = methodMetrics('sample.js', [method], coverage);
  assert.equal(untested.coverage, 0); assert.equal(untested.crap, 12);
  const [ambiguous] = methodMetrics('sample.js', [method], { ...coverage, statements: [{ ...statement, hits: 1 }] });
  assert.equal(ambiguous.coverage, null); assert.equal(ambiguous.crap, null);
  assert.equal(ambiguous.risk, 12); assert.equal(ambiguous.unknownReason, 'branch_unattributed');
});

qualityTest('comparison ignores line shifts without hiding removed or added methods', () => {
  const before = { summary: {}, methods: [{ file: 'a.js', method: 'f', line: 1, risk: 100 }, { file: 'a.js', method: 'old', risk: 50 }] };
  const after = { summary: {}, methods: [{ file: 'a.js', method: 'f', line: 25, risk: 30 }, { file: 'a.js', method: 'new', risk: 20 }] };
  const change = compareReports(before, after);
  assert.deepEqual(change.improved, [{ method: 'a.js:f', before: 100, after: 30 }]);
  assert.deepEqual(change.added, ['a.js:new']); assert.deepEqual(change.removed, ['a.js:old']);
});

qualityTest('source inventory includes untested browser and worker files and audits other languages', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const inventory = sourceInventory(root);
  assert.ok(inventory.selected.includes('web/arena.js') && inventory.selected.includes('worker/index.js'));
  assert.ok(inventory.unsupported.includes('lang/python/zorewars.py') && inventory.unsupported.includes('lang/cpp/zorewars.hpp'));
  assert.ok(inventory.excluded.some(x => x.file === 'web/vendor/codemirror.js'));
  assert.match(inputSignature(root), /^[a-f0-9]{64}$/);
});
