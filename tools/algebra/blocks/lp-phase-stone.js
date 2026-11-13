function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

export default {
  id: 'lp-phase-stone', kind: 'body', dialects: '94', entry: 'launch', exit: 'never',
  processes: 2, grows: false, writes: 'sparse',
  purpose: 'Two workers share a stone loop. Starting the second at JMP instead of MOV interleaves the stride updates and writes.',
  params: { PHASE: [0, 1], STEP: [4, 256], OFFSET: [1, 7999], HIDERETURN: [0, 1] },
  defaults: { PHASE: 1, STEP: 32, OFFSET: 17, HIDERETURN: 0 },
  mutable: [['shot', ['b']]],
  observationRole: 'phase-stone',
  phaseContract: { checksOpeningAlternation: true, workersAtEnd: 2 },
  knowledge: {
    parameterRoles: {
      PHASE: '0 enters at MOV and repeats targets. 1 enters at JMP and interleaves the workers.',
      STEP: 'Stride of the shared destination', OFFSET: 'Initial destination field before the first ADD',
      HIDERETURN: 'Use the return instruction’s own B field as its jump vector, leaving A zero for A-only probes.',
    },
    evidence: ['docs/lp-distortion-workers.md', 'docs/lp-phase-deployment.md', 'docs/lp-phase-lanes.md', 'docs/lp-phase-defense.md'],
  },
  mismatches(_, settings) {
    return settings.coreSize === 8000 && settings.maxProcesses === 8 && !settings.topology
      ? [] : ['lp-phase-stone requires the 8,000-cell LP ring with eight processes'];
  },
  linked(P, { coreSize }, at, { total, shiftedFrame, bootHop = null }) {
    if (shiftedFrame && bootHop === null) return ['lp-phase-stone needs a loaded image or a direct standard boot'];
    const hop = bootHop ?? 0;
    const wrap = address => ((address % coreSize) + coreSize) % coreSize;
    if (bootHop !== null) {
      for (let cell = at('launch'); cell <= at('bomb'); cell++) {
        if (wrap(cell + hop) < total) return ['lp-phase-stone boot copy overlaps the loaded image'];
      }
    }
    const grain = gcd(P.STEP, coreSize);
    const firstResidue = (at('shot') + hop + P.OFFSET) % grain;
    if (firstResidue < total) return ['lp-phase-stone shot lane overlaps the loaded image'];
    if (bootHop !== null) {
      for (let cell = at('launch'); cell <= at('bomb'); cell++) {
        if ((cell + hop) % grain === firstResidue) return ['lp-phase-stone shot lane overlaps the deployed stone'];
      }
    }
    return [];
  },
  emit({ ins, L, P }) {
    ins('launch', 'SPL', 'B', L('stride'));
    ins('dispatch', 'JMP', 'B', L(P.PHASE ? 'back' : 'shot'));
    ins('stride', 'ADD', 'AB', `#${P.STEP}`, L('shot'));
    ins('shot', 'MOV', 'I', L('bomb'), `$${P.OFFSET}`);
    if (P.HIDERETURN) ins('back', 'JMP', 'B', '@0', L('stride'));
    else ins('back', 'JMP', 'B', L('stride'));
    ins('bomb', 'DAT', 'F', '#0', '#0');
  },
  observe(api) {
    const firstTargets = [];
    return {
      after(event) {
        const target = event.operands[1]?.address;
        if (!api.matches(event, 'shot', ['b']) || !api.wrote(event, target) || api.peek(target).op !== 'DAT') return;
        api.work('dat-writes', { target });
        if (firstTargets.length < 8) firstTargets.push(api.rel(target, api.at('shot')));
      },
      finish() {
        const workersAtEnd = api.processes().filter(pc => ['stride', 'shot', 'back'].some(label =>
          pc === api.at(label) && api.same(api.peek(pc), api.original(label), label === 'shot' ? ['b'] : []))).length;
        return { firstTargets, workersAtEnd };
      },
    };
  },
  verifyObservation({ parameters: { PHASE, OFFSET, STEP }, firstTargets, work, workersAtEnd }, report) {
    const expected = Array.from({ length: 8 }, (_, i) =>
      (OFFSET + (1 + (PHASE ? i : 2 * Math.floor(i / 2))) * STEP) % report.coreSize);
    const orbit = report.coreSize / gcd(STEP * (PHASE ? 1 : 2), report.coreSize);
    return workersAtEnd === 2 && firstTargets.every((target, i) => target === expected[i]) && firstTargets.length === expected.length
      && work['dat-writes'].uniqueTargets === orbit && work['dat-writes'].lastCycle >= report.cycleLimit - 64
      ? [] : ['the two workers did not keep the declared shot cadence'];
  },
};
