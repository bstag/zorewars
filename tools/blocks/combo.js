// Block composition. Each block declares what it needs and what it hands on;
// the composer joins any blocks whose contracts fit, and one generic gate checks
// every combination. Single-process blocks only: Lifeboat's two-process watchdog
// stays a whole recipe until blocks can run side by side.
import { compile, VM } from '../../src/engine/index.js';
import { recipeSettings } from './recipes.js';

// Slots and their blocks, in the order the composer lays them out.
export const comboContracts = {
  opening: [
    { id: 'none', exit: 'immediate', hands: 'probe B = MAXLENGTH (state only emitted when a later block needs it)', dialects: 'all' },
    { id: 'bomber', needs: 'a DAT bomb cell', exit: 'timer: WAIT bombs STEP apart', hands: 'probe B = last bombed cell', dialects: 'all' },
    { id: 'bscan', needs: 'an SPL bomb cell', exit: 'timer: WAIT probes STEP apart, stunning what it finds', hands: 'probe B = last probed cell', dialects: 'all' },
    { id: 'cmpscan', exit: 'first differing probe pair, or SCANS timeout', hands: 'probe B = cell found, or the protected boundary', dialects: '94' },
  ],
  handoff: [
    { id: 'in-place', hands: 'the probe, unchanged' },
    { id: 'relocate', needs: 'a relocatable finisher; no boot', hands: 'nothing: the finisher is copied to probe+HOP and the probe stays behind' },
  ],
  finisher: [
    { id: 'counted', needs: 'nothing', relocatable: true, provides: 'DAT and SPL bomb cells', exit: 'never: repeated passes over everything but itself', dialects: 'all' },
    { id: 'guarded', needs: 'the probe', relocatable: false, provides: 'a DAT bomb cell; an SPL cell with a stun phase', exit: 'never: from probe B onwards, skipping the protected span', dialects: '94' },
  ],
  boot: [
    { id: 'none' },
    { id: 'boot-first', needs: 'no relocate', hands: 'the whole runnable image, copied to probe+HOP before the opening runs; decoys and boot stay behind' },
  ],
  decoys: [{ id: 'decoys', hands: 'DECOYS cells after the finisher: DAT, SPL, or SPL with varied fields (94 only)' }],
};

export const comboDefaults = { OPENING: 1, RELOCATE: 1, FINISHER: 0, BOOT: 0, BACKWARD: 0, PHASE: 1, WAIT: 128, STEP: 997, HOP: 4096,
  STUN: 64, SSTEP: 997, GAP: 7, START: 512, SCANS: 64, DECOYS: 0, DECOY: 0 };
export const comboSpace = { OPENING: [0, 3], RELOCATE: [0, 1], FINISHER: [0, 1], BOOT: [0, 1], BACKWARD: [0, 1], PHASE: [0, 2],
  WAIT: [1, 768], STEP: [1, 2048], HOP: [256, 54000], STUN: [1, 4096], SSTEP: [1, 55439], GAP: [1, 31], START: [128, 54000],
  SCANS: [8, 256], DECOYS: [0, 18], DECOY: [0, 2] };

// Why the chosen blocks cannot be joined; empty when their contracts fit.
export function comboMismatches(P, settings) {
  const old = settings.dialect === '88', out = [];
  if (old && P.OPENING === 3) out.push('the comparison scan needs ICWS\'94 modifiers');
  if (old && P.FINISHER === 1) out.push('the guarded clear needs ICWS\'94 postincrement');
  if (old && P.DECOYS && P.DECOY) out.push('SPL decoys need ICWS\'94');
  if (P.RELOCATE && P.FINISHER === 1) out.push('the guarded clear reads state in the image, so it cannot be relocated');
  if (P.RELOCATE && P.BOOT) out.push('one relocation per warrior: relocate or boot');
  if (P.OPENING === 2 && P.FINISHER === 1 && !P.PHASE) out.push('the B-scan needs an SPL bomb cell; the guarded clear has one only with a stun phase');
  if ((P.RELOCATE || P.BOOT) && P.HOP % settings.coreSize < 256) out.push('HOP lands on the warrior itself');
  return out;
}

export function emitCombo(P, settings) {
  if (Object.keys(P).length !== Object.keys(comboSpace).length) throw new Error('Unexpected combo parameters');
  for (const [key, [lo, hi]] of Object.entries(comboSpace)) {
    if (!Number.isSafeInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}`);
  }
  const mismatches = comboMismatches(P, settings);
  if (mismatches.length) throw new Error(`Blocks do not fit: ${mismatches.join('; ')}`);
  const old = settings.dialect === '88', core = settings.coreSize;
  const counted = P.FINISHER === 0, scan = P.OPENING === 3;
  const bare = P.OPENING === 0 && !P.RELOCATE && !P.BOOT && counted;
  const entry = P.BOOT ? 'boot' : bare ? 'payload' : scan ? 'scan' : 'opening';
  const op = (opcode, mod) => old ? opcode : `${opcode}.${mod}`;
  // Two passes: the scan and guarded clear embed the protected span, which
  // depends on the size of everything emitted.
  function layout(span) {
    const lines = [';name Combo', ';author ZoreWars', `;strategy ${JSON.stringify(P)}`, `;assert CORESIZE==${core}`];
    const labels = {}, sections = [];
    let pc = 0;
    const ins = (label, opcode, mod, a, b = '0') => { if (label) labels[label] = pc; lines.push(`${label || ''} ${op(opcode, mod)} ${a}, ${b}`); pc++; };
    const mark = label => { labels[label] = pc; lines.push(label); };
    const section = (id, emit) => { const start = pc; emit(); if (pc > start) sections.push({ id, start, length: pc - start }); };
    if (counted) lines.push('payloadSize EQU (payloadEnd-payload)', 'payloadEnd EQU (clearKill+1)');
    if (!old) lines.push(`ORG ${entry}`);
    const datBomb = counted ? 'clearKill' : 'killBomb', splBomb = counted ? 'clearStun' : 'stunBomb';
    section('state', () => {
      if (bare) return;
      if (scan) {
        ins('probe', 'DAT', 'F', `#${P.START}`, `#${P.START + P.GAP}`);
        ins('clock', 'DAT', 'F', '#0', `#${P.SCANS}`);
        ins('stride', 'DAT', 'F', `#${P.SSTEP}`, `#${P.SSTEP}`);
      } else {
        ins('probe', 'DAT', 'F', '#0', '#MAXLENGTH');
        ins('clock', 'DAT', 'F', '#0', `#${P.WAIT}`);
      }
      if (!counted) ins('remaining', 'DAT', 'F', '#0', `#${P.STUN}`);
    });
    section(['opening-none', 'opening-bomber', 'opening-bscan', 'opening-cmpscan'][P.OPENING], () => {
      if (bare) return;
      if (P.OPENING === 0) ins('opening', 'JMP', 'B', 'transition');
      else if (scan) {
        ins('scan', 'ADD', 'F', 'stride', 'probe');
        ins('', 'SLT', 'AB', `#${span - 1}`, 'probe'); ins('', 'JMP', 'B', 'tick');
        ins('', 'SLT', 'A', `#${span - 1}`, 'probe'); ins('', 'JMP', 'B', 'tick');
        ins('compare', 'SNE', 'I', '*probe', '@probe'); ins('', 'JMP', 'B', 'tick'); ins('', 'JMP', 'B', 'found');
        ins('tick', 'DJN', 'B', 'scan', 'clock'); ins('', 'MOV', 'A', `#${span}`, 'probe');
        ins('found', 'MOV', 'AB', 'probe', 'probe');
      } else {
        ins('opening', 'ADD', 'AB', `#${P.STEP}`, 'probe');
        ins(null, 'SLT', 'AB', '#(MAXLENGTH-1)', 'probe');
        ins(null, 'JMP', 'B', 'tick');
        if (P.OPENING === 2) ins(null, 'JMZ', 'B', 'tick', '@probe');
        ins('attackWrite', 'MOV', 'I', P.OPENING === 2 ? splBomb : datBomb, '@probe');
        ins('tick', 'DJN', 'B', 'opening', 'clock');
      }
    });
    section(P.RELOCATE ? 'relocate' : 'in-place', () => {
      if (P.RELOCATE) {
        ins('transition', 'MOV', 'I', '<copySource', '<copyTarget');
        ins(null, 'DJN', 'B', 'transition', 'copyCount');
        ins(null, 'JMP', 'B', '@copyTarget');
        ins('copySource', 'DAT', 'F', '#0', '#(payloadEnd-copySource)');
        ins('copyTarget', 'DAT', 'F', '#0', `#(probe+${P.HOP}+payloadSize-copyTarget)`);
        ins('copyCount', 'DAT', 'F', '#0', '#payloadSize');
      } else if (!bare && !scan) ins('transition', 'JMP', 'B', 'payload');   // the scan falls through
    });
    section(counted ? 'counted-clear' : 'guarded-clear', () => {
      if (counted) {
        const first = P.BACKWARD ? '(payload-clearPtr)' : '(payloadEnd-clearPtr)';
        const target = P.BACKWARD ? '<clearPtr' : old ? '@clearPtr' : '>clearPtr';
        if (P.PHASE) {
          ins('payload', 'MOV', 'AB', `#${first}`, 'clearPtr');
          ins(null, 'MOV', 'AB', P.PHASE === 2 ? '#(CORESIZE-payloadSize)' : `#${P.STUN}`, 'remaining');
          ins('stunLoop', 'MOV', 'I', 'clearStun', target);
          if (old && !P.BACKWARD) ins(null, 'ADD', 'AB', '#1', 'clearPtr');
          ins(null, 'DJN', 'B', 'stunLoop', 'remaining');
        } else mark('payload');
        ins('resetKill', 'MOV', 'AB', `#${first}`, 'clearPtr');
        ins(null, 'MOV', 'AB', '#(CORESIZE-payloadSize)', 'remaining');
        ins('killLoop', 'MOV', 'I', 'clearKill', target);
        if (old && !P.BACKWARD) ins(null, 'ADD', 'AB', '#1', 'clearPtr');
        ins(null, 'DJN', 'B', 'killLoop', 'remaining');
        ins(null, 'JMP', 'B', 'resetKill');
        ins('clearPtr', 'DAT', 'F', '#0', '#0');
        ins('remaining', 'DAT', 'F', '#0', '#0');
        ins('clearStun', 'SPL', 'B', '0', '#0');
        ins('clearKill', 'DAT', 'F', '#0', '#0');
      } else {
        mark('payload');
        if (P.PHASE) {
          ins('', 'MOV', 'AB', `#${P.PHASE === 2 ? core - span : P.STUN}`, 'remaining');
          ins('stunGuard', 'SLT', 'AB', `#${span - 1}`, 'probe'); ins('', 'MOV', 'AB', `#${span}`, 'probe');
          ins('stunWrite', 'MOV', 'I', 'stunBomb', '>probe'); ins('', 'DJN', 'B', 'stunGuard', 'remaining');
        }
        ins('killGuard', 'SLT', 'AB', `#${span - 1}`, 'probe'); ins('', 'MOV', 'AB', `#${span}`, 'probe');
        ins('killWrite', 'MOV', 'I', 'killBomb', '>probe'); ins('', 'JMP', 'B', 'killGuard');
        if (P.PHASE) ins('stunBomb', 'SPL', 'B', '#0', '#0');
        ins('killBomb', 'DAT', 'F', '#0', '#0');
      }
    });
    const runnable = pc;
    section('decoys', () => {
      for (let i = 0; i < P.DECOYS; i++) ins('', P.DECOY === 0 ? 'DAT' : 'SPL', P.DECOY === 0 ? 'F' : 'B',
        P.DECOY === 2 ? `#${i * 73 + 1}` : '#1', P.DECOY === 2 ? `#${i * 137 + 7}` : '#1');
    });
    section('boot', () => {
      if (!P.BOOT) return;
      ins('boot', 'MOV', 'I', '<copyFrom', '<copyTo'); ins('', 'DJN', 'B', 'boot', 'copyCount');
      // Destination is relative to the probe, never to the movable decoy/boot section.
      ins('', 'JMP', 'B', `probe+${P.HOP}+${scan ? 'scan' : 'opening'}-probe`);
      ins('copyFrom', 'DAT', 'F', '#0', `#(probe+${runnable}-copyFrom)`);
      ins('copyTo', 'DAT', 'F', '#0', `#(probe+${P.HOP}+${runnable}-copyTo)`);
      ins('copyCount', 'DAT', 'F', '#0', `#${runnable}`);
    });
    lines.push(old ? `END ${entry}` : 'END');
    return { source: lines.join('\n') + '\n', labels, sections, runnable, total: pc };
  }
  const sized = layout(0), span = P.BOOT ? sized.runnable : sized.total, out = layout(span);
  return { ...out, span, P: { ...P } };
}

// Slot choices, for the evolver's block-swap move.
export const comboSlots = ['OPENING', 'RELOCATE', 'FINISHER', 'BOOT', 'PHASE', 'DECOYS'];

// Make the other slots fit after `changed` picked a new block, keeping that
// block where the dialect allows it. A HOP that lands on the warrior is left
// for the gate to refuse.
export function comboRepair(P, rules, changed) {
  const old = recipeSettings(rules).dialect === '88', Q = { ...P };
  if (old) { if (Q.OPENING === 3) Q.OPENING = 1; if (Q.FINISHER === 1) Q.FINISHER = 0; if (Q.DECOYS) Q.DECOY = 0; }
  if (Q.RELOCATE && Q.FINISHER === 1) { if (changed === 'RELOCATE') Q.FINISHER = 0; else Q.RELOCATE = 0; }
  if (Q.RELOCATE && Q.BOOT) { if (changed === 'BOOT') Q.RELOCATE = 0; else Q.BOOT = 0; }
  if (Q.OPENING === 2 && Q.FINISHER === 1 && !Q.PHASE) { if (changed === 'PHASE') Q.FINISHER = 0; else Q.PHASE = 1; }
  return Q;
}

// Code-neutral parameters back to their defaults, so one program has one id.
export function comboCanonical(P, rules) {
  const settings = recipeSettings(rules), Q = { ...P }, reset = keys => { for (const k of keys) Q[k] = comboDefaults[k]; };
  const bare = Q.OPENING === 0 && !Q.RELOCATE && !Q.BOOT && Q.FINISHER === 0;
  if (Q.OPENING !== 3) reset(['SSTEP', 'GAP', 'START', 'SCANS']);
  if (Q.OPENING === 0 || Q.OPENING === 3) reset(['STEP']);
  if (Q.OPENING === 3 || bare) reset(['WAIT']);
  if (Q.FINISHER === 1) reset(['BACKWARD']);
  if (Q.PHASE !== 1 && Q.FINISHER === 0) reset(['STUN']);
  if (!Q.DECOYS) reset(['DECOY']);
  if (!Q.RELOCATE && !Q.BOOT) reset(['HOP']);
  if (settings.coreSize < 55440) for (const k of ['HOP', 'START', 'SSTEP']) Q[k] = Q[k] % settings.coreSize || comboDefaults[k];
  return Q;
}

// The behaviour gate for any combination. Not a proof of survival under attack.
export function verifyCombo(built) {
  const { w, settings, P, labels: L, runnable, span, total } = built;
  if (!w?.ok) throw new Error('Combo did not assemble');
  const core = settings.coreSize, norm = x => ((x % core) + core) % core;
  const same = (a, b) => ['op', 'mod', 'aMode', 'bMode'].every(k => a[k] === b[k]) && norm(a.a) === norm(b.a) && norm(a.b) === norm(b.b);
  const counted = P.FINISHER === 0, fin = L.payload, finLen = runnable - fin;
  // What must stay intact while the clear runs, and which fields may change.
  const [protStart, protLen] = counted ? [fin, finLen] : [0, span];
  const mutable = counted ? { [L.clearPtr]: ['b'], [L.remaining]: ['b'] }
    : { [L.probe]: ['a', 'b'], [L.clock]: ['b'], [L.remaining]: ['b'] };
  const stunPc = counted ? L.stunLoop : L.stunWrite, killPc = counted ? L.killLoop : L.killWrite;
  const expectedStuns = !P.PHASE ? 0 : P.PHASE === 2 ? core - (counted ? finLen : span) : P.STUN;
  let bomberWrites = 0;
  if (P.OPENING === 1) for (let i = 1; i <= P.WAIT; i++) if (norm(settings.maxLength + i * P.STEP) >= settings.maxLength) bomberWrites++;

  // Runs one load; stops at the finisher's entry when `untilEntry`.
  function run(base, { inject = [], untilEntry = false } = {}) {
    const vm = new VM(settings); vm.load([w], { positions: [base] });
    for (const [at, ins] of inject) vm.poke(at, ins);
    const dest = norm(base + (P.BOOT ? P.HOP : 0)), finAt = P.RELOCATE ? norm(base + P.HOP) : norm(dest + fin);
    const addr = i => norm(finAt - fin + i);              // template index -> address of the running copy
    const protAddr = norm(counted ? finAt : dest);
    const inProtected = c => norm(c - protAddr) < protLen;
    const intact = () => {
      for (let i = 0; i < protLen; i++) {
        const k = protStart + i, x = w.instructions[k], cell = { ...vm.peek(protAddr + i) };
        for (const f of mutable[k] ?? []) cell[f] = x[f];
        if (!same(x, cell)) return false;
      }
      return true;
    };
    let attacks = 0;
    const attackAt = L.attackWrite === undefined ? -1 : norm(dest + L.attackWrite);
    while (!vm.done && vm.processes(0)[0] !== finAt && vm.cycle < settings.maxCycles) {
      if (vm.step()?.pc === attackAt) attacks++;
    }
    if (vm.processes(0)[0] !== finAt) throw new Error('The finisher was never entered');
    if (!intact()) throw new Error('The finisher did not arrive intact');
    if ((P.OPENING === 1 || P.OPENING === 2) && vm.peek(dest + L.clock).b !== 0) throw new Error('The opening left before its timer ran out');
    const probeB = L.probe === undefined ? null : vm.peek(dest + L.probe).b;   // relocation leaves the probe behind, at dest
    const arrivedAt = vm.cycle;
    if (untilEntry) return { vm, dest, probeB, attacks };
    if (P.OPENING === 1 && attacks !== bomberWrites) throw new Error('The bomber missed its expected bombs');

    // The first clear write and the stun-to-DAT transition.
    const ptrAt = counted ? addr(L.clearPtr) : dest;
    const expectedFirst = counted ? norm(P.BACKWARD ? finAt - 1 : finAt + finLen) : norm(dest + (probeB >= span ? probeB : span));
    let stuns = 0, firstWrite = null, firstDat = null;
    while (!vm.done && firstDat === null && vm.cycle < settings.maxCycles) {
      const pc = vm.processes(0)[0], writing = pc === addr(stunPc) || pc === addr(killPc);
      const target = writing ? norm(ptrAt + vm.peek(ptrAt).b + (counted && P.BACKWARD ? -1 : 0)) : null;
      vm.step();
      if (!writing) continue;
      const stun = pc === addr(stunPc);
      if (inProtected(target) || vm.writerPc[target] !== pc || vm.peek(target).op !== (stun ? 'SPL' : 'DAT')) throw new Error('A clear write broke its contract');
      if (firstWrite === null && (firstWrite = target) !== expectedFirst) throw new Error('The clear did not start where its contract says');
      if (stun) stuns++; else firstDat = target;
    }
    if (firstDat === null || stuns !== expectedStuns) throw new Error('Incorrect stun phase');

    vm.run();
    if (!vm.warriors[0].alive || vm.cycle !== settings.maxCycles || vm.warriors[0].peak !== 1) throw new Error('Solo/process contract failed');
    if (!intact()) throw new Error('The clear damaged protected code');
    for (let c = 0; c < core; c++) if (!inProtected(c) && vm.writeCycle[c] < arrivedAt) throw new Error('The clear left cells untouched');
    return { base, arrivedAt, attacks, firstWrite, stunWrites: stuns, survives: true };
  }

  const observations = [];
  const bases = [0, core - 7];
  if (P.RELOCATE || P.BOOT) bases.push(norm(core - P.HOP - Math.ceil(runnable / 2)));   // the copy wraps the end of core
  for (const base of bases) observations.push(run(base));

  // Scanners must react to what they find.
  const marker = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
  const inImage = c => norm(c) < total;
  if (P.OPENING === 2) {
    const dest = norm(P.BOOT ? P.HOP : 0), at = norm(dest + settings.maxLength + P.STEP);
    if (!inImage(at)) {
      const r = run(0, { inject: [[at, marker]], untilEntry: true });
      if (r.attacks < 1 || r.vm.peek(at).op !== 'SPL') throw new Error('The B-scan ignored what it found');
      observations.push({ scenario: 'bscan-hit', at, attacks: r.attacks });
    }
  }
  if (P.OPENING === 3) {
    const dest = norm(P.BOOT ? P.HOP : 0);
    for (let k = 1; k <= P.SCANS; k++) {
      const a = norm(P.START + k * P.SSTEP), b = norm(P.START + P.GAP + k * P.SSTEP);
      if (inImage(dest + a) || inImage(dest + b)) break;                      // earlier probes would see our own image
      if (a < span || b < span) continue;                                     // the guard skips these
      const hit = run(0, { inject: [[dest + a, marker]], untilEntry: true });
      if (hit.probeB !== a) throw new Error('The comparison scan handed on the wrong cell');
      const even = run(0, { inject: [[dest + a, marker], [dest + b, marker]], untilEntry: true });
      if (even.probeB === a) throw new Error('The comparison scan stopped on an equal pair');
      observations.push({ scenario: 'cmpscan-hit', probe: k, handedOn: a });
      break;
    }
  }
  return { ok: true, scope: 'any single-process combination; three load positions; full solo rounds; scanner hits', observations };
}

export function buildCombo(P = comboDefaults, { rules = '94x', length = 50 } = {}) {
  const settings = recipeSettings(rules, length);
  const built = { ...emitCombo(P, settings), settings, rules };
  if (built.total > length) throw new Error(`Combo needs ${built.total} instructions; budget is ${length}`);
  built.w = compile(built.source, 'redcode', settings);
  if (!built.w.ok) throw new Error(JSON.stringify(built.w.errors));
  built.verification = verifyCombo(built);
  return built;
}

// Standalone generator for the parameter tuner; the gate must be re-run after tuning.
export function comboGenerator(P = comboDefaults, { rules = '94x', length = 50 } = {}) {
  const settings = recipeSettings(rules, length);
  const keep = { coreSize: settings.coreSize, dialect: settings.dialect };
  return `// Generated block combination; re-run the behavior gate after tuning.\n// SPACE ${JSON.stringify(comboSpace)}\nconst P = ${JSON.stringify(P)};\nconst comboSpace = ${JSON.stringify(comboSpace)};\n${comboMismatches.toString()}\n${emitCombo.toString()}\nif (CORESIZE !== ${settings.coreSize} || SIZEY !== 1 || SIZEZ !== 1) throw new Error('Wrong battlefield for this combination');\nconst combo = emitCombo(P, ${JSON.stringify(keep)});\nif (combo.total > MAXLENGTH) throw new Error('Instruction budget exceeded');\nraw(combo.source);\n`;
}
