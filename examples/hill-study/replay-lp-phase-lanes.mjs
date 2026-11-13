import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULESETS } from '../../src/engine/index.js';
import { buildTree, link, recipes } from '../../tools/algebra/index.js';
import { deployment, scoreDeployments, traceDeployment } from './replay-lp-phase-deployment.mjs';
import { assemble } from './stateless-replay.mjs';

const rules = 'lp-hill';
const settings = RULESETS[rules];
const hop = 5952;
const strides = [64, 80, 100, 125, 160, 200, 250];
const baseline = deployment(hop);
const paperOnly = { ...baseline, w: { ...baseline.w, instructions: baseline.w.instructions.map((ins, i) =>
  i === baseline.labels.b3launch ? { ...ins, op: 'DAT', mod: 'F' } : ins) } };
const { paperCopyResidues } = traceDeployment(paperOnly, null, { positions: [0] }, strides);

function screen(STEP, OFFSET) {
  const candidate = deployment(hop, { STEP, OFFSET });
  const trace = traceDeployment(candidate);
  let gate = 'pass';
  try { buildTree(candidate.tree, { rules, verification: 'full' }); }
  catch (error) { gate = error.message; }
  return { STEP, OFFSET, residue: (hop + candidate.labels.b3shot + OFFSET) % STEP, gate,
    copyOverlap: trace.copyOverlap, stoneOnPaper: trace.stoneOnPaper, paperChangesOnStone: trace.paper.changes,
    shots: trace.shots, firstCap: trace.launch.firstCap, fullQueueTurns: trace.fullQueueTurns, final: trace.final };
}

const offsets = Array.from({ length: 32 }, (_, i) => i + 1).filter(OFFSET => {
  const tree = recipes['lp-booted-phase-paper'].tree();
  tree.kids[1].kids[0].P = { OFFSET };
  return link(tree, settings).misfits.length === 0;
}).map(OFFSET => screen(32, OFFSET));
const sparse = strides.flatMap(STEP => {
  const start = hop + baseline.labels.b3launch;
  const deployed = baseline.spans.b3.size;
  const protectedResidues = new Set(Array.from({ length: deployed }, (_, i) => (start + i) % STEP));
  return paperCopyResidues[STEP].map((writes, residue) => ({ writes, residue }))
    .filter(({ residue }) => residue >= baseline.total && !protectedResidues.has(residue))
    .sort((a, b) => a.writes - b.writes || a.residue - b.residue).slice(0, 5)
    .map(({ writes, residue }) => {
      const OFFSET = (residue - (hop + baseline.labels.b3shot) % STEP + STEP) % STEP || STEP;
      return { projectedPaperCopies: writes, ...screen(STEP, OFFSET) };
    });
});

const finalists = [[32, 17], [32, 11], [125, 61], [160, 11], [160, 46]].map(([STEP, OFFSET]) => {
  const candidate = deployment(hop, { STEP, OFFSET });
  const trace = traceDeployment(candidate);
  assert.deepEqual(traceDeployment(candidate, null, { positions: [7997] }), { ...trace, positions: [7997] });
  return [`${STEP}/${OFFSET}`, candidate];
});

const [file] = process.argv.slice(2);
const panels = file ? [[23033, 49139], [38177, 57347]].map(seeds => {
  const opponent = assemble(readFileSync(file, 'utf8'), file, settings);
  const rounds = 64;
  const results = scoreDeployments(opponent, finalists.map(([name, built]) => [name, built.w]), seeds, rounds);
  const base = results[0];
  const lane = results.at(-1);
  const better = lane.results.find((round, i) => (round.winner === 0 && base.results[i].winner !== 0)
    || (round.winner === null && base.results[i].winner === 1));
  const worse = base.results.find((round, i) => (round.winner === 0 && lane.results[i].winner !== 0)
    || (round.winner === null && lane.results[i].winner === 1));
  const examples = Object.fromEntries([['better', better], ['worse', worse]].filter(([, round]) => round)
    .map(([kind, { positions, firstTurn }]) => [kind, Object.fromEntries([finalists[0], finalists.at(-1)]
      .map(([name, built]) => [name, traceDeployment(built, opponent, { positions, firstTurn })]))]));
  return { seeds, rounds, scores: results.map(({ results, ...row }) => row), examples };
}) : [];
console.log(JSON.stringify({ offsets, sparse, panels }, null, 2));
