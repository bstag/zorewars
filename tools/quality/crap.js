// Repository source selection and CRAP reporting. Coverage collection stays in
// scripts/coverage.js; parsing, complexity and attribution use the pinned core.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseFileMethods, parseCoverageReport, coverageForMethods, calculateCrapScore } from '@barney-media/crap-typescript-core';

export const THRESHOLD = 30;
const slash = p => p.replaceAll('\\', '/');
const codeFile = p => /\.(?:[cm]?js|[cm]?ts|tsx|jsx|py|cpp|hpp|sh)$/.test(p);

export function sourceInventory(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, '.c8rc.json'), 'utf8'));
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
  // The shared config deliberately supports directory exclusions only.
  const excludedRoots = config.exclude.map(p => {
    if (!p.endsWith('/**') || /[*?]/.test(p.slice(0, -3))) throw new Error(`Unsupported source exclusion: ${p}`);
    return p.slice(0, -2);
  });
  const selected = [], excluded = [], unsupported = [];
  for (const file of files.filter(codeFile)) {
    const generated = excludedRoots.some(p => file.startsWith(p)) || file.startsWith('warriors/python/');
    if (generated || file.startsWith('test/')) {
      excluded.push({ file, reason: generated ? 'generated/vendor' : 'tests' });
    } else if (!/\.[cm]?js$/.test(file)) {
      unsupported.push(file);
    } else if (config.src.some(p => file.startsWith(`${p}/`))) selected.push(file);
    else excluded.push({ file, reason: 'outside configured source roots' });
  }
  return { selected, excluded, unsupported, inputs: files.filter(codeFile) };
}

export function inputSignature(root) {
  const files = [...sourceInventory(root).inputs, '.c8rc.json', 'package.json', 'package-lock.json'];
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update('\0').update(fs.readFileSync(path.join(root, file))).update('\0');
  return hash.digest('hex');
}

export function reportSignature(root) {
  return createHash('sha256').update(fs.readFileSync(path.join(root, 'coverage/coverage-final.json'))).digest('hex');
}

// A missing component stays unknown even if the other component was measured.
// Unknown scores are ranked by a labelled 0%-coverage estimate, never as passes.
export function methodMetrics(file, methods, fileCoverage, threshold = THRESHOLD) {
  const attributed = coverageForMethods(methods, fileCoverage);
  const unexecuted = fileCoverage?.statements.length > 0 && fileCoverage.statements.every(s => s.hits === 0);
  return methods.map((method, i) => {
    const parts = [attributed[i].statementCoverage, attributed[i].branchCoverage];
    const unknown = parts.find(p => p.status === 'unknown');
    const coverage = unexecuted ? 0 : unknown ? null : Math.min(...parts.map(p => p.percent ?? 100));
    const crap = calculateCrapScore(method.complexity, coverage);
    const risk = crap ?? calculateCrapScore(method.complexity, 0);
    return { file, method: method.displayName, line: method.startLine, endLine: method.endLine,
      complexity: method.complexity, coverage, coverageStatus: unexecuted ? 'unexecuted' : unknown ? 'unknown' : 'measured',
      unknownReason: coverage === null ? unknown.unknownReason : null, crap, risk, aboveThreshold: risk > threshold };
  });
}

export async function analyzeRepository(root, { threshold = THRESHOLD } = {}) {
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error('threshold must be a nonnegative finite number');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'coverage/crap-manifest.json'), 'utf8'));
  if (manifest.inputs !== inputSignature(root) || manifest.coverage !== reportSignature(root)) {
    throw new Error('Coverage is stale: run npm run test:coverage before generating CRAP reports');
  }
  const inventory = sourceInventory(root);
  const coverage = await parseCoverageReport(path.join(root, 'coverage/coverage-final.json'), root);
  const methods = [], emptyFiles = [];
  for (const file of inventory.selected) {
    const absolute = path.join(root, file), parsed = await parseFileMethods(absolute);
    if (!parsed.length) emptyFiles.push(file);
    methods.push(...methodMetrics(file, parsed, coverage.get(slash(absolute).toLowerCase()), threshold));
  }
  methods.sort((a, b) => b.risk - a.risk || a.file.localeCompare(b.file) || a.line - b.line);
  return { schemaVersion: 1, commit: manifest.commit, inputs: manifest.inputs, threshold,
    policy: 'Named declarations, assigned functions and methods; anonymous callbacks and embedded shader/Redcode strings are not scored. Unknown coverage uses labelled pessimistic estimates.',
    inventory: { files: inventory.selected.length, excluded: inventory.excluded, unsupported: inventory.unsupported, emptyFiles },
    summary: { methods: methods.length, aboveThreshold: methods.filter(m => m.aboveThreshold).length,
      unknownCoverage: methods.filter(m => m.coverage === null).length, maxRisk: methods[0]?.risk ?? 0 }, methods };
}

export function compareReports(before, after) {
  const maxima = rows => {
    const result = new Map();
    for (const m of rows) { const key = `${m.file}:${m.method}`; result.set(key, Math.max(result.get(key) ?? 0, m.risk)); }
    return result;
  };
  const previous = maxima(before.methods), current = maxima(after.methods);
  return { before: before.summary, after: after.summary,
    improved: [...current].filter(([key, risk]) => previous.has(key) && risk < previous.get(key)).map(([key, risk]) => ({ method: key, before: previous.get(key), after: risk })),
    worsened: [...current].filter(([key, risk]) => previous.has(key) && risk > previous.get(key)).map(([key, risk]) => ({ method: key, before: previous.get(key), after: risk })),
    added: [...current.keys()].filter(key => !previous.has(key)), removed: [...previous.keys()].filter(key => !current.has(key)) };
}
