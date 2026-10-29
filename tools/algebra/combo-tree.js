// Every combination tools/blocks/combo.js can make, as a tree. The tests
// check that both give the same compiled code.

const OPENINGS = ['opening-none', 'opening-bomber', 'opening-bscan', 'opening-cmpscan'];
const BODIES = [null, 'stone', 'spiral', 'paper', 'vampire'];

function body(b, P) {
  switch (BODIES[b]) {
    case 'stone': return { id: 'stone', P: { TSTEP: P.TSTEP, TBOMB: P.TBOMB } };
    case 'spiral': return { id: 'spiral', P: { SN: P.SN, SK: P.SK } };
    case 'paper': return { id: 'paper', P: { PSTEP: P.PSTEP, PDELTA: P.PDELTA } };
    default: return { id: 'vampire', P: { VSTEP: P.VSTEP } };
  }
}

export function comboToTree(P) {
  if (P.BODY) {
    const kids = [P.BODY, P.PARTNER].filter(Boolean).map((b) => body(b, P));
    return kids.length > 1 ? { id: 'par', kids } : kids[0];
  }
  const counted = P.FINISHER === 0;
  const finisher = counted
    ? { id: 'finisher-counted', P: { PHASE: P.PHASE, STUN: P.STUN, BACKWARD: P.BACKWARD } }
    : { id: 'finisher-guarded', P: { PHASE: P.PHASE, STUN: P.STUN } };
  const opening = { id: OPENINGS[P.OPENING], P: [
    {}, { WAIT: P.WAIT, STEP: P.STEP }, { WAIT: P.WAIT, STEP: P.STEP },
    { SSTEP: P.SSTEP, GAP: P.GAP, START: P.START, SCANS: P.SCANS }][P.OPENING] };
  const bare = P.OPENING === 0 && !P.RELOCATE && !P.BOOT && counted;
  const main = bare ? finisher : { id: 'seq', kids: [opening, P.RELOCATE ? { id: 'relocate', P: { HOP: P.HOP }, kids: [finisher] } : finisher] };
  const decoys = P.DECOYS ? { id: 'decoys', P: { DECOYS: P.DECOYS, DECOY: P.DECOY } } : null;
  if (P.BOOT) return { id: 'boot', P: { HOP: P.HOP }, kids: decoys ? [main, decoys] : [main] };
  return decoys ? { id: 'image', kids: [main, decoys] } : main;
}
