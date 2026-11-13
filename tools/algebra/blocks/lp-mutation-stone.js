const norm = (value, core) => ((value % core) + core) % core;

function sector(P, at) {
  const start = at('bomb') + P.START;
  return { start, end: start + P.WIDTH };
}

export default {
  id: 'lp-mutation-stone', kind: 'body', dialects: '94', entry: 'stride', exit: 'never',
  processes: 1, grows: false, writes: 'sparse',
  purpose: 'A stone copies its own jump from a planned donor, replacing its stride instruction and entering a repeating DAT clear.',
  params: { STEP: [4, 256], SHOTS: [8, 512], START: [16, 7999], WIDTH: [32, 1850] },
  defaults: { STEP: 16, SHOTS: 256, START: 192, WIDTH: 960 },
  mutable: [['cursor', ['a', 'b']], ['bomb', ['b']]],
  observationRole: 'mutation-stone',
  phaseContract: { requiresSelfWrite: true, requiresClearReset: true },
  knowledge: {
    parameterRoles: {
      STEP: 'Advance of both the donor and target per shot', SHOTS: 'Shot number that writes the handoff',
      START: 'First clear target relative to the DAT cursor', WIDTH: 'Number of consecutive targets before reset',
    },
    invariants: ['The handoff is a MOV into the live stride cell.', 'The continuation keeps the same process slot after the mutation.'],
    evidence: ['docs/lp-distortion-stone.md'],
  },
  mismatches(_, settings) {
    return settings.coreSize === 8000 && settings.maxProcesses === 8 && !settings.topology
      ? [] : ['lp-mutation-stone requires the 8,000-cell LP ring with eight processes'];
  },
  linked(P, { coreSize }, at, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-mutation-stone requires an unshifted linked frame'];
    const { start, end } = sector(P, at);
    if (start < total || end > coreSize) return ['lp-mutation-stone clear sector overlaps the loaded image'];
    for (let before = 1; before < P.SHOTS; before++) {
      const shift = -before * P.STEP;
      if ([at('stride'), at('pivot')].some(pc => norm(pc + shift, coreSize) < total)) {
        return ['lp-mutation-stone early shot or donor overlaps the loaded image'];
      }
    }
    return [];
  },
  linkedSectors: (P, at) => [sector(P, at)],
  emit({ ins, L, P }) {
    const travel = P.STEP * P.SHOTS;
    ins('stride', 'ADD', 'F', L('increment'), L('cursor'));
    ins('shot', 'MOV', 'I', `{${L('cursor')}`, `@${L('cursor')}`);
    ins('back', 'JMP', 'B', L('stride'));
    ins('increment', 'DAT', 'F', `#${P.STEP + 1}`, `#${P.STEP}`);
    ins('pivot', 'JMP', 'B', `(${L('clear')}-${L('stride')})`);
    ins('clear', 'MOV', 'I', L('bomb'), `>${L('bomb')}`);
    ins('bound', 'SLT', 'B', L('bomb'), `#${P.START + P.WIDTH}`);
    ins('reset', 'MOV', 'AB', `#${P.START}`, L('bomb'));
    ins('repeat', 'JMP', 'B', L('clear'));
    ins('bomb', 'DAT', 'F', '#0', `#${P.START}`);
    ins('cursor', 'DAT', 'F', `(${L('pivot')}-${travel})`, `(${L('stride')}-${travel})`);
  },
  observe(api) {
    const stride = api.at('stride'), donor = api.at('pivot');
    const { start, end } = sector(api.P, api.at);
    return {
      after(event) {
        if (!api.own(event)) return;
        const [source, destination] = event.operands;
        const target = destination?.address;
        if (api.matches(event, 'shot') && api.wrote(event, target)) {
          api.work('shots', { target });
          const written = api.peek(target);
          if (target === stride && source.address === donor && written.op === 'JMP' && api.same(written, api.original('pivot'))) {
            api.phase('pivot-write', { target });
          }
        }
        if (event.pc === stride && event.instruction.op === 'JMP' && api.same(event.instruction, api.original('pivot'))
          && api.processes().at(-1) === api.at('clear')) api.phase('pivot-jump');
        if (api.matches(event, 'clear') && api.wrote(event, target) && api.peek(target).op === 'DAT') {
          const offset = api.rel(target, api.norm(start));
          if (offset >= end - start) api.fault('clear-outside-sector', target);
          api.work('dat-writes', { target });
          api.phase('first-dat', { target });
        }
        if (api.matches(event, 'reset') && api.wrote(event, api.at('bomb'))) api.work('resets');
      },
    };
  },
  verifyObservation({ parameters, phases, work, firstFault }, report) {
    const issues = [];
    if (work.shots?.count !== parameters.SHOTS || !phases['pivot-write'] || !phases['pivot-jump']) {
      issues.push('the planned shot did not install and execute the handoff');
    }
    if (firstFault || work['dat-writes']?.uniqueTargets !== parameters.WIDTH || !work.resets
      || work['dat-writes'].lastCycle < report.cycleLimit - 64) issues.push('the clear did not keep sweeping its complete sector');
    return issues;
  },
};
