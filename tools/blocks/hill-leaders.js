import fs from 'node:fs';
import path from 'node:path';
import { compile, RULESETS, measureSpecies, VM } from '../../src/engine/index.js';
import { fetchWarriorText } from '../../cli/remote.js';
import { hash, inspectSource } from './inventory.js';
import { leaderReviews, leaderPatterns } from './leader-reviews.js';

export const hills = [
  { id: '94x', directory: 'X', settings: RULESETS['94x-hill'], note: 'Native X hill allows P-space; our 94x tournament profile does not.' },
  { id: '88', directory: '88', settings: RULESETS['88'], note: 'Strict ICWS 88; native length 100.' },
  { id: '94nop', directory: '94', settings: RULESETS['94nop'], note: 'No P-space; native length 100.' },
  { id: 'lp', directory: 'LP', settings: { ...RULESETS.lp, maxLength: 200, pSpace: true }, note: 'Native LP hill permits 200 instructions and P-space. Repo lp defaults remain unchanged.' },
];
const decode = s => s.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_,n) => String.fromCodePoint(Number(n)));

export function parseRanking(html, rankingUrl, top = 3) {
  if (!Number.isInteger(top) || top < 1 || top > 50) throw new Error('top must be 1..50');
  const rows = [...html.matchAll(/^\s*(\d+)\s+<a\s+href=["'](HILL32\/[^"'\n]+\.red)["']>([^<]+)<\/a>\s+(.+?)\s+([\d.]+)\s+\(([^)]+)\)/gim)]
    .slice(0, top).map(m => ({ rank: Number(m[1]), name: decode(m[3]).trim(), author: decode(m[4]).trim(), score: Number(m[5]), style: m[6], url: new URL(decode(m[2]), rankingUrl).href }));
  if (rows.length !== top || rows.some((r,i) => r.rank !== i+1) || new Set(rows.map(r => r.url)).size !== top) throw new Error('Ranking format changed or top ranks are missing/duplicated');
  return rows;
}

export function extractReference(source, review) {
  if (hash(source) !== review.hash) throw new Error('Source hash changed; review is stale');
  const recipe = review.extraction;
  if (!recipe) throw new Error('No reviewed extraction for this source');
  let text;
  if (recipe.switchOff) {
    const switchLine = /^switch\s+equ\s+1\b/mi;
    if (!switchLine.test(source)) throw new Error('Documented switch missing');
    text = source.replace(switchLine, 'switch equ 0');
  } else if (recipe.whole) text = source;
  else {
    const lines = source.split(/\r?\n/);
    const metadata = lines.filter(x => /^;(name|author|assert)\b/i.test(x));
    text = [...metadata, `ORG ${recipe.entry}`, ...recipe.ranges.flatMap(([lo,hi]) => {
      if (lo < 1 || hi < lo || hi > lines.length) throw new Error('Invalid reviewed source range');
      return lines.slice(lo-1, hi);
    }), `END ${recipe.entry}`].join('\n');
  }
  return `; Reference extraction: ${recipe.id}; not a certified evolution block\n; Original SHA-256: ${review.hash}\n` + text;
}

export async function captureLeaders(root, { top = 3, fetchSource = fetchWarriorText } = {}) {
  const report = { schemaVersion: 1, fetchedAt: new Date().toISOString(), ranking: 'Koenigstuhl recursive scores', top,
    settingsSource: 'https://asdflkj.net/COREWAR/koenigstuhl.html',
    scope: 'Snapshot of the published recursive tables at retrieval time, not Battle Royale or top-50 flat rankings. Retrieval date is not the hill recomputation date.',
    license: 'Not established for originals; source and reference extractions stay in ignored imported/. Metadata and analysis only are tracked.',
    hills: [], leaders: [], patterns: leaderPatterns.map(p => ({ ...p, selectable: false, status: 'source-reviewed candidate; dedicated contract tests pending' })) };
  const cacheDir = path.join(root, 'imported/block-sources');
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const hill of hills) {
    const rankingUrl = `https://asdflkj.net/COREWAR/${hill.directory}/hill32_rec.html`;
    const info = { id: hill.id, rankingUrl, settings: hill.settings, note: hill.note };
    report.hills.push(info);
    try {
      const listing = await fetchSource(rankingUrl);
      info.rankingHash = hash(listing.text);
      info.resolvedUrl = listing.url;
      const ranked = parseRanking(listing.text, rankingUrl, top);
      fs.writeFileSync(path.join(cacheDir, info.rankingHash + '.html'), listing.text);
      info.status = 'fetched';
      for (const entry of ranked) {
        const row = { hill: hill.id, rankingUrl, ...entry };
        report.leaders.push(row);
        try {
          const fetched = await fetchSource(entry.url);
          if (/^\s*(?:<!doctype|<html)/i.test(fetched.text)) throw new Error('Archive returned HTML, not Redcode');
          row.resolvedUrl = fetched.url; row.status = 'inspected';
          row.inspection = inspectSource(fetched.text);
          fs.writeFileSync(path.join(cacheDir, row.inspection.hash + '.red'), fetched.text);
          const w = compile(fetched.text, 'redcode', hill.settings);
          const limited = compile(fetched.text, 'redcode', { ...RULESETS[hill.id], maxLength: 50 });
          row.assembly = { native: { ok: w.ok, length: w.ok ? w.instructions.length : null, errors: w.errors }, tournament50: { ok: limited.ok, errors: limited.errors } };
          row.solo = w.ok ? measureSpecies(w, hill.settings) : null;
          row.soloScope = 'One fresh single-warrior VM run; no enemy and no learned match history. Not a strength or controller-conformance test.';
          const review = leaderReviews[new URL(entry.url).pathname.split('/').pop()];
          if (review) row.review = { ...review, current: review.hash === row.inspection.hash };
        } catch (error) { row.status = 'failed'; row.error = error.message; }
      }
    } catch (error) { info.status = 'failed'; info.error = error.message; }
  }
  return report;
}

export function buildReferenceExtractions(root, report) {
  const out = path.join(root, 'imported/hill-leaders/extracted');
  fs.mkdirSync(out, { recursive: true });
  return report.leaders.filter(x => x.status === 'inspected' && x.review?.current && x.review.extraction).map(row => {
    const source = fs.readFileSync(path.join(root, 'imported/block-sources', row.inspection.hash + '.red'), 'utf8');
    const recipe = row.review.extraction, text = extractReference(source, row.review);
    const settings = { ...RULESETS[recipe.rules], maxLength: 50 };
    const w = compile(text, 'redcode', settings);
    const result = { id: recipe.id, original: row.name, sourceUrl: row.url, sourceHash: row.inspection.hash, outputHash: hash(text), rules: recipe.rules,
      note: recipe.note, status: 'experimental public reference; not admitted to generator',
      compile: { ok: w.ok, instructions: w.ok ? w.instructions.length : null, errors: w.errors }, solo: [] };
    if (w.ok) {
      fs.writeFileSync(path.join(out, recipe.id + '.red'), text);
      for (const base of [0, settings.coreSize-7]) {
        const vm = new VM(settings); vm.load([w], { positions: [base] }); vm.run();
        result.solo.push({ base, cycles: vm.cycle, alive: vm.warriors[0].alive, peakProcesses: vm.warriors[0].peak });
      }
    }
    return result;
  });
}

export function leaderMarkdown(report) {
  let text = `# Current hill leader anatomy\n\nRetrieved **${report.fetchedAt}**. ${report.scope}\n\nRefresh with \`node scripts/hill-leaders.js\`. This fetches current rankings and Redcode, checks compatibility, and rebuilds this report. A changed source hash disables its old review/extraction until reviewed again. Defaults and evolution admission stay unchanged.\n\n## Leaders and compatibility\n\n| Hill | Rank | Leader | Author | Native instructions | Fits our 50-instruction profile |\n|---|---:|---|---|---:|---|\n`;
  text += report.leaders.map(x => `| [${x.hill}](${x.rankingUrl}) | ${x.rank} | [${x.name}](${x.url}) | ${x.author} | ${x.assembly?.native.length ?? 'failed'} | ${x.assembly?.tournament50.ok ? 'yes' : 'no'} |`).join('\n');
  text += '\n\nX is P-space-enabled and LP allows 200 instructions/P-space on the source hill. Our `94x` and `lp` tournament profiles differ. [Published hill settings](' + report.settingsSource + '). No native ranking score is directly comparable with our local benchmark points.\n\n## Source breakdowns\n\n';
  for (const row of report.leaders) {
    text += `### ${row.hill} #${row.rank}: [${row.name}](${row.url})\n\n`;
    if (!row.review?.current) { text += 'No current manual review. Inspect the new source before extracting anything.\n\n'; continue; }
    text += `**${row.review.family}.** ${row.review.reuse}\n\n`;
    text += row.review.parts.map(([a,b,role]) => `- Source lines ${a}–${b}: ${role}.`).join('\n');
    text += '\n\nContract requirements: ' + row.review.requirements.join('; ') + '.\n\n';
    if (row.solo?.survives === false) text += '**Solo observation:** this original loses all processes in a fresh enemy-free run in our engine. P-space entry logic and intentional transitions need separate diagnosis; this is not proof that the published leader is invalid.\n\n';
  }
  text += '## Local reference breakouts\n\nThese retain the original authorship and are cached only in ignored `imported/hill-leaders/extracted/`. They are useful starting specimens, not our new implementations or evolution-safe blocks. Compilation and two solo placements do not prove relocation, replication or competitive strength.\n\n| Reference | Instructions | Solo survival at both placements | Change |\n|---|---:|---|---|\n';
  text += (report.extractions ?? []).map(x => `| [${x.id}](../imported/hill-leaders/extracted/${x.id}.red) | ${x.compile.instructions ?? 'failed'} | ${x.solo.length === 2 && x.solo.every(s => s.alive) ? 'yes' : 'no'} | ${x.note} |`).join('\n');
  text += '\n\nAfter refreshing sources, try a reference with `node cli/zorewars.js hill imported/hill-leaders/extracted/airbag-stone-94x.red --rules 94x --length 50 --rounds 20 --json`. Reproduce the small matched screen with `node scripts/benchmark-leader-breakouts.js --out evolved/leader-screen-new`. The [screen evidence](hill-leader-screen.json) records its own snapshot date and hashes; it is not automatically refreshed with this page.\n';
  text += '\n\n## What to build from these\n\n';
  for (const p of report.patterns) text += `${p.priority}. **${p.id}:** ${p.contract} Before admission: ${p.tests.join('; ')}.\n\n`;
  text += 'First 94x experiment: a compact stone with a clear fallback versus the plain clear and our timed-relocation recipe. For 50-instruction 88, compare a compact stone/imp launcher with and without a small scan. For lp, prioritize a replication contract under an eight-process limit. Preserve modular-arithmetic and scheduling constraints when tuning.\n\nP-space selection is a separate `94x-hill` project: start with a small tested controller, not the largest leader brain. A quickscanner also needs coupled parameter generation (probe lattice, tables and decoder), rather than independent random mutation of every constant.\n\nFull hashes, assembly diagnostics, source dependencies and observed behavior: [machine snapshot](hill-leaders.json). [Main block catalog](warrior-blocks.md) · [Experiment journal](molting-94x-journal.md).\n';
  return text;
}
