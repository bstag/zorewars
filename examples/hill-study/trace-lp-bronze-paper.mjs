import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULESETS, VM, runMatch } from '../../src/engine/index.js';
import { buildTree, createObservation, recipes } from '../../tools/algebra/index.js';
import { createFifoLineage } from '../../tools/algebra/fifo-lineage.js';
import { assemble } from './stateless-replay.mjs';

export function bronzeBuilds() {
  const dual = buildTree(recipes['lp-bronze-paper'].tree(), { rules: 'lp-hill', verification: 'full' });
  const control = (pc, op) => {
    const instructions = dual.w.instructions.map((ins, index) => index === pc ? { ...ins, op, mod: 'F' } : ins);
    return { ...dual, w: { ...dual.w, instructions } };
  };
  // The SPL child is A. Both controls retain the exact same loaded images.
  return { dual, aOnly: control(1, 'DAT'), bOnly: control(0, 'NOP') };
}

export function traceBronze(built, base = 0) {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [base] });
  const offset = address => vm.norm(address - base);
  const fifo = createFifoLineage(vm);
  const observer = createObservation(built, vm);
  const roots = ['b2', 'b1'];
  const bodies = roots.map(ns => Array.from({ length: 7 }, (_, i) => built.w.instructions[built.labels[ns + 'seed'] + i]));
  const same = (actual, expected, ignored = []) => ['op', 'mod', 'aMode', 'bMode', 'a', 'b']
    .every(field => ignored.includes(field) || (field === 'a' || field === 'b'
      ? vm.norm(actual[field] - expected[field]) === 0 : actual[field] === expected[field]));
  const atCopy = roots.map(ns => built.labels[ns + 'copy']);
  const lineages = roots.map((_, i) => ({
    name: i === 0 ? 'A' : 'B', firstEntry: null, firstTransfer: null, firstCappedTransfer: null,
    transfers: 0, intactTransfers: 0, cappedTransfers: 0, deniedRestarts: 0,
    firstCrossDeath: null, lastDeath: null, extinctAt: null,
  }));
  const writerTags = new Int8Array(built.settings.maxCycles + 1).fill(-1);
  const counts = () => {
    const queue = fifo.snapshot();
    return { queue: queue.map(({ pc }) => offset(pc)), tags: queue.map(({ tag }) => lineages[tag]?.name ?? null),
      counts: lineages.map((_, tag) => queue.filter(item => item.tag === tag).length) };
  };
  let firstCap = null;
  while (!vm.done) {
    const event = observer.before();
    const previousWrite = vm.lastWrite[event.pc];
    fifo.before(pc => {
      const index = atCopy.indexOf(offset(pc));
      if (index < 0 || !same(event.instruction, bodies[index][1])) return -1;
      lineages[index].firstEntry ??= event.step;
      return index;
    });
    vm.step();
    observer.after();
    const { tag, size, successors } = fifo.after();
    writerTags[event.step] = tag;
    const capped = size === built.settings.maxProcesses;
    if (!firstCap && vm.warriors[0].queue.size === built.settings.maxProcesses) firstCap = { turn: event.step, ...counts() };
    if (tag < 0) continue;
    const { instruction, operands } = event;
    const stats = lineages[tag], template = bodies[tag], target = operands[1]?.address;
    if (capped && same(instruction, template[5]) && successors.length === 1) stats.deniedRestarts++;
    if (same(instruction, template[6], ['a']) && target === successors[0] && operands[0]?.address === target
      && operands[1].snapshot.b === 0) {
      stats.transfers++;
      const intact = template.every((ins, i) => same(vm.peek(target + i), ins,
        i === 0 ? ['b'] : i === 2 ? ['a', 'b'] : i === 6 ? ['a'] : []));
      if (intact) stats.intactTransfers++;
      const sample = { turn: event.step, target: offset(target), intact };
      stats.firstTransfer ??= sample;
      if (capped) {
        stats.cappedTransfers++;
        stats.firstCappedTransfer ??= sample;
      }
    }
    if (successors.length === 0) {
      const writer = writerTags[previousWrite];
      const death = { turn: event.step, target: offset(event.pc), writer: lineages[writer]?.name ?? null };
      stats.lastDeath = death;
      if (writer >= 0 && writer !== tag) stats.firstCrossDeath ??= death;
      if (!fifo.snapshot().some(item => item.tag === tag)) stats.extinctAt = event.step;
    }
  }
  const { blocks } = observer.finish();
  return { turns: vm.steps, firstCap, lineages, final: counts(),
    firstScatters: roots.map(ns => {
      const value = blocks.find(block => block.namespace === ns).phases['first-scatter'];
      return value ? { turn: value.cycle + 1, target: offset(value.target) } : null;
    }),
  };
}

function replay(folder, builds) {
  const settings = RULESETS['lp-hill'];
  const source = name => {
    const file = path.join(folder, name + '.red');
    return assemble(readFileSync(file, 'utf8'), file, settings);
  };
  const fields = [
    { opponents: ['rous', 'digitalrain', 'dse_6', '4xlb_6'].map(source), seeds: [6151, 8191] },
    { opponents: ['l111', 'hippogriff', 'fearfixed', 'lpdestroyer2'].map(source), seeds: [23431, 26003] },
  ];
  const rounds = 48;
  return [['published', source('bronzeminotaur')], ...Object.entries(builds).map(([name, built]) => [name, built.w])]
    .map(([name, warrior]) => ({
      name, panels: fields.map(({ opponents, seeds }) => {
        const matchups = opponents.map(opponent => {
          const points = seeds.reduce((sum, seed) => {
            const { wins, ties } = runMatch([warrior, opponent], { ...settings, rounds }, { seed }).warriors[0];
            return sum + 3 * wins + ties;
          }, 0);
          return { opponent: opponent.name, pointsPerRound: points / (seeds.length * rounds) };
        });
        return { seeds, rounds, matchups, pointsPerRound: matchups.reduce((sum, row) => sum + row.pointsPerRound, 0) / matchups.length };
      }),
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [folder] = process.argv.slice(2);
  const builds = bronzeBuilds();
  const entries = Object.entries(builds).map(([name, built]) => {
    const result = traceBronze(built);
    assert.deepEqual(traceBronze(built, 7997), result, `${name} changed across the core seam`);
    return [name, result];
  });
  console.log(JSON.stringify({ ...Object.fromEntries(entries), ...(folder && { panels: replay(folder, builds) }) }, null, 2));
}
