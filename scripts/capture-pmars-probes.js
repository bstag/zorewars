#!/usr/bin/env node
// Captures pMARS's output for probe programs into the clean-room corpus
// (test/pmars-clean-room/manifest.json): exact arguments, exit code, raw
// stdout/stderr and SHA-256 hashes, as the original 81 probes were captured.
// It runs the pMARS executable only; no pMARS source is involved.
//
//   node scripts/capture-pmars-probes.js --pmars path/to/pmars --origin differential-fuzzer probe.red...
//
// Probes are files in test/pmars-clean-room/; '88 probes (named 88-*) get -8.
// A probe already in the manifest is captured again and replaced.
// --metadata uses a one-cycle run so the listing includes the program name.
// Recapturing an existing case preserves its arguments without that flag.
// --args '["-A","-8","-s","80","-l","5"]' supplies exact reference flags
// (no filename), for example the referenceArgs array from a fuzz summary.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { referenceOutcome } from './pmars-result.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'test/pmars-clean-room');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const PMARS = opt('pmars');
const ORIGIN = opt('origin') ?? 'differential-fuzzer';
// Exact reference flags from a fuzz summary, excluding the input filename.
const explicitArgs = opt('args');
const referenceArgs = explicitArgs ? JSON.parse(explicitArgs) : null;
if (referenceArgs && (!Array.isArray(referenceArgs) || referenceArgs.some(a => typeof a !== 'string'))) throw new Error('--args must be a JSON array of reference arguments');
const metadataAt = argv.indexOf('--metadata');
const METADATA = metadataAt >= 0;
if (METADATA) argv.splice(metadataAt, 1);
if (!PMARS || !argv.length) {
  console.error('usage: node scripts/capture-pmars-probes.js --pmars path/to/pmars [--origin name] probe.red...');
  process.exit(2);
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const banner = spawnSync(PMARS, [], { encoding: 'latin1', timeout: 5000 });
const version = `${banner.stdout ?? ''}${banner.stderr ?? ''}`.match(/pMARS v[^\r\n]*/)?.[0] ?? 'pMARS (version unknown)';
const executableSha256 = sha(fs.readFileSync(PMARS));
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
for (const arg of argv) {
  const file = path.basename(arg);
  const id = file.replace(/\.red$/i, '');
  const existing = manifest.cases.find((c) => c.id === id);
  const args = referenceArgs ? [...referenceArgs, file] : METADATA ? ['-r', '1', '-c', '1', file] : existing?.args ?? ['-A', ...(id.startsWith('88-') ? ['-8'] : []), file];
  const r = spawnSync(PMARS, args, { cwd: DIR, timeout: 5000 });
  const stdout = `${id}.stdout.txt`, stderr = `${id}.stderr.txt`;
  fs.writeFileSync(path.join(DIR, stdout), r.stdout ?? Buffer.alloc(0));
  fs.writeFileSync(path.join(DIR, stderr), r.stderr ?? Buffer.alloc(0));
  const entry = {
    id, file, args, exitCode: r.status, signal: r.signal, error: r.error ? String(r.error) : null, errorCode: r.error?.code ?? null, stdout, stderr,
    sourceSha256: sha(fs.readFileSync(path.join(DIR, file))),
    stdoutSha256: sha(fs.readFileSync(path.join(DIR, stdout))),
    stderrSha256: sha(fs.readFileSync(path.join(DIR, stderr))),
    origin: ORIGIN, reference: version, executableSha256, outcome: referenceOutcome(r), capturedOn: new Date().toISOString().slice(0, 10),
  };
  const at = manifest.cases.findIndex((c) => c.id === id);
  if (at >= 0) manifest.cases[at] = entry; else manifest.cases.push(entry);
  console.log(`${id}: exit ${r.status}`);
}
manifest.summary = { cases: manifest.cases.length, accepted: 0, rejected: 0, warnings: 0, executionFailures: 0 };
for (const c of manifest.cases) {
  const stderr = fs.readFileSync(path.join(DIR, c.stderr), 'latin1');
  const stdout = fs.readFileSync(path.join(DIR, c.stdout), 'latin1');
  const outcome = c.outcome ?? referenceOutcome({ status: c.exitCode, signal: c.signal, error: c.error, errorCode: c.errorCode, stdout, stderr });
  if (outcome === 'accepted') manifest.summary.accepted++;
  else if (outcome === 'rejected') manifest.summary.rejected++;
  else manifest.summary.executionFailures++;
  if (/\bWarning\b/.test(stderr)) manifest.summary.warnings++;
}
fs.writeFileSync(path.join(DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
