import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureLeaders, buildReferenceExtractions, leaderMarkdown } from '../tools/blocks/hill-leaders.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--top')) throw new Error('Usage: node scripts/hill-leaders.js [--top 3]');
const top = Number(args[1] ?? 3);
if (!Number.isInteger(top) || top < 1 || top > 50) throw new Error('top must be 1..50');
const report = await captureLeaders(root, { top });
report.extractions = buildReferenceExtractions(root, report);
fs.writeFileSync(path.join(root, 'docs/hill-leaders.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'docs/hill-leaders.md'), leaderMarkdown(report));
console.log(JSON.stringify({ fetchedAt: report.fetchedAt, hills: report.hills.map(x => ({id:x.id,status:x.status,error:x.error})), leaders: report.leaders.length, reviewed: report.leaders.filter(x=>x.review?.current).length, extractions: report.extractions.map(x=>({id:x.id,length:x.compile.instructions,errors:x.compile.errors,solo:x.solo.every(s=>s.alive)})) },null,2));
if (report.hills.some(x=>x.status==='failed') || report.leaders.some(x=>x.status==='failed')) process.exitCode = 1;
