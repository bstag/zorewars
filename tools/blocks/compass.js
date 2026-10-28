// Original comparison scanner/clear. Monowire motivates the contracts, not the
// instruction sequence: one process, explicit phase counters and guarded writes.
import { compile, VM } from '../../src/engine/index.js';
import { recipeSettings } from './recipes.js';

export const compassDefaults = { BOOT: 1, HOP: 18000, STEP: 997, GAP: 7, START: 512, SCANS: 64, PHASE: 1, STUN: 32, DECOYS: 12, DECOY: 1 };
export const compassSpace = { BOOT: [0, 1], HOP: [256, 54000], STEP: [1, 55439], GAP: [1, 31], START: [128, 54000], SCANS: [8, 256], PHASE: [0, 2], STUN: [1, 512], DECOYS: [0, 18], DECOY: [0, 2] };

export function emitCompass(P) {
  if (Object.keys(P).length !== Object.keys(compassSpace).length) throw new Error('Unexpected Compass parameters');
  for (const [key, [lo, hi]] of Object.entries(compassSpace)) {
    if (!Number.isSafeInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}`);
  }
  const lines = [';name Compass', ';author ZoreWars', ';strategy Comparison scan, explicit clear phases, independent boot/decoy layout',
    `;recipe ${JSON.stringify(P)}`, `ORG ${P.BOOT ? 'boot' : 'scan'}`];
  const labels = {}, sections = []; let pc = 0;
  const ins = (label, op, a, b = '0') => { if (label) labels[label] = pc; lines.push(`${label} ${op} ${a}, ${b}`); pc++; };
  const section = (id, fn) => { const start = pc; fn(); sections.push({ id, start, length: pc - start }); };
  const size = P.PHASE ? 26 : 20, total = size + P.DECOYS + (P.BOOT ? 6 : 0), span = P.BOOT ? size : total;
  section('scan-state', () => {
    ins('probe', 'DAT.F', `#${P.START}`, `#${P.START + P.GAP}`);
    ins('clock', 'DAT.F', '#0', `#${P.SCANS}`);
    ins('stride', 'DAT.F', `#${P.STEP}`, `#${P.STEP}`);
    ins('remaining', 'DAT.F', '#0', `#${P.STUN}`);
  });
  section('comparison-scan', () => {
    ins('scan', 'ADD.F', 'stride', 'probe');
    ins('', 'SLT.AB', `#${span - 1}`, 'probe'); ins('', 'JMP.B', 'tick');
    ins('', 'SLT.A', `#${span - 1}`, 'probe'); ins('', 'JMP.B', 'tick');
    ins('compare', 'SNE.I', '*probe', '@probe'); ins('', 'JMP.B', 'tick'); ins('', 'JMP.B', 'found');
    ins('tick', 'DJN.B', 'scan', 'clock'); ins('', 'MOV.A', `#${span}`, 'probe');
    ins('found', 'MOV.AB', 'probe', 'probe');
  });
  section('guarded-clear', () => {
    if (P.PHASE) {
      ins('', 'MOV.AB', `#${P.PHASE === 2 ? 55440 - span : P.STUN}`, 'remaining');
      ins('stunGuard', 'SLT.AB', `#${span - 1}`, 'probe'); ins('', 'MOV.AB', `#${span}`, 'probe');
      ins('stunWrite', 'MOV.I', 'stunBomb', '>probe'); ins('', 'DJN.B', 'stunGuard', 'remaining');
    }
    ins('killGuard', 'SLT.AB', `#${span - 1}`, 'probe'); ins('', 'MOV.AB', `#${span}`, 'probe');
    ins('killWrite', 'MOV.I', 'killBomb', '>probe'); ins('', 'JMP.B', 'killGuard');
    if (P.PHASE) ins('stunBomb', 'SPL.B', '#0', '#0');
    ins('killBomb', 'DAT.F', '#0', '#0');
  });
  if (pc !== size) throw new Error('Compass layout drift');
  section('decoy', () => {
    for (let i = 0; i < P.DECOYS; i++) ins('', P.DECOY === 0 ? 'DAT.F' : 'SPL.B',
      P.DECOY === 2 ? `#${i * 73 + 1}` : '#1', P.DECOY === 2 ? `#${i * 137 + 7}` : '#1');
  });
  section('boot', () => {
    if (!P.BOOT) return;
    ins('boot', 'MOV.I', '<copyFrom', '<copyTo'); ins('', 'DJN.B', 'boot', 'copyCount');
    // Destination is relative to probe, never to the movable boot/decoy section.
    ins('', 'JMP.B', `probe+${P.HOP}+scan-probe`);
    ins('copyFrom', 'DAT.F', '#0', `#(probe+${size}-copyFrom)`);
    ins('copyTo', 'DAT.F', '#0', `#(probe+${P.HOP}+${size}-copyTo)`);
    ins('copyCount', 'DAT.F', '#0', `#${size}`);
  });
  lines.push(`END ${P.BOOT ? 'boot' : 'scan'}`);
  return { source: lines.join('\n') + '\n', labels, sections, payloadLength: size, protectedSpan: span, P: { ...P } };
}

export function verifyCompass(built) {
  const { w, settings, P, labels: L, payloadLength: size, protectedSpan: span } = built;
  if (!w.ok || settings.coreSize !== 55440 || settings.maxCycles !== 500000) throw new Error('Compass requires full 94x gates');
  const norm = x => ((x % settings.coreSize) + settings.coreSize) % settings.coreSize;
  const same = (a, b) => ['op', 'mod', 'aMode', 'bMode'].every(k => a[k] === b[k]) && norm(a.a) === norm(b.a) && norm(a.b) === norm(b.b);
  const observations = [], template = w.instructions.slice(0, size);
  for (const base of [0, 55433, ...(P.BOOT ? [norm(55440 - P.HOP - 4)] : [])]) {
    const vm = new VM(settings); vm.load([w], { positions: [base] });
    const target = norm(base + (P.BOOT ? P.HOP : 0)), at = label => norm(target + L[label]);
    while (!vm.done && vm.cycle < 200 && vm.processes(0)[0] !== at('scan')) vm.step();
    if (vm.processes(0)[0] !== at('scan') || !template.every((x, i) => same(x, vm.peek(norm(target + i))))) throw new Error('Compass exact copy/entry failed');
    const arrivedAt = vm.cycle;
    vm.run();
    if (!vm.warriors[0].alive || vm.cycle !== settings.maxCycles || vm.warriors[0].peak !== 1) throw new Error('Compass solo/process contract failed');
    if (!template.every((x, i) => {
      const cell = { ...vm.peek(norm(target + i)) };
      if (i === L.probe) { cell.a = x.a; cell.b = x.b; }
      if (i === L.clock || i === L.remaining) cell.b = x.b;
      return same(x, cell);
    })) throw new Error('Compass damaged protected payload');
    observations.push({ base, target, arrivedAt, survives: true });
  }
  // Isolated scanner contract: begin with the copied payload in otherwise empty
  // core. Arrange the first probe pair, retaining the emitted stride/guards.
  // Full-image runs above separately include old source and decoy interactions.
  for (const scenario of ['empty', 'a-only', 'b-only', 'equal-pair', 'self']) {
    const vm = new VM(settings), stage = { ...w, instructions: template, start: L.scan };
    vm.load([stage], { positions: [0] });
    const first = scenario === 'self' ? 0 : 128;
    vm.poke(L.probe, { ...vm.peek(L.probe), a: norm(first - P.STEP), b: norm(first + P.GAP - P.STEP) });
    vm.poke(L.clock, { ...vm.peek(L.clock), b: 1 });
    const marker = { op: 'SPL', mod: 'B', aMode: '#', a: 111, bMode: '#', b: 222 };
    if (scenario === 'a-only' || scenario === 'equal-pair') vm.poke(first, marker);
    if (scenario === 'b-only' || scenario === 'equal-pair') vm.poke(first + P.GAP, marker);
    const hit = scenario === 'a-only' || scenario === 'b-only', expectedFirst = hit ? first : span;
    let stuns = 0, firstDat = null, writes = 0, found = false;
    while (!vm.done && firstDat === null) {
      const pc = vm.processes(0)[0], before = vm.peek(L.probe).b;
      const event = vm.step();
      if (event?.pc === L.found) { found = true; if (vm.peek(L.probe).b !== expectedFirst) throw new Error(`Compass handoff failed: ${scenario}`); }
      if (pc === L.stunWrite || pc === L.killWrite) {
        if (before < span || vm.writerPc[before] !== pc || vm.peek(before).op !== (pc === L.stunWrite ? 'SPL' : 'DAT')) throw new Error('Compass clear write/protection failed');
        if (!writes && before !== expectedFirst) throw new Error('Compass first clear destination failed');
        writes++;
        if (pc === L.stunWrite) stuns++; else firstDat = before;
      }
    }
    const expectedStuns = P.PHASE === 0 ? 0 : P.PHASE === 2 ? 55440 - span : P.STUN;
    if (!found || firstDat === null || stuns !== expectedStuns) throw new Error('Compass phase transition failed');
    observations.push({ scenario, hit, firstWrite: expectedFirst, stunWrites: stuns, firstDat });
  }
  return { ok: true, observations, scope: 'Exact boot at wrapped origins; full solo; isolated A/B/equal/empty/self probes; bounded SPL to DAT and protected writes. No arbitrary damage guarantee.' };
}

export function buildCompass(P = compassDefaults, { length = 50 } = {}) {
  const built = emitCompass(P); built.settings = recipeSettings('94x', length);
  built.w = compile(built.source, 'redcode', built.settings);
  if (!built.w.ok) throw new Error(JSON.stringify(built.w.errors));
  built.verification = verifyCompass(built); return built;
}

export function compassGenerator(P = compassDefaults) {
  return `// Verify with buildCompass after standalone tuning.\n// SPACE ${JSON.stringify(compassSpace)}\nconst P = ${JSON.stringify(P)};\nconst compassSpace = ${JSON.stringify(compassSpace)};\n${emitCompass.toString()}\nif (CORESIZE!==55440 || SIZEY!==1 || SIZEZ!==1) throw new Error('Compass requires the 94x ring');\nraw(emitCompass(P).source);\n`;
}
