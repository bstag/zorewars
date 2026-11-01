import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeRepository, compareReports } from '../tools/quality/crap.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--snapshot'].includes(arg))) throw new Error('Usage: npm run crap [-- --check|--snapshot]');
try {
  const report = await analyzeRepository(root);
  fs.writeFileSync(path.join(root, 'coverage/crap.json'), JSON.stringify(report, null, 2) + '\n');
  const baseline = path.join(root, 'docs/crap-baseline.json');
  if (args.includes('--snapshot')) {
    if (fs.existsSync(baseline)) throw new Error('A reviewed baseline already exists; retain it while measuring improvements');
    fs.writeFileSync(baseline, JSON.stringify(report, null, 2) + '\n');
  }
  if (fs.existsSync(baseline)) {
    const comparison = compareReports(JSON.parse(fs.readFileSync(baseline, 'utf8')), report);
    fs.writeFileSync(path.join(root, 'coverage/crap-comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
    console.log(`Baseline comparison: ${comparison.improved.length} improved, ${comparison.worsened.length} worsened, ${comparison.added.length} added, ${comparison.removed.length} removed method groups.`);
  }
  console.log(`${report.inventory.files} source files; ${report.summary.methods} methods; ${report.summary.aboveThreshold} above ${report.threshold}; ${report.summary.unknownCoverage} with unknown coverage.`);
  console.log(`${report.inventory.unsupported.length} unsupported source files are listed in coverage/crap.json.`);
  console.table(report.methods.slice(0, 20).map(m => ({ file: `${m.file}:${m.line}`, method: m.method,
    CC: m.complexity, coverage: m.coverage === null ? 'unknown' : `${m.coverage.toFixed(1)}%`,
    CRAP: m.crap === null ? `estimate ${m.risk.toFixed(1)}` : m.crap.toFixed(1) })));
  if (args.includes('--check') && report.summary.aboveThreshold) process.exitCode = 2;
} catch (error) {
  console.error(`${error.message}\nRun npm run test:coverage, then npm run crap.`);
  process.exitCode = 1;
}
