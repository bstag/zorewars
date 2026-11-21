import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readInstructionCheckpoint } from '../tools/evolution/instructions/checkpoint.js';

const executionKeys = ['native', 'wasm', 'backend', 'gpu-adapter', 'gpu-batch'];
const resumeKeys = new Set([...executionKeys, 'threads', 'json', 'resume', 'checkpoint', 'stop-after', 'generations', 'out', 'representation']);

export function checkpointRequest(args, usage) {
  const { flags } = args;
  const has = key => Object.hasOwn(flags, key);
  for (const key of ['resume', 'checkpoint']) {
    if (has(key) && (!flags[key] || flags[key].startsWith('--'))) usage(`--${key} needs a checkpoint path`);
  }
  const file = flags.checkpoint ?? flags.resume;
  const stopAfter = has('stop-after') ? Number(flags['stop-after']) : undefined;
  if (has('stop-after') && (!file || !Number.isSafeInteger(stopAfter) || stopAfter < 1)) {
    usage('--stop-after needs a positive generation number and --checkpoint or --resume');
  }
  if (!flags.resume) return { file, stopAfter };
  const unexpected = Object.keys(flags).find(key => !resumeKeys.has(key));
  if (args._.length || unexpected) {
    usage(`--resume uses the saved warriors and search settings${unexpected ? ` (remove --${unexpected})` : ''}`);
  }
  let resume, saved;
  try {
    resume = JSON.parse(fs.readFileSync(flags.resume, 'utf8'));
    saved = readInstructionCheckpoint(resume);
    if (!resume.cli?.out || !resume.cli.execution || !resume.cli.validation) throw new Error('Missing CLI run settings');
  } catch (error) {
    usage(`Cannot resume ${flags.resume}: ${error.message}`);
  }
  const generations = has('generations') ? Number(flags.generations) : saved.options.rounds;
  if (!Number.isSafeInteger(generations) || generations < saved.state.round) {
    usage(`--generations must be at least the saved generation (${saved.state.round})`);
  }
  if (stopAfter !== undefined && stopAfter <= saved.state.round && generations > saved.state.round) {
    usage(`--stop-after must be later than the saved generation (${saved.state.round})`);
  }
  const execution = { ...resume.cli.execution };
  if (executionKeys.some(has)) for (const key of executionKeys) delete execution[key];
  return { file, stopAfter, resume, options: saved.options, generations, execution };
}

export function checkpointExecution(flags) {
  return Object.fromEntries([...executionKeys, 'threads'].filter(key => flags[key] !== undefined).map(key => [key, flags[key]]));
}

export function writeCheckpoint(file, checkpoint, cli) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ ...checkpoint, cli }), { flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
