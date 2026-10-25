#!/usr/bin/env node
// Differential test for torus battlefields: random programs run on the VM
// and on the independent reference interpreter (plane-reference.js), and
// every cell and every process (position and heading) is compared after
// every step. The torus counterpart of scripts/pmars-compare.js.
//   node scripts/plane-fuzz.js [programs=500] [steps=400] [seed=1]

import { VM, DEFAULT_SETTINGS, OPCODES, MODIFIERS, MODES } from '../src/engine/index.js';
import { makeGeometry } from '../src/engine/geometry.js';
import { mulberry32 } from '../src/engine/random.js';
import { makeReference } from './plane-reference.js';

export function fuzz({ programs = 500, steps = 400, seed = 1, shapes = [[100, 80, 1], [125, 64, 1], [20, 20, 20], [7, 3, 5]], log = () => {} } = {}) {
  const rng = mulberry32(seed);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const ops = OPCODES.filter((o) => o !== 'LDP' && o !== 'STP');
  let compared = 0;
  for (let p = 0; p < programs; p++) {
    const [X, Y, Z] = shapes[p % shapes.length];
    const settings = { ...DEFAULT_SETTINGS, topology: 'torus', sizeX: X, sizeY: Y, sizeZ: Z, coreSize: X * Y * Z, maxProcesses: 64 };
    const g = makeGeometry(settings);
    const N = g.N;
    // Fields: mostly small steps and short vectors, sometimes anything.
    const field = () => {
      const r = rng();
      if (r < 0.4) return Math.floor(rng() * 11) - 5;
      if (r < 0.8) return g.encode(Math.floor(rng() * 7) - 3, Math.floor(rng() * 7) - 3, Math.floor(rng() * 5) - 2);
      return Math.floor(rng() * N);
    };
    // Programs that live long enough to be interesting: DAT is rare, most
    // end with a jump back to their start, and some begin by splitting.
    const live = ops.filter((o) => o !== 'DAT');
    const program = () => {
      const len = Math.min(g.maxCodeLength, 3 + Math.floor(rng() * 8));
      const ins = Array.from({ length: len }, () => ({ op: rng() < 0.04 ? 'DAT' : pick(live), mod: pick(MODIFIERS), aMode: pick(MODES), a: field(), bMode: pick(MODES), b: field() }));
      if (len > 2 && rng() < 0.8) ins[len - 1] = { op: 'JMP', mod: 'B', aMode: '$', a: -(len - 1), bMode: pick(MODES), b: field() };
      if (len > 2 && rng() < 0.4) ins[0] = { op: 'SPL', mod: 'B', aMode: '$', a: Math.floor(rng() * len), bMode: pick(MODES), b: field() };
      return { name: 'fuzz', start: 0, instructions: ins };
    };
    const ws = [program(), program()];
    const positions = [0, Math.floor(rng() * N)];
    const vm = new VM(settings);
    vm.load(ws, { positions });
    const ref = makeReference(settings);
    ref.load(ws, positions);
    for (let s = 0; s < steps && !vm.done; s++) {
      vm.step();
      ref.step();
      compared++;
      const want = ref.snapshot();
      // the VM's view, in the same terms
      const core = new Map();
      for (let c = 0; c < N; c++) {
        const empty = vm.op[c] === 0 && vm.mod[c] === MODIFIERS.indexOf('F') && vm.aMode[c] === 1 && vm.bMode[c] === 1 && vm.a[c] === 0 && vm.b[c] === 0;
        if (!empty) core.set(c, `${OPCODES[vm.op[c]]}.${MODIFIERS[vm.mod[c]]} ${MODES[vm.aMode[c]]}${vm.a[c]} ${MODES[vm.bMode[c]]}${vm.b[c]}`);
      }
      const queues = vm.warriors.map((w) => {
        const q = w.queue, out = [];
        for (let i = 0; i < q.size; i++) { const j = (q.head + i) % q.buf.length; out.push(`${q.buf[j]}/${q.heads[j]}`); }
        return out;
      });
      const diff = [];
      for (const k of new Set([...core.keys(), ...want.core.keys()])) {
        if (core.get(k) !== want.core.get(k)) diff.push(`cell ${g.format(k)}: VM ${core.get(k) ?? 'empty'} | reference ${want.core.get(k) ?? 'empty'}`);
      }
      if (JSON.stringify(queues) !== JSON.stringify(want.queues)) diff.push(`queues: VM ${JSON.stringify(queues)} | reference ${JSON.stringify(want.queues)}`);
      if (diff.length) {
        return { ok: false, program: p, shape: `${X}x${Y}x${Z}`, step: s + 1, warriors: ws, positions, diff: diff.slice(0, 5), compared };
      }
    }
    if ((p + 1) % 100 === 0) log(`${p + 1} programs, ${compared} steps compared`);
  }
  return { ok: true, programs, compared };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const [programs = 500, steps = 400, seed = 1] = process.argv.slice(2).map(Number);
  const r = fuzz({ programs, steps, seed, log: (m) => process.stderr.write(`${m}\n`) });
  if (r.ok) console.log(`VM and reference agree: ${r.programs} random programs, ${r.compared} steps, every cell and process compared after every step.`);
  else {
    console.log(`MISMATCH in program ${r.program} (${r.shape}) at step ${r.step}:`);
    for (const d of r.diff) console.log(`  ${d}`);
    console.log(JSON.stringify({ positions: r.positions, warriors: r.warriors }));
    process.exit(1);
  }
}
