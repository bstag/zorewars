// Species: where a warrior sits on a map of behaviours. The two axes are the
// ones used by MAP-Elites in Digital Red Queen (Sakana AI / MIT, 2025):
//   processes - the most processes it runs at once
//   coverage  - how many different cells its processes execute
// Both are measured with the warrior alone in the core, so the result depends
// only on the warrior (and the rules), not on an opponent. Warriors in the
// same cell play in similar ways; strong warriors exist in many cells.

import { VM } from './vm.js';
import { DEFAULT_SETTINGS } from './constants.js';

// Bin edges: a value falls in the first bin whose edge is larger than it.
export function speciesAxes(settings = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const scale = cfg.coreSize / 8000;
  const cov = [10, 100, 500, 1000, 4000].map((e) => Math.max(1, Math.round(e * scale)));
  const procs = [2, 10, 100, 1000, cfg.maxProcesses].filter((e, i, a) => i === 0 || e > a[i - 1]);
  const label = (edges, unit, top) => edges.map((e, i) => {
    const lo = i === 0 ? 1 : edges[i - 1];
    return e - 1 === lo ? `${lo}` : `${lo}–${e - 1}`;
  }).concat(top).map((l) => `${l}${unit}`);
  return {
    processes: { edges: procs, labels: label(procs, '', `${cfg.maxProcesses} (max)`) },
    coverage: { edges: cov, labels: label(cov, '', `${cov.at(-1)}+`) },
  };
}

const bin = (v, edges) => { const i = edges.findIndex((e) => v < e); return i < 0 ? edges.length : i; };

// What warriors in a region of the map usually are. (A guide, not a rule.)
export function speciesHint(p, c, axes) {
  const pTop = axes.processes.edges.length;          // index of the "max" column
  if (p <= 1) return c >= 4 ? 'imp or mover' : c >= 2 ? 'mover or wide bomber' : 'lean scanner or stone';
  if (p <= 3) return c <= 1 ? 'stunner or SPL carpet' : c >= 4 ? 'imp spiral or small paper' : 'small replicator';
  if (p >= pTop && c <= 1) return 'core clear or process swarm';
  return c >= 4 ? 'paper (replicator)' : c >= 2 ? 'paper/stone hybrid' : 'process swarm';
}

// Run the warrior alone and measure it.
export function measureSpecies(compiled, settings = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const vm = new VM(cfg);
  vm.load([compiled], { seed: 1 });
  vm.run(Math.max(0, Math.ceil(cfg.maxCycles)));
  return speciesFromVM(vm);
}

// The VM already remembers every executed cell. Read those marks after a solo
// run, whether it was completed synchronously or in browser time slices.
export function speciesFromVM(vm) {
  const cfg = vm.settings;
  let coverage = 0;
  for (const last of vm.lastExec) if (last >= 0) coverage++;
  const w = vm.warriors[0];
  // On a torus: how many axes the cells it wrote (or was loaded into) spread
  // over: 1 = one row, 2 = one layer (or a plane), 3 = through the volume.
  let shape = 1;
  if (vm.geo && (cfg.sizeY ?? 1) > 1) {
    const ys = new Set(), zs = new Set();
    for (let k = 0; k < cfg.coreSize; k++) if (vm.owner[k] === 0) { const [, y, z] = vm.geo.decode(k); ys.add(y); zs.add(z); }
    shape = zs.size > 1 ? 3 : ys.size > 1 ? 2 : 1;
  }
  return speciesFromStats({ processes: w.peak, coverage, survives: w.alive, shape }, cfg);
}

// Shared formatting of CPU measurements and compact GPU readbacks.
export function speciesFromStats({ processes, coverage, survives, shape = 1 }, settings = {}) {
  const axes = speciesAxes(settings);
  const p = bin(processes, axes.processes.edges);
  const c = bin(coverage, axes.coverage.edges);
  return {
    processes,
    coverage,
    survives,               // false: it kills itself when alone
    shape,
    cell: [p, c],
    key: `${p},${c}`,
    hint: speciesHint(p, c, axes),
  };
}
