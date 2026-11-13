import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RULESETS } from '../../src/engine/index.js';
import { buildTree, recipes } from '../../tools/algebra/index.js';
import { deployment, scoreDeployments, traceDeployment } from './replay-lp-phase-deployment.mjs';
import { assemble } from './stateless-replay.mjs';

const settings = RULESETS['lp-hill'];
const bodyStarts = [2000, 2156, 5961, 6117];

export function traceDisciples(built, opponent, options) {
  const stone = built.HOP + built.labels.b3launch;
  const live = new Set(Array.from({ length: built.spans.b3.size }, (_, i) => stone + i));
  const contacts = [];
  const firstClears = {};
  const clearTriggers = {};
  let firstLockExecution = null;
  const battle = traceDeployment(built, opponent, options, [], ({ vm, actor, pc, instruction, from, to, origin, previous, lineageQueue }) => {
    const base = vm.warriors[0].position;
    const enemyBase = vm.warriors[1].position;
    const relative = address => vm.norm(address - base);
    const enemyPc = vm.norm(pc - enemyBase);
    const cell = relative(to);
    const turn = vm.steps;
    if (!firstLockExecution && actor === 0 && origin === 'stone' && instruction.op === 'JMP' && instruction.aMode === '#'
      && instruction.a === 0 && previous?.origin === 'enemy') {
      firstLockExecution = { turn, cell: relative(pc), write: previous.turn, queue: lineageQueue() };
    }
    if (actor !== 1) return;
    const scanner = bodyStarts.find(start => enemyPc >= start && enemyPc <= start + 5);
    if (scanner === undefined) return;
    const phase = enemyPc - scanner;
    if (phase === 1 && instruction.op === 'JMZ' && instruction.mod === 'A' && live.has(cell)) {
      contacts.push({ kind: 'probe', turn, scanner, cell, a: vm.peek(to).a,
        fellThrough: vm.processes(1).at(-1) === vm.norm(pc + 1) });
    }
    if (phase === 3 && instruction.op === 'JMN' && instruction.mod === 'A'
      && vm.processes(1).at(-1) === vm.norm(pc + 1)) {
      clearTriggers[scanner] ??= { turn, guard: relative(pc), probe: cell, probeA: vm.peek(to).a, lastProbeWrite: vm.lastWrite[to] };
    }
    if (instruction.op !== 'MOV' || instruction.mod !== 'I' || vm.lastWrite[to] !== turn) return;
    const payload = vm.peek(to).op;
    if (phase === 5) firstClears[scanner] ??= { turn, cell, payload };
    if (live.has(cell)) {
      contacts.push({ kind: phase === 2 ? 'trap-write' : phase === 5 ? 'clear-write' : 'other-write',
        turn, scanner, cell, source: relative(from), payload });
    }
  });
  return { contacts, clearTriggers, firstClears, firstLockExecution, battle };
}

function quietTrace(built, base) {
  let firstReturnCopy = null;
  const trace = traceDeployment(built, null, { positions: [base] }, [], ({ vm, origin, instruction, from, to }) => {
    if (!firstReturnCopy && origin === 'paper' && instruction.op === 'MOV' && instruction.mod === 'I'
      && from === vm.norm(base + built.labels.b3back)) {
      firstReturnCopy = { turn: vm.steps, target: vm.norm(to - base), instruction: vm.disassemble(to) };
    }
  });
  return { ...trace, firstReturnCopy };
}

function main(file) {
  if (!file) throw new Error('Pass the archived Disciples of the Void Redcode file');
  const opponent = assemble(readFileSync(file, 'utf8'), file, settings);
  const baseline = deployment(5952, { STEP: 160, OFFSET: 46 });
  const hidden = deployment(5952, { STEP: 160, OFFSET: 46, HIDERETURN: 1 });
  const direct = baseline.w.instructions[baseline.labels.b3back];
  const sameB = { ...baseline, w: { ...baseline.w, instructions: baseline.w.instructions.map((ins, i) =>
    i === baseline.labels.b3back ? { ...direct, b: direct.a } : ins) } };
  const candidates = [['baseline', baseline], ['sameB', sameB], ['hidden', hidden]];
  buildTree(recipes['lp-hidden-return-paper'].tree(), { rules: 'lp-hill', verification: 'full' });
  const quiet = Object.fromEntries(candidates.map(([name, built]) => {
    const trace = quietTrace(built, 0);
    assert.deepEqual(quietTrace(built, 7997), { ...trace, positions: [7997] });
    return [name, trace];
  }));
  const sample = [{ positions: [0, 630], firstTurn: 0 }, { positions: [0, 3648], firstTurn: 1 }];
  const traces = sample.map(options => Object.fromEntries(candidates.map(([name, built]) =>
    [name, traceDisciples(built, opponent, options)])));
  const panels = [[23033, 49139], [38177, 57347], [47041, 61169]].map(seeds => {
    const rounds = 64;
    const results = scoreDeployments(opponent, candidates.map(([name, built]) => [name, built.w]), seeds, rounds);
    const points = winner => winner === 0 ? 3 : winner === null ? 1 : 0;
    const base = results[0].results;
    const variant = results.at(-1).results;
    const deltas = variant.map((row, i) => points(row.winner) - points(base[i].winner));
    const paired = { better: deltas.filter(value => value > 0).length, worse: deltas.filter(value => value < 0).length };
    const examples = Object.fromEntries([['better', deltas.findIndex(value => value > 0)], ['worse', deltas.findIndex(value => value < 0)]]
      .filter(([, index]) => index >= 0).map(([kind, index]) => {
        const { positions, firstTurn } = base[index];
        return [kind, Object.fromEntries([candidates[0], candidates.at(-1)].map(([name, built]) =>
          [name, traceDisciples(built, opponent, { positions, firstTurn })]))];
      }));
    return { seeds, rounds, scores: results.map(({ results, ...row }) => row), paired, examples };
  });
  return { quiet, traces, panels };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(main(...process.argv.slice(2)), null, 2));
}
