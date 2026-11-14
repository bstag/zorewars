// Romulan Warbird's scanner and clear, adapted from Philip Kendall's published Redcode.
export default {
  id: 'lp-romulan-scanner',
  credit: 'Scanner adapted from Romulan Warbird by Philip Kendall.',
  kind: 'body', exit: 'never', dialects: '94',
  entry: 'scan', entryFirst: false, processes: 1, grows: true, writes: 'core',
  purpose: 'Romulan Warbird pair scanner with SPL/JMP traps, a DJN stream and an SPL-fed forward DAT clear.',
  params: { STEP: [60, 140], STREAM: [-2400, -400] },
  defaults: { STEP: 98, STREAM: -1308 },
  mismatches(_, { coreSize, maxProcesses }) {
    return coreSize === 8000 && maxProcesses === 8 ? [] : ['lp-romulan-scanner requires the LP ring'];
  },
  emit({ L, P: { STEP, STREAM }, ins }) {
    const stride = 2 * STEP;
    const pointer = `(${L('inc')}-2)`;
    ins('inc', 'DAT', 'F', stride, stride);
    ins('loop', 'ADD', 'F', L('inc'), `@${L('strike')}`);
    ins('scan', 'SEQ', 'I', `${L('loop')}+${stride}`, `${L('loop')}+${STEP}`);
    ins('', 'SLT', 'AB', `#(${L('adjust')}-${L('scan')})`, `@${L('strike')}`);
    ins('', 'DJN', 'F', L('loop'), `<${STREAM}`);
    ins('', 'MOV', 'I', L('trap'), `@${L('scan')}`);
    ins('strike', 'MOV', 'I', L('split'), `<${L('scan')}`);
    ins('', 'ADD', 'F', L('adjust'), L('scan'));
    ins('', 'JMN', 'A', `@${L('strike')}`, L('inc'));
    ins('split', 'SPL', 'A', '#0', `}${pointer}`);
    ins('clear', 'MOV', 'I', L('bomb'), `>${pointer}`);
    ins('trap', 'JMP', 'A', -1, `}${pointer}`);
    ins('bomb', 'DAT', 'F', '>2667', `>(${L('adjust')}+2-${pointer})`);
    ins('adjust', 'DAT', 'F', STEP, STEP + 1);
  },
};
