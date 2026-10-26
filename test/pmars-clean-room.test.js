// The clean-room pMARS corpus (test/pmars-clean-room/): original Redcode
// probes whose listings were captured from a pMARS 0.9.5 reference run, with
// no reference source involved (see docs/clean-room/). For each probe the
// assembler must accept or reject as the reference did and, when it accepts,
// produce the same instructions (fields modulo the core size) and start.
// Wording of warnings and errors is not compared.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../src/engine/index.js';
import crypto from 'node:crypto';
import { referenceOutcome } from '../scripts/pmars-result.js';
import { parseListing, settingsFromArgs } from '../scripts/pmars-assembly.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pmars-clean-room');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
export { parseListing };

export function runCase(c) {
  const stdout = fs.readFileSync(path.join(dir, c.stdout), 'latin1');
  const stderr = fs.readFileSync(path.join(dir, c.stderr), 'latin1');
  const outcome = referenceOutcome({ status: c.exitCode, signal: c.signal, error: c.error, errorCode: c.errorCode, stdout, stderr });
  // A failed reference process supplies no Redcode language verdict.
  if (!['accepted', 'rejected'].includes(outcome)) return null;
  const source = fs.readFileSync(path.join(dir, c.file), 'latin1');
  // The reference's conditions: assembling one warrior (WARRIORS is 1), and a
  // false ;assert rejects it (ZoreWars does that under hill rules only).
  const settings = settingsFromArgs(c.args);
  const norm = v => ((v % settings.coreSize) + settings.coreSize) % settings.coreSize;
  const ours = compile(source, 'redcode', settings);
  const theirsOk = c.exitCode === 0;
  if (ours.ok !== theirsOk) return `${theirsOk ? 'reference accepts, we reject' : 'reference rejects, we accept'}${ours.ok ? '' : ` (${ours.errors[0]?.message})`}`;
  if (!theirsOk) return null;
  const name = /^Program "([^"]*)"/m.exec(stdout)?.[1];
  if (name !== undefined && ours.name !== name) return `name ${ours.name}, reference ${name}`;
  const want = parseListing(stdout, settings.coreSize);
  const got = ours.instructions.map((i) => ({ op: i.op, mod: i.mod, aMode: i.aMode, a: norm(i.a), bMode: i.bMode, b: norm(i.b) }));
  const fmt = (i) => `${i.op}${i.mod ? `.${i.mod}` : ''} ${i.aMode}${i.a}, ${i.bMode}${i.b}`;
  if (got.length !== want.ins.length) return `${got.length} instructions, reference ${want.ins.length}: ours [${got.map(fmt).join(' | ')}] reference [${want.ins.map(fmt).join(' | ')}]`;
  for (let k = 0; k < got.length; k++) {
    const a = got[k], b = { ...want.ins[k], mod: want.ins[k].mod ?? a.mod };
    if (fmt(a) !== fmt(b)) return `instruction ${k}: ours ${fmt(a)}, reference ${fmt(b)}`;
  }
  if (ours.start !== want.start) return `start ${ours.start}, reference ${want.start}`;
  return null;
}

// Deliberate differences, each with its reason.
const EXCEPTIONS = {
  // pMARS -A assembles an empty program (with warnings) but can't run it; a
  // ZoreWars warrior must have an instruction to play.
  blank: 'reference accepts, we reject (program has no instructions)',
  'for-unclosed-zero': 'reference accepts, we reject (program has no instructions)',   // FOR 0 with no ROF swallows it all
};

test('the clean-room pMARS corpus: every probe assembles as the reference did', () => {
  const failures = manifest.cases.map((c) => [c.id, runCase(c)]).filter(([id, why]) => why && why !== EXCEPTIONS[id]);
  assert.deepEqual(failures.map(([id, why]) => `${id}: ${why}`), []);
});

test('captured pMARS evidence has matching hashes, outcomes and summary', () => {
  const summary = { cases: manifest.cases.length, accepted: 0, rejected: 0, warnings: 0, executionFailures: 0 };
  for (const c of manifest.cases) {
    for (const [file, hash] of [[c.file, c.sourceSha256], [c.stdout, c.stdoutSha256], [c.stderr, c.stderrSha256]]) {
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex'), hash, file);
    }
    const stderr = fs.readFileSync(path.join(dir, c.stderr), 'latin1');
    const stdout = fs.readFileSync(path.join(dir, c.stdout), 'latin1');
    const outcome = referenceOutcome({ status: c.exitCode, signal: c.signal, error: c.error, errorCode: c.errorCode, stdout, stderr });
    if (c.outcome) assert.equal(c.outcome, outcome, c.id);
    if (outcome === 'accepted') summary.accepted++;
    else if (outcome === 'rejected') summary.rejected++;
    else summary.executionFailures++;
    if (/\bWarning\b/.test(stderr)) summary.warnings++;
  }
  assert.deepEqual(manifest.summary, summary);
  const crash = manifest.cases.find(c => c.id === 'fuzz-reference-access-violation');
  assert.equal(crash.outcome, 'crash');
});

test('a skipped one-line EQU/FOR has no unclosed-loop warning, as captured', () => {
  for (const id of ['fuzz-macro-for-zero', 'fuzz-macro-for-negative']) {
    const c = manifest.cases.find(c => c.id === id);
    assert.equal(fs.readFileSync(path.join(dir, c.stderr), 'utf8'), '');
    const ours = compile(fs.readFileSync(path.join(dir, c.file), 'utf8'));
    assert.equal(ours.ok, true);
    assert.equal(ours.warnings.some(w => /never closes|matching ROF/.test(w.message)), false);
  }
});
