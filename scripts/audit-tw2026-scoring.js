// Prepare Koenigstuhl-format fixtures for the organizer's original Ruby scorer,
// then compare its captured output with the JavaScript replay.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pushOff } from '../src/engine/pushoff.js';
import { compile, DEFAULT_SETTINGS, RULESETS } from '../src/engine/index.js';

const mode = process.argv[2] ?? 'prepare';
const root = path.resolve('evolved/tw2026-scoring-audit');
const rubyScript = path.resolve('imported/tournament-weekend-2026/scoring/sdscore-20261028.rb');
const scriptBytes = fs.readFileSync(rubyScript);
const scriptHash = createHash('sha256').update(scriptBytes).digest('hex');
fs.mkdirSync(root, { recursive: true });
const indexFile = path.join(root, 'cases.json');

function writeCase(name, record) {
  const folder = path.join(root, name);
  fs.mkdirSync(folder, { recursive: true });
  const size = record.warriors.length;
  // Ruby reads signed native 32-bit integers, transposes, and divides by 1e4.
  // Our 0..3 points/round become 0..300 points after Ruby's division.
  const binary = Buffer.alloc(size * size * 4);
  for (let column = 0; column < size; column++) {
    for (let row = 0; row < size; row++) {
      binary.writeInt32LE(Math.round(record.scores[row][column] * 1e6), (column * size + row) * 4);
    }
  }
  fs.writeFileSync(path.join(folder, 'hill32.scores'), binary);
  const defaultFormat = record.settings?.dialect === '88' ? '88' : '94';
  fs.writeFileSync(path.join(folder, 'hill32.dat'), size + '\n' +
    record.warriors.map(warrior => [warrior.name, warrior.author ?? 'archive',
      warrior.file ?? 'source.red', warrior.format ?? defaultFormat].join('\n')).join('\n') + '\n');
  fs.writeFileSync(path.join(folder, 'sdscore.rb'), scriptBytes);
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(record));
  fs.writeFileSync(path.join(folder, 'before.json'),
    JSON.stringify(pushOff(record.scores, record.warriors.map(warrior => warrior.name), { rule: 'official' })));
  return name;
}

if (mode === 'inputs') {
  const snapshotRoot = process.argv[3];
  if (!snapshotRoot) throw new Error('inputs mode needs the pre-contest hills directory');
  const folders = { lp: 'lp', '94x': '94x', '88': '88', '94nop': '94' };
  const rosters = [];
  for (const [division, directory] of Object.entries(folders)) {
    const currentRoot = path.resolve('evolved/tw2026-reconstruction', division);
    const roster = JSON.parse(fs.readFileSync(path.join(currentRoot, 'roster.json'), 'utf8'));
    const oldRoot = path.join(snapshotRoot, `koenigstuhl-${directory}-20261109`);
    const oldRanks = fs.readFileSync(oldRoot + '.rank.txt', 'utf8').trim().split(/\r?\n/).slice(0, roster.top);
    const currentHill = roster.warriors.filter(warrior => !warrior.entry);
    const files = currentHill.map(warrior => path.basename(warrior.url));
    const changed = [];
    const settings = { ...DEFAULT_SETTINGS, ...RULESETS[division], maxLength: 200, pSpace: true };
    const image = bytes => {
      const source = bytes.toString('utf8').replace(/[\u0000\s]+$/, '\n');
      const result = compile(source, 'redcode', settings);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return JSON.stringify({ start: result.start, instructions: result.instructions.map(
        ({ op, mod, aMode, a, bMode, b }) => ({ op, mod, aMode, a, bMode, b })) });
    };
    for (const warrior of currentHill) {
      const oldFile = path.join(oldRoot, path.basename(warrior.url));
      if (!fs.existsSync(oldFile)) continue;
      const previous = fs.readFileSync(oldFile);
      const hash = createHash('sha256').update(previous).digest('hex');
      if (hash === warrior.sha256) continue;
      const current = fs.readFileSync(path.join(currentRoot, warrior.file));
      changed.push({ name: warrior.name, sameInstructions: image(previous) === image(current) });
    }
    rosters.push({
      division, top: roster.top, orderDifferences: files.filter((file, i) => file !== oldRanks[i]).length,
      added: files.filter(file => !oldRanks.includes(file)),
      removed: oldRanks.filter(file => !files.includes(file)), changed,
    });
  }
  fs.writeFileSync(path.join(root, 'rosters.json'), JSON.stringify(rosters, null, 2));
  const lp = path.resolve('evolved/tw2026-reconstruction/lp');
  const low = JSON.parse(fs.readFileSync(path.join(lp, 'scores-20261117-50.json'), 'utf8'));
  const high = JSON.parse(fs.readFileSync(path.join(lp, 'scores-20261117-500.json'), 'utf8'));
  const sensitivity = ['50', 'entry500', 'hill500', '500'].map(mode => {
    const scores = low.scores.map((row, i) => row.map((score, j) => {
      const entry = low.warriors[i].entry || low.warriors[j].entry;
      const useHigh = mode === '500' || mode === 'entry500' && entry || mode === 'hill500' && !entry;
      return useHigh ? high.scores[i][j] : score;
    }));
    const ranking = pushOff(scores, low.warriors.map(warrior => warrior.name), { rule: 'official' })
      .filter(row => low.warriors[row.index].entry)
      .map((row, i) => ({ name: row.name, rank: i + 1 }));
    return { mode, ranking };
  });
  fs.writeFileSync(path.join(root, 'round-sensitivity.json'), JSON.stringify(sensitivity, null, 2));
  console.log(JSON.stringify({ rosters, sensitivity: sensitivity.map(item => ({
    mode: item.mode, ranking: item.ranking.filter(row =>
      ['Escapement', 'Amethystine Python', 'Rodents', 'Hell Kitty pqfc'].includes(row.name)),
  })) }, null, 2));
} else if (mode === 'prepare') {
  const cases = [];
  for (const division of ['lp', '94x', '88', '94nop']) {
    const directory = path.resolve('evolved/tw2026-reconstruction', division);
    for (const file of fs.readdirSync(directory).filter(name => /^scores-.*\.json$/.test(name))) {
      const record = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      cases.push(writeCase(`${division}-${record.seed}-${record.rounds}`, record));
    }
  }
  cases.push(writeCase('product-tie', {
    warriors: ['A', 'B', 'C', 'D'].map(name => ({ name })),
    scores: [[0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 0, 0], [1, 1, 0, 0]],
  }));
  fs.writeFileSync(indexFile, JSON.stringify({ scriptHash, cases }, null, 2));
  fs.writeFileSync(path.join(root, 'run.rb'), [
    "require 'json'",
    "root = __dir__",
    "JSON.parse(File.read(File.join(root, 'cases.json')))['cases'].each do |name|",
    "  Dir.chdir(File.join(root, name)) do",
    "    abort name unless system('ruby', 'sdscore.rb', out: 'ruby.txt')",
    "  end",
    "end",
    '',
  ].join('\n'));
  console.log(JSON.stringify({ root, scriptHash, cases }, null, 2));
} else if (mode === 'report') {
  const { cases } = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const summary = cases.map(name => {
    const folder = path.join(root, name);
    const record = JSON.parse(fs.readFileSync(path.join(folder, 'input.json'), 'utf8'));
    const text = fs.readFileSync(path.join(folder, 'ruby.txt'), 'utf8');
    const ruby = text.trim().split(/\r?\n/).map(line => {
      const match = /^(\d+)\s+.*?"(.*)" by /.exec(line);
      if (!match) throw new Error(`invalid Ruby output in ${name}: ${line}`);
      const values = /^\d+\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+"/.exec(line);
      return { rank: Number(match[1]), name: match[2],
        values: values ? values.slice(1).map(Number) : null };
    }).sort((a, b) => a.rank - b.rank);
    const names = record.warriors.map(warrior => warrior.name);
    const after = pushOff(record.scores, names, { rule: 'official' });
    const before = JSON.parse(fs.readFileSync(path.join(folder, 'before.json'), 'utf8'));
    const differences = ranking => ranking.flatMap(row => {
      const official = ruby.find(other => other.name === row.name);
      return official?.rank === row.rank ? [] : [{ name: row.name, javascript: row.rank, ruby: official?.rank }];
    });
    const numericDifferences = after.flatMap(row => {
      const official = ruby.find(other => other.name === row.name);
      if (!official?.values) return [];
      const expected = [row.score * 100, row.div, row.avg * 100];
      return expected.some((value, i) => Math.abs(value - official.values[i]) > 0.000501)
        ? [{ name: row.name, javascript: expected, ruby: official.values }] : [];
    });
    return { name, warriors: names.length, rubyRows: ruby.length,
      beforeDifferences: differences(before), afterDifferences: differences(after), numericDifferences };
  });
  fs.writeFileSync(path.join(root, 'comparison.json'), JSON.stringify({ scriptHash, summary }, null, 2));
  console.log(JSON.stringify(summary.map(row => ({
    name: row.name, warriors: row.warriors, rubyRows: row.rubyRows,
    beforeDifferences: row.beforeDifferences.length, afterDifferences: row.afterDifferences.length,
    numericDifferences: row.numericDifferences.length,
  })), null, 2));
  if (summary.some(row => row.rubyRows !== row.warriors ||
      row.afterDifferences.length || row.numericDifferences.length)) process.exitCode = 1;
} else {
  throw new Error('Usage: node scripts/audit-tw2026-scoring.js prepare|report|inputs [pre-contest-hills]');
}
