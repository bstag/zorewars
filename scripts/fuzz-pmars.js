#!/usr/bin/env node
// Differential fuzzer for the assembler: random Redcode programs, assembled by
// pMARS (-A, assemble only) and by ZoreWars, compared on accept/reject, the
// instructions (fields modulo the core size) and the start. Black box: it
// runs the pMARS executable and never reads pMARS's source.
//
//   node scripts/fuzz-pmars.js --pmars path/to/pmars [--cases 2000] [--seed 1] [--out dir] [--corpus dir]
// Use a fixed copy of the .red seed corpus for comparable campaign reruns.
// summary.json records the seed, reference hash, corpus hashes and totals.
// Configure both sides with --rules 88|94 --core N --length N --processes N
// --cycles N [--distance N] [--pspace N]. '88 generation mostly uses legal
// opcodes/modes, retaining a minority of '94 forms to check rejection.
//
// Programs come from two places: a grammar that mixes the preprocessor's
// features (EQU text and chains, multi-line EQU macros, FOR/ROF with
// counters and & pasting, CURLINE, registers, asserts, labels, ORG/END,
// comments, line continuation, every expression operator), and mutations of
// the clean-room probes in test/pmars-clean-room/. Each mismatch is shrunk by
// deleting lines while it persists, and written to the output folder with
// both sides' results.
//
// Out of scope, so not reported: empty programs (pMARS -A accepts them,
// ZoreWars can't run them), a start outside the program, and labels inside
// multi-line EQU macros.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { createProgramGenerator } from './pmars-programs.js';
import { compareAssembly } from './pmars-comparison.js';
import { referenceOutcome } from './pmars-result.js';
import { parseListing, settingsFromArgs } from './pmars-assembly.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : dflt; };
const PMARS = opt('pmars') || process.env.PMARS;
if (!PMARS || !fs.existsSync(PMARS)) {
  console.error('usage: node scripts/fuzz-pmars.js --pmars path/to/pmars [--cases 2000] [--seed 1] [--out dir]');
  process.exit(2);
}
const CASES = parseInt(opt('cases', '2000'), 10);
const SEED = parseInt(opt('seed', '1'), 10);
const RULES = opt('rules', '94');
if (!['94', '88'].includes(RULES)) throw new Error('--rules must be 94 or 88');
// Freeze the mutation corpus for a campaign, so adding regressions does not
// change which programs a seed generates during a verification rerun.
const CORPUS = path.resolve(opt('corpus', path.join(ROOT, 'test/pmars-clean-room')));
const OUT = opt('out', fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-fuzz-')));
fs.mkdirSync(OUT, { recursive: true });
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-fuzz-work-'));
const CORE = Number(opt('core', String(DEFAULT_SETTINGS.coreSize)));
const REFERENCE_ARGS = ['-A', ...(RULES === '88' ? ['-8'] : []),
  '-s', String(CORE), '-l', opt('length', String(Math.min(100, CORE))),
  '-p', opt('processes', '8000'), '-c', opt('cycles', '80000')];
if (opt('distance')) REFERENCE_ARGS.push('-d', opt('distance'));
if (opt('pspace')) REFERENCE_ARGS.push('-S', opt('pspace'));
// pMARS -A assembles one warrior: WARRIORS is 1, and a false ;assert rejects.
const SETTINGS = settingsFromArgs(REFERENCE_ARGS);
const norm = (v) => ((v % CORE) + CORE) % CORE;
const format = i => `${i.op}${RULES === '88' ? '' : `.${i.mod}`} ${i.aMode}${norm(i.a)}, ${i.bMode}${norm(i.b)}`;

// ---- both sides ----
function reference(text) {
  const file = path.join(WORK, 'case.red');
  fs.writeFileSync(file, text);
  const r = spawnSync(PMARS, [...REFERENCE_ARGS, file], { encoding: 'latin1', timeout: 5000 });
  const outcome = referenceOutcome(r);
  if (!['accepted', 'rejected'].includes(outcome)) return { outcome, status: r.status, signal: r.signal, error: r.error?.message, stdout: r.stdout, stderr: r.stderr };
  const parsed = parseListing(r.stdout || '', CORE);
  const ok = r.status === 0;
  return { ok, ins: parsed.ins.map(format), start: parsed.start, out: `${r.stdout}\n${r.stderr}` };
}
function ours(text) {
  fs.writeFileSync(path.join(OUT, 'last-case.red'), text);   // left behind if ZoreWars itself crashes
  try {
    const w = compile(text, 'redcode', SETTINGS);
    return { ok: w.ok, ins: w.ok ? w.instructions.map(format) : [], start: w.ok ? norm(w.start) : 0, errors: w.errors, warnings: w.warnings };
  } catch (e) {
    return { ok: false, crash: String(e.stack || e) };
  }
}
// The kind of difference, or null if both agree. (Empty programs are a
// deliberate difference: pMARS -A accepts them, ZoreWars can't run them.)
const agree = { accepted: 0, rejected: 0, timeout: 0, crash: 0, inconsistent: 0, 'launch-error': 0, skippedEmpty: 0 };
function differ(t, count = false) {
  const a = reference(t);
  if (a.outcome) {
    if (count) {
      const n = ++agree[a.outcome];
      const id = `reference-${a.outcome}-${String(n).padStart(3, '0')}`;
      fs.writeFileSync(path.join(OUT, `${id}.red`), t);
      fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(a, null, 2));
    }
    return null;
  }
  const b = ours(t);
  const result = compareAssembly(a,b);
  if (result.agreement && count) agree[result.agreement]++;
  return result.kind;

}

// ---- programs ----
const {generated,instruction,pick,r,chance,mutated:mutate} = createProgramGenerator({seed:SEED,coreSize:CORE,rules:RULES});
const SEED_FILES = fs.readdirSync(CORPUS).filter((f) => f.endsWith('.red')).sort();
const SEEDS = SEED_FILES.map((f) => fs.readFileSync(path.join(CORPUS, f), 'latin1'));
const mutated=()=>mutate(SEEDS);

// Delete lines while the same kind of difference remains.
function shrink(text, kind) {
  let lines = text.split('\n');
  for (let changed = true; changed;) {
    changed = false;
    for (let i = lines.length - 1; i >= 1; i--) {
      const trial = [...lines.slice(0, i), ...lines.slice(i + 1)];
      if (differ(trial.join('\n')) === kind) { lines = trial; changed = true; }
    }
  }
  return lines.join('\n');
}

// ---- run ----
const kinds = {};
const seen = new Set();
const t0 = Date.now();
let saved = 0;
for (let n = 1; n <= CASES; n++) {
  const text = chance(0.65) ? generated() : mutated();
  const kind = differ(text, true);
  if (kind) {
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    const small = shrink(text, kind);
    const key = `${kind}|${small.replace(/\d+/g, 'N')}`;
    if (!seen.has(key)) {
      seen.add(key);
      saved++;
      const a = reference(small), b = ours(small);
      fs.writeFileSync(path.join(OUT, `${String(saved).padStart(3, '0')}-${kind}.red`), small);
      fs.writeFileSync(path.join(OUT, `${String(saved).padStart(3, '0')}-${kind}.txt`), [
        `kind: ${kind}`, '', '--- pMARS', `accepted: ${a.ok}  start: ${a.start}`, ...a.ins, '', a.out?.trim() ?? '',
        '', '--- ZoreWars', `accepted: ${b.ok}  start: ${b.start}`, ...(b.ins ?? []), '', ...(b.errors ?? []).map((e) => `error line ${e.line}: ${e.message}`), b.crash ?? '',
      ].join('\n'));
    }
  }
  if (n % 200 === 0) process.stderr.write(`\r${n}/${CASES} cases, ${Object.values(kinds).reduce((s, v) => s + v, 0)} mismatches, ${saved} distinct (${Math.round((Date.now() - t0) / 1000)}s)`);
}
process.stderr.write('\n');
console.log(`${CASES} programs (seed ${SEED}): ${agree.accepted} accepted identically by both, ${agree.rejected} rejected by both, ${agree.skippedEmpty} empty programs excluded; pMARS: ${agree.timeout} timeouts, ${agree.crash} crashes, ${agree.inconsistent} inconsistent results, ${agree['launch-error']} launch errors; ${Object.values(kinds).reduce((s, v) => s + v, 0)} mismatches, ${saved} distinct after shrinking`);
for (const [k, v] of Object.entries(kinds)) console.log(`  ${k}: ${v}`);
console.log(`cases written to ${OUT}`);
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
  seed: SEED, cases: CASES, agree, mismatches: kinds, distinct: saved,
  rules: RULES, settings: SETTINGS, referenceArgs: REFERENCE_ARGS,
  executableSha256: crypto.createHash('sha256').update(fs.readFileSync(PMARS)).digest('hex'),
  corpus: SEED_FILES.map((file, i) => ({ file, sha256: crypto.createHash('sha256').update(Buffer.from(SEEDS[i], 'latin1')).digest('hex') })),
}, null, 2));
