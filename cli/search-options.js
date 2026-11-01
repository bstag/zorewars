// Validate local search requests before loading fields, workers or model clients.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_MODEL } from '../tools/refine.js';

function positiveInteger(flags, key, fallback, usage) {
  const value = Number(flags[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) usage(`--${key} must be a positive integer`);
  return value;
}

export function tuneOptions(args, usage) {
  if (args._.length !== 1) usage('tune needs exactly one JavaScript warrior');
  const file = args._[0];
  if (!/\.js$/i.test(file) || !fs.existsSync(file)) usage('tune works on a JavaScript warrior file with a // SPACE comment and a const P = {...}; line');
  return { file, json: !!args.flags.json,
    candidates: positiveInteger(args.flags, 'candidates', 40, usage), seeds: positiveInteger(args.flags, 'seeds', 3, usage) };
}

export function refineOptions(args, usage) {
  if (args._.length !== 1) usage('refine needs exactly one Redcode warrior');
  const file = args._[0], flags = { ...args.flags };
  if (!/\.(red|rc)$/i.test(file) || !fs.existsSync(file)) usage('refine works on a Redcode file (convert a generator first with: zorewars compile <file>)');
  const integer = (key, fallback) => positiveInteger(flags, key, fallback, usage);
  const objective = flags.objective ?? 'points';
  if (!['points', 'pushoff'].includes(objective)) usage('--objective takes points or pushoff');
  if (flags.partner && objective !== 'pushoff') usage('--partner needs --objective pushoff');
  // A push-off needs a field. Default to the chosen rules' hill without changing
  // the caller's flags; explicit fields and --top continue to take precedence.
  if (objective === 'pushoff' && !flags.hill) {
    const hill = { '94nop': '94nop', 88: '88', lp: 'lp', '94x': '94x' }[flags.rules];
    if (!hill) usage('--objective pushoff needs --hill, or --rules 94nop|88|lp|94x to use that Koenigstuhl hill');
    flags.hill = `koenigstuhl:${hill}`;
    flags.top ??= '30';
  }
  const effort = flags.effort ?? 'high';
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) usage('--effort takes low, medium, high, xhigh or max');
  const budget = Number(flags.budget ?? 5);
  if (!Number.isFinite(budget) || budget <= 0) usage('--budget takes a number of dollars');
  const model = flags.model ?? DEFAULT_MODEL, turns = integer('turns', 20);
  const search = { iterations: integer('iterations', 3), variants: integer('variants', 4), rounds: integer('rounds', 20),
    checkRounds: integer('check-rounds', 30), seeds: integer('seeds', objective === 'pushoff' ? 6 : 3), seed: integer('seed', 1),
    fieldRounds: integer('field-rounds', 50), objective, turns, budget, model };
  return { file, flags, json: !!flags.json, out: flags.out ?? path.join('refined', path.basename(file)), search, proposer: { model, effort, turns } };
}
