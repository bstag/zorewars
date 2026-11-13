import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULESETS, VM, runMatch } from '../../src/engine/index.js';
import { buildTree, createObservation, recipes } from '../../tools/algebra/index.js';
import { createFifoLineage } from '../../tools/algebra/fifo-lineage.js';
import { assemble } from './stateless-replay.mjs';

export function mutationBuilds() {
  const dual = buildTree(recipes['lp-mutation-paper'].tree(), { rules: 'lp-hill', verification: 'full' });
  const { labels, w } = dual;
  const replace = (pc, instruction) => w.instructions.map((ins, i) => i === pc ? instruction : ins);
  return {
    dual,
    stoneOnly: { ...dual, w: { ...w, start: labels.b1stride } },
    paperOnly: { ...dual, w: { ...w, start: labels.b2copy } },
    holdStone: { ...dual, w: { ...w, instructions: replace(labels.b1pivot, w.instructions[labels.b1stride]) } },
    startClear: { ...dual, w: { ...w, instructions: replace(labels.b1stride, w.instructions[labels.b1pivot]) } },
  };
}

export function traceMutation(built, base = 0) {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [base] });
  const observer = createObservation(built, vm);
  const fifo = createFifoLineage(vm);
  const claim = [built.labels.b1stride, built.labels.b2copy];
  const cursor = vm.norm(base + built.labels.b1bomb);
  const stride = vm.norm(base + claim[0]);
  const queue = () => fifo.snapshot().map(({ pc, tag }) => [vm.norm(pc - base), ['stone', 'paper'][tag] ?? null]);
  let firstCap = null, pivot = null, clear = null, paperTouchesCursorAt = null;
  while (!vm.done) {
    const event = observer.before();
    fifo.before(pc => claim.indexOf(vm.norm(pc - base)));
    vm.step();
    observer.after();
    const { tag } = fifo.after();
    const { step, pc, instruction } = event;
    const target = event.operands[1]?.address;
    const offset = vm.norm(pc - base);
    if (tag === 0 && instruction.op === 'MOV' && offset === built.labels.b1shot && target === stride
      && vm.peek(stride).op === 'JMP' && !pivot) pivot = { turn: step, queue: queue() };
    if (tag === 0 && instruction.op === 'MOV' && offset === built.labels.b1clear && !clear) {
      clear = { turn: step, target: vm.norm(target - base), queue: queue() };
    }
    if (tag === 1 && vm.lastWrite[cursor] === step) paperTouchesCursorAt ??= step;
    if (vm.processes(0).length === 8 && !firstCap) firstCap = { turn: step, queue: queue() };
  }
  const { blocks } = observer.finish();
  const normalize = row => Object.fromEntries(Object.entries(row).map(([key, details]) => {
    const relative = { ...details };
    for (const field of ['target', 'firstTarget', 'lastTarget']) {
      if (details[field] !== undefined) relative[field] = vm.norm(details[field] - base);
    }
    return [key, relative];
  }));
  const stone = blocks.find(block => block.id === 'lp-mutation-stone');
  return { turns: vm.steps, firstCap, pivot, clear, paperTouchesCursorAt, final: queue(),
    phases: normalize(stone.phases), work: normalize(stone.work) };
}

function replay(folder, builds) {
  const settings = { ...RULESETS['lp-hill'], rounds: 40 };
  const source = name => {
    const file = path.join(folder, `${name}.red`);
    return assemble(readFileSync(file, 'utf8'), file, settings);
  };
  const fields = [
    { names: ['rous', 'digitalrain', 'bronzeminotaur', '4xlb_6'], seeds: [10321, 19709] },
    { names: ['l111', 'fearfixed', 'hippogriff', 'lpdestroyer2'], seeds: [37123, 44497] },
  ];
  return Object.fromEntries([['published', source('dse_6')], ...Object.entries(builds).map(([name, built]) => [name, built.w])]
    .map(([name, warrior]) => [name, fields.map(({ names, seeds }) => {
      const rows = names.map(source).map(opponent => {
        const points = seeds.reduce((total, seed) => {
          const { wins, ties } = runMatch([warrior, opponent], settings, { seed }).warriors[0];
          return total + 3 * wins + ties;
        }, 0);
        return { name: opponent.name, pointsPerRound: points / (seeds.length * settings.rounds) };
      });
      return { seeds, rounds: settings.rounds, rows, pointsPerRound: rows.reduce((sum, row) => sum + row.pointsPerRound, 0) / rows.length };
    })]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [folder] = process.argv.slice(2);
  const builds = mutationBuilds();
  const traces = Object.fromEntries(Object.entries(builds).map(([name, built]) => {
    const result = traceMutation(built);
    assert.deepEqual(traceMutation(built, 7997), result);
    return [name, result];
  }));
  console.log(JSON.stringify({ traces, ...(folder && { panels: replay(folder, builds) }) }, null, 2));
}
