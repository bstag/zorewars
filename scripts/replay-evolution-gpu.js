#!/usr/bin/env node
// Replay pinned compiled inputs from an evolution report. Legacy reports omit
// partner programs and field-round counts, so supply those explicitly.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compile } from '../src/engine/index.js';
import { makeGeometry } from '../src/engine/geometry.js';
import { evolve } from '../tools/evolve.js';
import { toRedcode } from '../tools/genes.js';
import { createGpuPool } from '../tools/gpu.js';

const args = process.argv.slice(2), started = performance.now(), cpuStart = process.cpuUsage();
const option = (key) => {
  const i = args.indexOf(key);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(key + ' is required');
  return args[i + 1];
};
const input = path.resolve(option('--input')), out = path.resolve(option('--out'));
const fieldRounds = Number(option('--field-rounds'));
if (!Number.isSafeInteger(fieldRounds) || fieldRounds < 1) throw Error('--field-rounds must be a positive integer');
const partnerIndices = option('--partner-sources').split(',').map(Number);
const text = fs.readFileSync(input, 'utf8'), expected = JSON.parse(text);
if (!expected.inputs?.sources?.length || !expected.inputs?.opponents?.length) throw Error('Saved compiled sources and opponents are required');
if (expected.execution?.backend === 'gpu') throw Error('The reference must be a CPU evolution');
if (expected.config.objective !== 'pushoff') throw Error('This replay expects a push-off objective');
if (partnerIndices.some(i => !Number.isSafeInteger(i) || i < 0 || !expected.inputs.sources[i]?.w)) throw Error('Invalid partner source index');
if (fs.existsSync(out) && fs.readdirSync(out).length) throw Error('Use a new, empty output directory');
fs.mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const canonical = value => JSON.parse(JSON.stringify(value));
function difference(actual, wanted, where = '') {
  if (Object.is(actual, wanted)) return null;
  if (actual === null || wanted === null || typeof actual !== 'object' || typeof wanted !== 'object') return { path: where, actual, expected: wanted };
  if (Array.isArray(actual) !== Array.isArray(wanted)) return { path: where, actualType: typeof actual, expectedType: typeof wanted };
  const aKeys = Object.keys(actual).sort(), bKeys = Object.keys(wanted).sort();
  if (JSON.stringify(aKeys) !== JSON.stringify(bKeys)) return { path: where, actualKeys: aKeys, expectedKeys: bKeys };
  for (const key of aKeys) { const diff = difference(actual[key], wanted[key], where + '/' + key); if (diff) return diff; }
  return null;
}
function requireMatch(actual, wanted, context) {
  const diff = difference(canonical(actual), canonical(wanted));
  if (diff) throw Error(context + ': ' + JSON.stringify(diff));
}
const partners = partnerIndices.map(i => expected.inputs.sources[i].w);
const program = w => ({ start: w.start, instructions: w.instructions.map(({op,mod,aMode,a,bMode,b})=>({op,mod,aMode,a,bMode,b})) });
const report = { status: 'running', pid: process.pid, startedAt: new Date().toISOString(), reference: input, referenceSha256: sha(text),
  config: expected.config, sources: expected.inputs.sources.length, opponents: expected.inputs.opponents.length,
  sourcesSha256: sha(expected.inputs.sources), opponentsSha256: sha(expected.inputs.opponents),
  partnerSources: partnerIndices, partnerHashes: partners.map(w=>sha(program(w))), fieldRounds,
  legacyMetadata: 'Partner source indices and fieldRounds supplied explicitly; all programs and their order come from the saved report',
  timing: 'From reading the saved report through GPU initialization, evolution, checks and output writing; excludes CLI source compilation and hill fetching',
  generations: [] };
const save = () => fs.writeFileSync(path.join(out,'replay.json'),JSON.stringify(report,null,2));
save();
let pool;
const heartbeat = setInterval(() => {
  report.elapsedSeconds = (performance.now()-started)/1000;
  const cpu = process.cpuUsage(cpuStart); report.hostCpuSeconds = (cpu.user+cpu.system)/1000000;
  if (pool) report.execution = structuredClone(pool.stats);
  save(); console.error('Replay progress: ' + report.elapsedSeconds.toFixed(1) + ' seconds; ' + (pool?.stats.matches ?? 0) + ' completed matches; ' + report.generations.length + ' generations matched');
}, 30000);
heartbeat.unref();
try {
  console.error('Replaying ' + expected.config.rounds + ' generations on strict GPU using ' + report.sources + ' pinned sources and ' + report.opponents + ' opponents');
  pool = await createGpuPool();
  const geo = expected.config.settings.topology === 'torus' ? makeGeometry(expected.config.settings) : null;
  const result = await evolve({ ...expected.config, ...expected.inputs, partners, fieldRounds, pool,
    onLog(message) { console.error(message + '; ' + pool.stats.matches + ' matches, ' + pool.stats.rounds + ' rounds'); },
    onRound(rec) {
      const c = rec.champion, file = 'redqueen-' + rec.round + '.red';
      const source = toRedcode(c.g, { name: c.name, coreSize: expected.config.settings.coreSize, geo,
        dialect: expected.config.settings.dialect,
        strategy: 'Champion of Red Queen generation ' + rec.round + ' (zorewars evolve): ' + c.species.hint + ', ' + c.species.processes + ' processes, ' + c.species.coverage + ' cells.' });
      fs.writeFileSync(path.join(out,file),source);
      const oldText = fs.readFileSync(path.join(path.dirname(input),file),'utf8');
      const oldW = compile(oldText,'redcode',expected.config.entrySettings), newW = compile(source,'redcode',expected.config.entrySettings);
      if (!oldW.ok || !newW.ok) throw Error('Champion export compilation failed');
      requireMatch(program(newW),program(oldW),'Generation ' + rec.round + ' champion program');
      requireMatch(rec,expected.history.find(r=>r.round===rec.round),'Generation ' + rec.round + ' complete history');
      report.generations.push({ round:rec.round, genomeId:c.id, fit:c.fit, programMatches:true, textMatches:source===oldText, historyMatches:true });
      report.elapsedSeconds = (performance.now()-started)/1000; report.execution = structuredClone(pool.stats); save();
      console.error('Generation ' + rec.round + ': champion, fitness, places and history match the saved CPU run (' + report.elapsedSeconds.toFixed(2) + ' seconds elapsed)');
    },
  });
  result.inputs = expected.inputs;
  const { execution, ...comparison } = expected;
  requireMatch(result,comparison,'Complete evolution');
  if (sha(fs.readFileSync(input,'utf8')) !== report.referenceSha256) throw Error('Reference changed while replaying');
  const snapshots = result.archive.map(x=>({ ...x }));
  for (const x of snapshots) {
    const [p,c,s] = x.cell.split(','), tag = 'p'+p+'-c'+c+(s?'-s'+s:'');
    fs.writeFileSync(path.join(out,'elite-'+tag+'.red'),toRedcode(x.g,{name:'Elite '+tag.replaceAll('-',' '),coreSize:expected.config.settings.coreSize,geo,dialect:expected.config.settings.dialect,
      strategy:'Best evolved '+x.species.hint+' ('+x.species.processes+' processes, '+x.species.coverage+' cells), zorewars evolve.'}));
  }
  result.execution = structuredClone(pool.stats);
  fs.writeFileSync(path.join(out,'evolve.json'),JSON.stringify(result,null,1));
  pool.close();
  report.status='passed'; report.completeEvolutionMatches=true; report.stats=result.stats;
  report.execution=result.execution; report.elapsedSeconds=(performance.now()-started)/1000; const cpu=process.cpuUsage(cpuStart); report.hostCpuSeconds=(cpu.user+cpu.system)/1000000; report.finishedAt=new Date().toISOString();
  save(); console.log(JSON.stringify({status:report.status,seconds:report.elapsedSeconds,generationsMatched:report.generations.length,stats:report.stats,execution:report.execution,out},null,2));
} catch(error) {
  report.status='failed'; report.error=error.message; report.elapsedSeconds=(performance.now()-started)/1000; if(pool) report.execution=structuredClone(pool.stats); save(); throw error;
} finally { clearInterval(heartbeat); pool?.close(); }
