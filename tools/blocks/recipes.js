// Symbolic block composition. Only the documented single-process ring grammar
// is admitted; arbitrary instruction slices are deliberately not an interface.
import { compile, RULESETS, VM } from '../../src/engine/index.js';

export const recipeDefaults = { OPENING: 1, RELOCATE: 1, BACKWARD: 0, PHASE: 1, WAIT: 128, STEP: 997, HOP: 4096, STUN: 64 };
export const recipeSpace = { OPENING: [0, 2], RELOCATE: [0, 1], BACKWARD: [0, 1], PHASE: [0, 2], WAIT: [1, 768], STEP: [1, 2048], HOP: [256, 7000], STUN: [1, 4096] };

export function recipeSettings(rules = '94x', length = 50) {
  if (!Object.hasOwn(RULESETS, rules)) throw new Error(`Unsupported rules: ${rules}`);
  if (!Number.isSafeInteger(length) || length < 1 || length > RULESETS[rules].maxLength) throw new Error('Invalid instruction budget');
  return { ...RULESETS[rules], maxLength: length };
}

export function emitRecipe(P, { rules = '94x', length = 50 } = {}) {
  const settings = recipeSettings(rules, length);
  if (Object.keys(P).length !== Object.keys(recipeSpace).length) throw new Error('Unexpected recipe parameters');
  for (const [key, [lo, hi]] of Object.entries(recipeSpace)) {
    if (!Number.isSafeInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}`);
  }
  const old = settings.dialect === '88';
  const bare = P.OPENING === 0 && P.RELOCATE === 0;
  // In '88, forward movement needs an explicit ADD. This is a separate
  // implementation, not removal of modifiers from postincrement code.
  const op = (opcode, mod) => old ? opcode : `${opcode}.${mod}`;
  const lines = [`;name Blocks ${rules}`, ';author ZoreWars', `;strategy ${JSON.stringify(P)}`, `;assert CORESIZE==${settings.coreSize}`];
  const sections = [];
  let pc = 0;
  function section(id, emit) {
    const start = pc, startLine = lines.length + 1;
    lines.push(`; block ${id}`); emit();
    sections.push({ id, start, length: pc - start, startLine, endLine: lines.length });
  }
  const ins = (label, opcode, mod, a, b = '0') => { lines.push(`${label || ''} ${op(opcode, mod)} ${a}, ${b}`); pc++; };
  lines.push('payloadSize EQU (payloadEnd-payload)', 'payloadEnd EQU (clearKill+1)');
  if (!old) lines.push(`ORG ${bare ? 'payload' : 'opening'}`);
  // The probe is at image offset zero; its B-field is an absolute image-relative
  // address. The guard excludes the complete original warrior on every lap.
  if (!bare) {
  section('opening-state', () => {
    ins('probe', 'DAT', 'F', '#0', '#MAXLENGTH');
    ins('clock', 'DAT', 'F', '#0', `#${P.WAIT}`);
  });
  section(['opening-none', 'opening-bomber', 'opening-bscan'][P.OPENING], () => {
    if (!P.OPENING) ins('opening', 'JMP', 'B', 'transition');
    else {
      ins('opening', 'ADD', 'AB', `#${P.STEP}`, 'probe');
      ins(null, 'SLT', 'AB', '#(MAXLENGTH-1)', 'probe');
      ins(null, 'JMP', 'B', 'tick');
      if (P.OPENING === 2) ins(null, 'JMZ', 'B', 'tick', '@probe');
      ins('attackWrite', 'MOV', 'I', P.OPENING === 2 ? 'clearStun' : 'clearKill', '@probe');
      ins('tick', 'DJN', 'B', 'opening', 'clock');
    }
  });
  section(P.RELOCATE ? 'relocate-copy' : 'enter-in-place', () => {
    if (P.RELOCATE) {
      ins('transition', 'MOV', 'I', '<copySource', '<copyTarget');
      ins(null, 'DJN', 'B', 'transition', 'copyCount');
      ins(null, 'JMP', 'B', '@copyTarget');
      ins('copySource', 'DAT', 'F', '#0', '#(payloadEnd-copySource)');
      ins('copyTarget', 'DAT', 'F', '#0', `#(probe+${P.HOP}+payloadSize-copyTarget)`);
      ins('copyCount', 'DAT', 'F', '#0', '#payloadSize');
    } else ins('transition', 'JMP', 'B', 'payload');
  });
  }
  const payloadStart = pc;
  const first = P.BACKWARD ? '(payload-clearPtr)' : '(payloadEnd-clearPtr)';
  const target = P.BACKWARD ? '<clearPtr' : old ? '@clearPtr' : '>clearPtr';
  section(P.PHASE ? 'clear-stun-dat' : 'clear-dat', () => {
    if (P.PHASE) {
      ins('payload', 'MOV', 'AB', `#${first}`, 'clearPtr');
      ins(null, 'MOV', 'AB', P.PHASE === 2 ? '#(CORESIZE-payloadSize)' : `#${P.STUN}`, 'remaining');
      ins('stunLoop', 'MOV', 'I', 'clearStun', target);
      if (old && !P.BACKWARD) ins(null, 'ADD', 'AB', '#1', 'clearPtr');
      ins(null, 'DJN', 'B', 'stunLoop', 'remaining');
    } else lines.push('payload');
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
  });
  // '88 has no ORG, so END names the entry; elsewhere ORG does and END stays bare.
  lines.push(old ? `END ${bare ? 'payload' : 'opening'}` : 'END');
  if (pc > length) throw new Error(`Recipe needs ${pc} instructions; budget is ${length}`);
  return { source: lines.join('\n') + '\n', settings, sections, payloadStart, payloadLength: pc - payloadStart, P: { ...P }, rules };
}

// This is a behavioral gate, not a theorem about survival under enemy attack.
// Accept a built object so tests can deliberately corrupt code and challenge it.
export function verifyRecipe(built) {
  const { w, P, settings, payloadStart, payloadLength } = built;
  if (!w?.ok) throw new Error('Recipe did not assemble');
  const norm = x => (x % settings.coreSize + settings.coreSize) % settings.coreSize;
  const address = label => {
    const changed = built.source.replace(/^ORG .*$/m, `ORG ${label}`).replace(/^END\b.*$/m, `END ${label}`);
    const c = compile(changed, 'redcode', settings);
    if (!c.ok) throw new Error(`Missing entry ${label}`);
    return c.start;
  };
  const kill = address('killLoop') - payloadStart;
  const stun = P.PHASE ? address('stunLoop') - payloadStart : -1;
  const mutable = ['clearPtr', 'remaining'].map(x => address(x) - payloadStart);
  const same = (a, b) => ['op', 'mod', 'aMode', 'bMode'].every(k => a[k] === b[k]) && norm(a.a) === norm(b.a) && norm(a.b) === norm(b.b);
  const template = w.instructions.slice(payloadStart);
  const attack = P.OPENING ? address('attackWrite') : -1;
  const clock = P.OPENING ? address('clock') : null;
  const observations = [];
  for (const base of [0, settings.coreSize - 7]) {
    const vm = new VM(settings); vm.load([w], { positions: [base] });
    if (P.OPENING === 2) vm.poke(norm(base + settings.maxLength + P.STEP), { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 }, -1);
    const target = norm(base + (P.RELOCATE ? P.HOP : payloadStart));
    let openingWrites = 0;
    while (!vm.done && vm.cycle < 10000 && !vm.processes(0).includes(target)) {
      const event = vm.step();
      if (P.OPENING && event?.pc === norm(base + attack)) {
        const offset = vm.b[norm(base)];
        if (offset < settings.maxLength || vm.writerPc[norm(base + offset)] !== event.pc || vm.peek(norm(base + offset)).op !== (P.OPENING === 2 ? 'SPL' : 'DAT')) throw new Error('Opening protection/write contract failed');
        openingWrites++;
      }
    }
    if (!vm.processes(0).includes(target) || !template.every((x, i) => same(x, vm.peek(norm(target + i))))) throw new Error('Payload arrival/copy failed');
    if (P.OPENING && vm.b[norm(base + clock)] !== 0) throw new Error('Timer bypassed');
    if (P.OPENING === 1) {
      let expectedWrites = 0;
      for (let i = 1; i <= P.WAIT; i++) if (norm(settings.maxLength + i * P.STEP) >= settings.maxLength) expectedWrites++;
      if (openingWrites !== expectedWrites) throw new Error('Bomber failed expected attack coverage');
    }
    if (P.OPENING === 2 && openingWrites !== 1) throw new Error('Scanner must hit the injected target once and skip empty cells');
    const arrivedAt = vm.cycle;
    let stunWrites = 0, firstDatAt = null;
    const first = norm(target + (P.BACKWARD ? -1 : payloadLength));
    const expected = !P.PHASE ? 0 : P.PHASE === 2 ? settings.coreSize - payloadLength : P.STUN;
    while (!vm.done && firstDatAt === null) {
      const event = vm.step();
      if (event?.pc === norm(target + stun) && P.PHASE) {
        const cell = norm(first + (P.BACKWARD ? -stunWrites : stunWrites));
        if (vm.peek(cell).op !== 'SPL' || vm.writerPc[cell] !== event.pc) throw new Error('Incorrect stun write');
        stunWrites++;
      }
      if (event?.pc === norm(target + kill)) {
        if (vm.peek(first).op !== 'DAT' || vm.writerPc[first] !== event.pc) throw new Error('DAT pointer did not reset');
        firstDatAt = vm.cycle;
      }
    }
    if (stunWrites !== expected || firstDatAt === null) throw new Error('Incorrect phase duration');
    vm.run();
    if (!vm.warriors[0].alive || vm.warriors[0].peak !== 1 || vm.cycle !== settings.maxCycles) throw new Error('Solo/process contract failed');
    if (!template.every((x, i) => same(x, { ...vm.peek(norm(target + i)), ...(mutable.includes(i) ? { b: x.b } : {}) }))) throw new Error('Payload overwrote protected instructions');
    observations.push({ base, openingWrites, scanTargetInjected: P.OPENING === 2, arrivedAt, stunWrites, firstDatAt, survives: true });
  }
  return { ok: true, scope: 'single-process ring; two load positions; full solo round', observations };
}

export function buildRecipe(P = recipeDefaults, options = {}) {
  const built = emitRecipe(P, options);
  built.w = compile(built.source, 'redcode', built.settings);
  if (!built.w.ok) throw new Error(JSON.stringify(built.w.errors));
  built.verification = verifyRecipe(built);
  return built;
}

// Standalone generator for the existing parameter tuner. Embedding the emitter
// preserves symbolic composition when constants change; frozen Redcode would not.
export function recipeGenerator(P = recipeDefaults, options = {}) {
  const settings = recipeSettings(options.rules, options.length);
  return `// Generated by the block catalog; re-run the behavior gate after tuning.\n// SPACE ${JSON.stringify(recipeSpace)}\nconst P = ${JSON.stringify(P)};\nconst RULESETS = ${JSON.stringify(RULESETS)};\nconst recipeSpace = ${JSON.stringify(recipeSpace)};\n${recipeSettings.toString()}\n${emitRecipe.toString()}\nif (CORESIZE !== ${settings.coreSize} || SIZEY !== 1 || SIZEZ !== 1) throw new Error('Wrong battlefield for this recipe');\nconst recipe = emitRecipe(P, ${JSON.stringify(options)});\nif (recipe.sections.reduce((n,s) => n+s.length,0) > MAXLENGTH) throw new Error('Instruction budget exceeded');\nraw(recipe.source);\n`;
}
