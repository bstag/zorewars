// Verify with buildCompass after standalone tuning.
// SPACE {"BOOT":[0,1],"HOP":[256,54000],"STEP":[1,55439],"GAP":[1,31],"START":[128,54000],"SCANS":[8,256],"PHASE":[0,2],"STUN":[1,512],"DECOYS":[0,18],"DECOY":[0,2]}
const P = {"BOOT":1,"HOP":18000,"STEP":997,"GAP":7,"START":512,"SCANS":64,"PHASE":1,"STUN":32,"DECOYS":12,"DECOY":1};
const compassSpace = {"BOOT":[0,1],"HOP":[256,54000],"STEP":[1,55439],"GAP":[1,31],"START":[128,54000],"SCANS":[8,256],"PHASE":[0,2],"STUN":[1,512],"DECOYS":[0,18],"DECOY":[0,2]};
function emitCompass(P) {
  if (Object.keys(P).length !== Object.keys(compassSpace).length) throw new Error('Unexpected Compass parameters');
  for (const [key, [lo, hi]] of Object.entries(compassSpace)) {
    if (!Number.isSafeInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}`);
  }
  const lines = [';name Compass', ';author ZoreWars', ';strategy Comparison scan, explicit clear phases, independent boot/decoy layout',
    `;recipe ${JSON.stringify(P)}`, ';assert CORESIZE==55440', `ORG ${P.BOOT ? 'boot' : 'scan'}`];
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
  lines.push('END');
  return { source: lines.join('\n') + '\n', labels, sections, payloadLength: size, protectedSpan: span, P: { ...P } };
}
if (CORESIZE!==55440 || SIZEY!==1 || SIZEZ!==1) throw new Error('Compass requires the 94x ring');
raw(emitCompass(P).source);
