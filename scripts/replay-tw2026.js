// Reconstruct the published entrant field against a frozen Koenigstuhl roster.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { compile, DEFAULT_SETTINGS, RULESETS } from '../src/engine/index.js';
import { pushOff } from '../src/engine/pushoff.js';
import { createPool, strip, evaluate } from '../tools/hill.js';
import { nativeAddonURL } from '../tools/ring-duel-native.js';
import { readKoenigstuhlRecord } from '../cli/koenigstuhl-scores.js';

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, args) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), args[index + 1]]);
  return pairs;
}, []));
const rounds = Number(options.rounds ?? 50), seed = Number(options.seed ?? 20261117);
const threads = Number(options.threads ?? Math.min(8, os.availableParallelism()));
for (const [name, value] of Object.entries({ rounds, seed, threads })) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}
const profiles = { '88': { top: 128, directory: '88' }, '94nop': { top: 128, directory: '94' },
  lp: { top: 64, directory: 'LP' }, '94x': { top: 64, directory: 'X' } };
const divisions = (options.divisions ?? '88,94nop,lp,94x').split(',');
for (const division of divisions) if (!profiles[division]) throw new Error(`unknown division ${division}`);
const publishedRoot = options['published-hill'] ? path.resolve(options['published-hill']) : null;
const out = path.resolve(options.out ?? (publishedRoot ? 'evolved/tw2026-prefiltered' : 'evolved/tw2026-reconstruction'));
const archive = path.resolve('imported/tournament-weekend-2026');
const entrants = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
};

async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function compiled(bytes, settings, label) {
  const utf8 = bytes.toString('utf8');
  const source = utf8.includes('\uFFFD') ? bytes.toString('latin1') : utf8;
  const warrior = compile(source.replace(/[\u0000\s]+$/, '\n'), 'redcode', settings);
  if (!warrior.ok) throw new Error(`${label}: ${JSON.stringify(warrior.errors)}`);
  return strip(warrior);
}

function initialProfiles(scores, warriors) {
  const size = scores.length;
  const spreads = scores[0].map((_, column) => {
    const mean = scores.reduce((sum, row) => sum + row[column], 0) / size;
    return Math.sqrt(scores.reduce((sum, row) => sum + (row[column] - mean) ** 2, 0) / size);
  });
  return warriors.flatMap((warrior, i) => {
    if (!warrior.entry) return [];
    const neighbors = warriors.flatMap((other, k) => k === i ? [] : [{
      name: other.name, entry: other.entry,
      distance: scores[i].reduce((sum, score, j) =>
        sum + (spreads[j] > 0 ? Math.abs(score - scores[k][j]) / spreads[j] : 0), 0),
    }]).sort((a, b) => a.distance - b.distance);
    return [{ name: warrior.name, average: scores[i].reduce((sum, score) => sum + score, 0) / (size - 1),
      nearest: neighbors.slice(0, 3) }];
  });
}

function eliminationProfiles(scores, warriors, ranking) {
  return ranking.filter(row => warriors[row.index].entry).map(row => {
    const live = ranking.slice(0, Math.max(2, row.rank)).map(item => item.index);
    const field = live.map(i => warriors[i]);
    const matrix = live.map(i => live.map(j => scores[i][j]));
    const profile = initialProfiles(matrix, field).find(item => item.name === row.name);
    return { rank: row.rank, ...profile };
  });
}

async function runDivision(division, pool) {
  const folder = path.join(out, division);
  fs.mkdirSync(path.join(folder, 'sources'), { recursive: true });
  const rosterFile = path.join(folder, 'roster.json');
  const { top, directory } = profiles[division];
  const settings = { ...DEFAULT_SETTINGS, ...RULESETS[division], rounds };
  const playSettings = { ...settings, maxLength: 200, pSpace: !publishedRoot };
  const publishedBase = publishedRoot ? path.join(publishedRoot, directory, 'hill32') : null;
  const published = publishedBase ? readKoenigstuhlRecord(publishedBase + '.dat') : null;
  const publishedIndices = new Map(published?.warriors.map((warrior, index) =>
    [warrior.file.toLowerCase(), index]));
  const warriors = [], programs = [];
  if (!fs.existsSync(rosterFile)) {
    const listingUrl = `https://asdflkj.net/COREWAR/${directory}/hill32_rec.html`;
    const priorListing = path.resolve('evolved/tw2026-reconstruction', division, 'hill.html');
    const listing = published && fs.existsSync(priorListing) ? fs.readFileSync(priorListing) : await fetchBytes(listingUrl);
    fs.writeFileSync(path.join(folder, 'hill.html'), listing);
    const ranked = [...listing.toString('latin1').matchAll(/^\s*(\d+)\s+<a\s+href="(HILL(?:32)?\/[^"]+)">([^<]+)<\/a>/gim)]
      .filter(([, , href]) => {
        if (!published) return true;
        const index = publishedIndices.get(path.posix.basename(href).toLowerCase());
        if (index === undefined) throw new Error(`ranking source missing from published metadata: ${href}`);
        return published.warriors[index].format !== 'P-Space';
      })
      .slice(0, top);
    if (ranked.length !== top) throw new Error(`${division}: found ${ranked.length} of ${top} opponents`);
    for (const entrant of entrants.warriors.filter(warrior => warrior.division === division)) {
      const bytes = fs.readFileSync(path.join(archive, entrant.file));
      if (sha256(bytes) !== entrant.sha256) throw new Error(`changed entrant source ${entrant.file}`);
      const file = `sources/entry-${path.basename(entrant.file)}`;
      fs.writeFileSync(path.join(folder, file), bytes);
      const warrior = compiled(bytes, { ...settings, maxLength: 50 }, entrant.name);
      warriors.push({ name: warrior.name, entry: true, place: entrant.place, file,
        url: entrant.url, sha256: sha256(bytes) });
    }
    for (let start = 0; start < ranked.length; start += 8) {
      const batch = await Promise.all(ranked.slice(start, start + 8).map(async ([, rank, href, name]) => {
        const url = new URL(href, listingUrl).href;
        const priorSource = path.resolve('evolved/tw2026-reconstruction', division, 'sources',
          `hill-${rank}-${path.posix.basename(href)}`);
        const bytes = published && fs.existsSync(priorSource) ? fs.readFileSync(priorSource) : await fetchBytes(url);
        if (/^\s*<!doctype|^\s*<html/i.test(bytes.toString('utf8'))) throw new Error(`${url}: received HTML`);
        const file = `sources/hill-${rank}-${path.posix.basename(href)}`;
        fs.writeFileSync(path.join(folder, file), bytes);
        const warrior = compiled(bytes, playSettings, name);
        const publishedIndex = publishedIndices.get(path.posix.basename(href).toLowerCase());
        return { name: warrior.name, entry: false, hillRank: Number(rank), file, url, sha256: sha256(bytes),
          ...(published ? { publishedIndex, format: published.warriors[publishedIndex].format } : {}) };
      }));
      warriors.push(...batch);
    }
    save(rosterFile, { division, top, fetchedAt: new Date().toISOString(), listingUrl,
      hillListingHash: sha256(listing), fieldStatus: 'current published roster; historical identity unconfirmed',
      sourceHandling: 'Original bytes preserved; UTF-8 with Latin-1 fallback; trailing NUL bytes ignored for assembly',
      settings: playSettings, entryLength: 50, warriors,
      ...(published ? { referenceScores: {
        filtering: 'P-Space warriors excluded before top-N selection',
        metadata: publishedBase + '.dat', metadataHash: sha256(fs.readFileSync(publishedBase + '.dat')),
        scores: publishedBase + '.scores', scoresHash: sha256(fs.readFileSync(publishedBase + '.scores')),
      } } : {}) });
  }
  const roster = JSON.parse(fs.readFileSync(rosterFile, 'utf8'));
  if (roster.division !== division || roster.top !== top) throw new Error('saved roster profile mismatch');
  const savedSettings = { ...roster.settings, rounds };
  if (JSON.stringify(savedSettings) !== JSON.stringify(playSettings)) throw new Error('saved roster settings changed');
  for (const warrior of roster.warriors) {
    const bytes = fs.readFileSync(path.join(folder, warrior.file));
    if (sha256(bytes) !== warrior.sha256) throw new Error(`source hash mismatch ${warrior.file}`);
    programs.push(compiled(bytes, { ...playSettings, maxLength: warrior.entry ? 50 : 200 }, warrior.name));
  }
  const resultFile = path.join(folder, `scores-${seed}-${rounds}.json`);
  const checkpointFile = path.join(folder, `checkpoint-${seed}-${rounds}.json`);
  const size = programs.length;
  const checkpoint = fs.existsSync(checkpointFile) ? JSON.parse(fs.readFileSync(checkpointFile, 'utf8')) : {
    rosterHash: sha256(fs.readFileSync(rosterFile)), seed, rounds, completedRows: 0,
    scores: Array.from({ length: size }, () => Array(size).fill(0)),
    results: Array.from({ length: size }, () => Array(size).fill(null)),
  };
  if (checkpoint.seed !== seed || checkpoint.rounds !== rounds) throw new Error('checkpoint match settings changed');
  if (checkpoint.rosterHash !== sha256(fs.readFileSync(rosterFile))) throw new Error('checkpoint roster changed');
  const { scores, results } = checkpoint;
  if (published) {
    if (roster.referenceScores?.scoresHash !== sha256(fs.readFileSync(publishedBase + '.scores')) ||
        roster.referenceScores?.metadataHash !== sha256(fs.readFileSync(publishedBase + '.dat'))) {
      throw new Error('published reference files changed');
    }
    for (let i = 0; i < size; i++) {
      if (roster.warriors[i].entry) continue;
      for (let j = 0; j < size; j++) {
        if (roster.warriors[j].entry) continue;
        scores[i][j] = i === j ? 0 : published.scores[roster.warriors[i].publishedIndex][roster.warriors[j].publishedIndex];
      }
    }
  }
  const rowsToPlay = published ? roster.warriors.filter(warrior => warrior.entry).length : size;
  for (let i = checkpoint.completedRows; i < rowsToPlay; i++) {
    const opponents = programs.slice(i + 1).map((w, k) => ({ name: String(i + 1 + k), group: division, w }));
    if (opponents.length) {
      const played = await evaluate(pool, programs[i], opponents, { rounds, seed: seed + i, settings: playSettings });
      played.rows.forEach((row, k) => {
        const j = i + 1 + k;
        results[i][j] = { w: row.w, l: row.l, t: row.t, rounds };
        results[j][i] = { w: row.l, l: row.w, t: row.t, rounds };
        scores[i][j] = (3 * row.w + row.t) / rounds;
        scores[j][i] = (3 * row.l + row.t) / rounds;
      });
    }
    checkpoint.completedRows = i + 1;
    save(checkpointFile, checkpoint);
    console.error(`${division}: row ${i + 1}/${rowsToPlay}`);
  }
  // The published table has normalized scores without win/loss/tie counts.
  // Keep the measured counts separately instead of inventing reference results.
  const record = { rounds, seed, settings: playSettings, warriors: roster.warriors, scores,
    ...(published ? { referenceScores: roster.referenceScores, measuredResults: results } : { results }) };
  save(resultFile, record);
  const ranking = pushOff(scores, roster.warriors.map(warrior => warrior.name), { rule: 'official' })
    .map(row => ({ ...row, entry: roster.warriors[row.index].entry }));
  const entryRanking = ranking.filter(row => row.entry).map((row, index) => ({
    ...row, entrantRank: index + 1, publishedEntrantRank: roster.warriors[row.index].place,
  }));
  save(path.join(folder, `analysis-${seed}-${rounds}.json`), {
    fieldStatus: roster.fieldStatus, seed, rounds, top, fieldSize: size, ranking, entryRanking,
    initialProfiles: initialProfiles(scores, roster.warriors),
    eliminationProfiles: eliminationProfiles(scores, roster.warriors, ranking),
  });
  console.log(JSON.stringify({ division, resultFile, entryRanking }, null, 2));
}

fs.mkdirSync(out, { recursive: true });
const native = fs.existsSync(nativeAddonURL);
console.error(`Reconstruction: ${rounds} rounds, seed ${seed}, ${threads} ${native ? 'native' : 'JS'} workers`);
const pool = createPool(threads, { native });
try {
  for (const division of divisions) await runDivision(division, pool);
} finally {
  pool.close();
}
