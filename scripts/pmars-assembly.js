// Settings and listing interpretation for black-box pMARS assembly runs.
import { DEFAULT_SETTINGS } from '../src/engine/constants.js';

export function settingsFromArgs(args) {
  const settings = { ...DEFAULT_SETTINGS, assertErrors: true, warriors: 1 };
  const fields = { '-s': 'coreSize', '-p': 'maxProcesses', '-c': 'maxCycles', '-l': 'maxLength', '-d': 'minDistance', '-S': 'pSpaceSize', '-r': 'rounds' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-8') { settings.dialect = '88'; settings.pSpace = false; }
    else if (fields[args[i]]) {
      const field = fields[args[i]];
      const value = Number(args[++i]);
      if (!Number.isInteger(value) || value <= 0) throw new Error(`invalid pMARS ${field}`);
      settings[field] = value;
    }
  }
  if (!args.includes('-d')) settings.minDistance = settings.maxLength;
  return settings;
}

export function parseListing(text, coreSize = DEFAULT_SETTINGS.coreSize) {
  const norm = v => ((v % coreSize) + coreSize) % coreSize;
  const ins = [];
  let org = null, startLabel = -1;
  for (const line of text.split(/\r?\n/)) {
    const origin = /^\s+ORG\s+(\S+)/.exec(line);
    if (origin) { org = origin[1]; continue; }
    const m = /^(\S*)\s+([A-Z]{3})(?:\.(AB|BA|A|B|F|X|I))?\s+([#$*@{<}>])\s*(-?\d+),\s*([#$*@{<}>])\s*(-?\d+)/.exec(line);
    if (!m) continue;
    if (m[1] === 'START') startLabel = ins.length;
    ins.push({ op: m[2] === 'CMP' ? 'SEQ' : m[2], mod: m[3], aMode: m[4], a: norm(+m[5]), bMode: m[6], b: norm(+m[7]) });
  }
  return { ins, start: org === null || org === 'START' ? Math.max(0, startLabel) : norm(+org) };
}
