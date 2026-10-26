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
import { compile, DEFAULT_SETTINGS, RULESETS } from '../src/engine/index.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pmars-clean-room');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const CORE = DEFAULT_SETTINGS.coreSize;
const norm = (v) => ((v % CORE) + CORE) % CORE;

// The reference's -A listing: an ORG line (a number, or START for the
// instruction labelled START), then one line per instruction ('88 listings
// have no modifiers).
export function parseListing(text) {
  const ins = [];
  let org = null, startLabel = -1;
  for (const line of text.split(/\r?\n/)) {
    const o = /^\s+ORG\s+(\S+)/.exec(line);
    if (o) { org = o[1]; continue; }
    const m = /^(\S*)\s+([A-Z]{3})(?:\.(AB|BA|A|B|F|X|I))?\s+([#$*@{<}>])\s*(-?\d+),\s*([#$*@{<}>])\s*(-?\d+)/.exec(line);
    if (!m) continue;
    if (m[1] === 'START') startLabel = ins.length;
    ins.push({ op: m[2] === 'CMP' ? 'SEQ' : m[2], mod: m[3], aMode: m[4], a: norm(+m[5]), bMode: m[6], b: norm(+m[7]) });
  }
  const start = org === null || org === 'START' ? Math.max(0, startLabel) : +org;
  return { ins, start };
}

export function runCase(c) {
  const source = fs.readFileSync(path.join(dir, c.file), 'latin1');
  // The reference's conditions: assembling one warrior (WARRIORS is 1), and a
  // false ;assert rejects it (ZoreWars does that under hill rules only).
  const settings = { ...(c.args.includes('-8') ? RULESETS['88'] : DEFAULT_SETTINGS), assertErrors: true, warriors: 1 };
  const ours = compile(source, 'redcode', settings);
  const theirsOk = c.exitCode === 0;
  if (ours.ok !== theirsOk) return `${theirsOk ? 'reference accepts, we reject' : 'reference rejects, we accept'}${ours.ok ? '' : ` (${ours.errors[0]?.message})`}`;
  if (!theirsOk) return null;
  const want = parseListing(fs.readFileSync(path.join(dir, c.stdout), 'latin1'));
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
