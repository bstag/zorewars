// Preserve the published tournament field and verify each warrior locally.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compile, DEFAULT_SETTINGS, RULESETS } from '../src/engine/index.js';

const source = 'https://corewar.co.uk/tournamentweekend2026.htm';
const destination = path.resolve(process.argv[2] ?? 'imported/tournament-weekend-2026');
const divisions = { '88': '88', '94': '94nop', '94x': '94x', lp: 'lp' };
const expected = { '88': 10, '94nop': 14, '94x': 11, lp: 15 };

async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const page = await fetchBytes(source);
const matches = [...page.toString('utf8').matchAll(/<tr><td>(\d+)<\/td><td><a href="(cwtw2026\/(88|94|94x|lp)\/[^"]+\.red)">([^<]+)<\/a><\/td><td>([^<]+)<\/td><\/tr>/g)];
for (const [division, count] of Object.entries(expected)) {
  const actual = matches.filter(match => divisions[match[3]] === division).length;
  if (actual !== count) throw new Error(`expected ${count} ${division} warriors, found ${actual}`);
}
await fs.mkdir(destination, { recursive: true });
await fs.writeFile(path.join(destination, 'source.html'), page);
const warriors = [];
for (let start = 0; start < matches.length; start += 5) {
  const batch = await Promise.all(matches.slice(start, start + 5).map(async match => {
    const [, rank, relativeUrl, originalDivision, name, author] = match;
    const division = divisions[originalDivision];
    const url = new URL(relativeUrl, source).href;
    const bytes = await fetchBytes(url);
    const text = bytes.toString('utf8');
    if (/^\s*(?:<!doctype|<html)/i.test(text)) throw new Error(`${url}: received HTML`);
    const settings = { ...DEFAULT_SETTINGS, ...RULESETS[division], maxLength: 50 };
    const checked = compile(text, 'redcode', settings);
    const file = `${division}/${path.posix.basename(relativeUrl)}`;
    await fs.mkdir(path.join(destination, division), { recursive: true });
    await fs.writeFile(path.join(destination, file), bytes);
    return {
      division, place: Number(rank), name, author, file, url,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length, compiled: checked.ok,
      length: checked.instructions?.length,
      errors: checked.ok ? [] : checked.errors,
    };
  }));
  warriors.push(...batch);
  console.error(`Downloaded ${warriors.length}/${matches.length}`);
}
const manifest = { source, downloadedAt: new Date().toISOString(), counts: expected, warriors };
await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({
  destination, downloaded: warriors.length,
  compiled: warriors.filter(warrior => warrior.compiled).length,
  failures: warriors.filter(warrior => !warrior.compiled),
}, null, 2));
if (warriors.some(warrior => !warrior.compiled)) process.exitCode = 1;
