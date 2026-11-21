// Replay only LP entrant pairs with pMARS, preserving the published hill cells.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { pushOff } from '../src/engine/pushoff.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const input = path.resolve(opt('input', 'evolved/tw2026-prefiltered/lp/scores-20261117-500.json'));
const out = path.resolve(opt('out', 'evolved/tw2026-pmars-lp'));
const executable = path.resolve(opt('pmars', process.env.PMARS ?? path.join(out, 'pmars.exe')));
const concurrency = Number(opt('threads', 10));
assert.ok(Number.isSafeInteger(concurrency) && concurrency > 0);
const original = JSON.parse(fs.readFileSync(input, 'utf8'));
const sourceFolder = path.dirname(input);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inputHash = hash(fs.readFileSync(input));
const binaryHash = hash(fs.readFileSync(executable));
fs.mkdirSync(out, { recursive: true });
const pinnedExecutable = path.join(out, 'pmars.exe');
if (!fs.existsSync(pinnedExecutable)) fs.copyFileSync(executable, pinnedExecutable);
assert.equal(hash(fs.readFileSync(pinnedExecutable)), binaryHash);
const banner = spawnSync(pinnedExecutable, [], { encoding: 'utf8' });
const version = (banner.stdout + banner.stderr).split(/\r?\n/).find(line => line.startsWith('pMARS v'));
assert.ok(version, 'pMARS version unavailable');
for (const warrior of original.warriors) {
  assert.equal(hash(fs.readFileSync(path.join(sourceFolder, warrior.file))), warrior.sha256);
}
const checkpointFile = path.join(out, 'checkpoint.json');
const checkpoint = fs.existsSync(checkpointFile) ? JSON.parse(fs.readFileSync(checkpointFile)) : {
  inputHash, binaryHash, version, pairs: {},
};
assert.equal(checkpoint.inputHash, inputHash);
assert.equal(checkpoint.binaryHash, binaryHash);
const save = (file, value) => {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
};
const pairs = [];
for (let i = 0; i < original.warriors.length; i++) {
  for (let j = i + 1; j < original.warriors.length; j++) {
    if (original.warriors[i].entry || original.warriors[j].entry) pairs.push([i, j]);
  }
}
const settings = original.settings;
function play(i, j) {
  // tools/hill.evaluate offsets opponents by 7; the replay offsets rows by i.
  const pairSeed = original.seed + i + (j - i - 1) * 7;
  // pMARS subtracts -d from -F to initialize its placement RNG seed.
  const flags = ['-b', '-k', '-r', String(original.rounds), '-s', String(settings.coreSize),
    '-p', String(settings.maxProcesses), '-c', String(settings.maxCycles),
    '-l', String(settings.maxLength), '-d', String(settings.minDistance),
    '-F', String(pairSeed + settings.minDistance),
    ...[i, j].map(k => path.join(sourceFolder, original.warriors[k].file))];
  return new Promise((resolve, reject) => {
    const child = spawn(pinnedExecutable, flags, { windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => {
      try {
        assert.equal(code, 0, `pMARS ${i}:${j} failed: ${stderr}`);
        const lines = stdout.trim().split(/\r?\n/);
        assert.equal(lines.length, 2, `unexpected pMARS output: ${stdout}`);
        assert.ok(lines.every(line => /^\s*\d+\s+\d+\s*$/.test(line)));
        const [[w, t], [l, otherTies]] = lines.map(line => line.trim().split(/\s+/).map(Number));
        assert.equal(t, otherTies);
        assert.equal(w + l + t, original.rounds);
        resolve({ w, l, t, rounds: original.rounds, pairSeed, flags, stdout, stderr });
      } catch (error) { reject(error); }
    });
  });
}
let next = 0, completed = Object.keys(checkpoint.pairs).length;
console.error(`${version}; ${completed}/${pairs.length} pairs cached`);
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < pairs.length) {
    const [i, j] = pairs[next++], key = `${i}:${j}`;
    if (checkpoint.pairs[key]) continue;
    checkpoint.pairs[key] = await play(i, j);
    completed++;
    if (completed % 20 === 0 || completed === pairs.length) save(checkpointFile, checkpoint);
    if (completed % 100 === 0 || completed === pairs.length) console.error(`${completed}/${pairs.length} pairs`);
  }
}));
const record = structuredClone(original);
record.engine = { name: 'pMARS', version, binaryHash, inputHash,
  placement: 'Same RNG seed and first-mover sequence as original measured pairs; -F = pairSeed + minDistance' };
const differences = [];
for (const [i, j] of pairs) {
  const result = checkpoint.pairs[`${i}:${j}`];
  const previous = original.measuredResults[i][j];
  const { w, l, t, rounds } = result;
  record.measuredResults[i][j] = { w, l, t, rounds };
  record.measuredResults[j][i] = { w: l, l: w, t, rounds };
  record.scores[i][j] = (3 * w + t) / rounds;
  record.scores[j][i] = (3 * l + t) / rounds;
  if (w !== previous.w || l !== previous.l || t !== previous.t) differences.push({
    i, j, a: original.warriors[i].name, b: original.warriors[j].name,
    previous, pmars: { w, l, t, rounds }, pairSeed: result.pairSeed,
  });
}
const ranking = pushOff(record.scores, record.warriors.map(w => w.name), { rule: 'official' });
const entryRanking = ranking.filter(row => record.warriors[row.index].entry).map((row, i) => ({
  ...row, entrantRank: i + 1, publishedEntrantRank: record.warriors[row.index].place,
}));
save(path.join(out, 'scores.json'), record);
save(path.join(out, 'analysis.json'), { engine: record.engine, ranking, entryRanking });
save(path.join(out, 'comparison.json'), { totalPairs: pairs.length, differingPairs: differences.length,
  differences, entryRanking });
console.log(JSON.stringify({ totalPairs: pairs.length, differingPairs: differences.length, entryRanking }, null, 2));
