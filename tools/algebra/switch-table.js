// Outcome-indexed P-space dispatch. Four states are independent of the
// two to four selectable payloads. A row nibble is 4 * nextState + branch.
import { modInverse } from './util.js';

const outcomes = ['LOSS', 'WIN', 'TIE'];

export const switchTable = {
  kids: [2, 6],
  params: { CELL: [1, 500], FIRST: [0, 15], LOSS: [0, 65535], WIN: [0, 65535], TIE: [0, 65535], PACKED: [0, 1], SEAL: [0, 1], TRACK: [0, 3400], TFIRST: [0, 1],
    ROWS: [0, 1], STATES: [2, 16], ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`R${i}`, [0, 32767]])) },
  defaults: { CELL: 1, FIRST: 0, LOSS: 0x0505, WIN: 0x5050, TIE: 0x1414, PACKED: 0, SEAL: 0, TRACK: 0, TFIRST: 1,
    ROWS: 0, STATES: 2, ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`R${i}`, 0])) },
  purpose: 'Chooses a payload and independently stores the next state using a result-indexed P-space table. FIRST is one row; LOSS, WIN and TIE pack four row nibbles each (low nibble is state 0). A row is 4 times its next state plus its zero-based payload. PACKED 1 deduplicates rows and encodes the next state as three outcome-specific residues. ROWS 1 is the P^3 table of Sunset and Mantrap Arcade with up to 16 states: state k plays member Rk % 8 and goes to state (Rk >> 3) & 15 after a loss, (Rk >> 7) & 15 after a win and (Rk >> 11) & 15 after a tie; FIRST is the first round\'s state. Each state\'s stored number is chosen so that its residues by three moduli (one per result) are those next states.',
  testedProfiles: ['pspace', 'lp-hill', '94x-hill', 'tinylp'],
  knowledge: {
    parameterRoles: { CELL: 'Private persistent state slot', FIRST: 'First-round row and packed spare-row fallback', LOSS: 'Four loss rows', WIN: 'Four win rows', TIE: 'Four tie rows', PACKED: '0 explicit logical states, 1 outcome-specific residue encoding', TFIRST: 'With TRACK, the payload played while both cells are 0 (the first round)', TRACK: '0 off; otherwise plays payload (arm + phase + TFIRST) mod 2 from P-space cells TRACK and TRACK+1, kept by the switch-score above it (its TRACK), and stores nothing', SEAL: '1 overwrites the STP with a DAT once the state is stored, so a stray process that re-enters the table mid-round dies instead of rewriting it' },
    invariants: ['P-space cell 0 is reserved for the prior result.', 'Every row selects an existing child and stores the independent next state.', 'The gate checks first round, every result/state combination and an out-of-range state.'],
    evidence: ['docs/hill-block-review.md#x-and-p-space-need-a-controller-contract', 'test/algebra-hill-profile.test.js'],
  },
};

const rowCode = (table, state) => (table >> (4 * state)) & 15;
const decode = code => ({ branch: code % 4, next: code >> 2 });
const transitionCodes = P => outcomes.flatMap(key => Array.from({ length: 4 }, (_, state) => rowCode(P[key], state)));

export function tableRows(P) {
  return [...transitionCodes(P), P.FIRST].map(decode);
}

export function tableChoice(P, result, state) {
  return decode(result === -1 ? P.FIRST : rowCode(P[outcomes[Math.min(2, result)]], state % 4));
}

export function packedPlan(P, core) {
  const codes = [...new Set([...transitionCodes(P), P.FIRST])];
  const low = Math.max(2, codes.length), middle = low + 1;
  let high = middle + 1;
  while (!modInverse(high, low) || !modInverse(high, middle)) high++;
  const moduli = [low, middle, high];
  const product = low * middle * high;
  if (product > core) return null;
  const basis = moduli.map(modulus => {
    const part = product / modulus;
    return part * modInverse(part % modulus, modulus);
  });
  // The build-time Chinese remainder construction makes the same stored
  // value select a different row depending on the prior outcome.
  const states = Array.from({ length: 4 }, (_, state) =>
    outcomes.reduce((sum, key, i) => sum + basis[i] * codes.indexOf(rowCode(P[key], state)), 0) % product);
  const first = codes.indexOf(P.FIRST);
  const rows = Array.from({ length: high }, (_, i) => decode(codes[i] ?? P.FIRST))
    .map(({ branch, next }) => ({ branch, next: states[next] }));
  return { moduli, states, first, rows };
}

function emitPacked(ctx, entries, plan) {
  const { L, P } = ctx;
  const result = L('result'), row = L('row'), dispatch = L('dispatch');
  ctx.ins('start', 'LDP', 'AB', '#0', result);
  ctx.ins('', 'ADD', 'AB', '#1', result);                      // first round becomes zero
  ctx.ins('', 'JMZ', 'B', dispatch, result);
  ctx.ins('', 'SLT', 'B', result, '#4');
  ctx.ins('', 'MOV', 'AB', '#3', result);                      // all multi-survivor results are ties
  ctx.ins('', 'ADD', 'AB', `#${L('moduli')}-${result}-1`, result);
  ctx.ins('', 'LDP', 'AB', `#${P.CELL}`, row);
  ctx.ins('', 'MOD', 'B', `@${result}`, row);
  ctx.ins('dispatch', 'ADD', 'AB', `#${L('table')}-${row}`, row);
  ctx.ins(P.SEAL ? 'put' : '', 'STP', 'B', `@${row}`, `#${P.CELL}`);
  if (P.SEAL) ctx.ins('', 'MOV', 'I', result, L('put'));
  ctx.ins('', 'JMP', 'B', `@${row}`);
  ctx.ins('result', 'DAT', 'F', '#0', '#0');
  ctx.ins('row', 'DAT', 'F', '#0', `#${plan.first}`);
  plan.moduli.forEach((modulus, i) => ctx.ins(i ? '' : 'moduli', 'DAT', 'F', '#0', `#${modulus}`));
  plan.rows.forEach(({ branch, next }, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entries[branch], `#${next}`));
}

// With TRACK the prediction is kept by the switch-score above; this only reads it.
export const trackChoice = (arm, phase, first) => (arm + phase + first) % 2;

function emitTracked(ctx, entries) {
  const { L, P } = ctx;
  const row = L('row'), phase = L('phase');
  ctx.ins('start', 'LDP', 'AB', `#${P.TRACK}`, row);
  ctx.ins('', 'LDP', 'AB', `#${P.TRACK + 1}`, phase);
  ctx.ins('', 'ADD', 'B', phase, row);
  if (P.TFIRST) ctx.ins('', 'ADD', 'AB', `#${P.TFIRST}`, row);
  ctx.ins('', 'MOD', 'AB', '#2', row);
  ctx.ins('', 'ADD', 'AB', `#${L('table')}-${row}`, row);
  ctx.ins('', 'JMP', 'B', `@${row}`);
  ctx.ins('phase', 'DAT', 'F', '#0', '#0');
  ctx.ins('row', 'DAT', 'F', '#0', '#0');
  entries.slice(0, 2).forEach((entry, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entry));
}

// ROWS 1: state k's row, decoded. The member it plays and its next state after each result.
export const rowOf = (P, k) => { const R = P[`R${k}`] ?? 0; return { member: R % 8, loss: (R >> 3) & 15, win: (R >> 7) & 15, tie: (R >> 11) & 15 }; };
export const packRow = (member, loss, win, tie) => member + 8 * loss + 128 * win + 2048 * tie;
const gcdOf = (a, b) => (b ? gcdOf(b, a % b) : a);
// Three pairwise coprime moduli of at least STATES (loss, win, tie) and each state's stored
// number: its residue by each modulus is its next state after that result.
export function rowsPlan(P, core) {
  const S = P.STATES;
  let best = null;
  for (let a = S; a < S + 12; a++) for (let b = a + 1; b < S + 14; b++) for (let c = b + 1; c < S + 16; c++) {
    if (gcdOf(a, b) !== 1 || gcdOf(a, c) !== 1 || gcdOf(b, c) !== 1) continue;
    if (!best || a * b * c < best[0] * best[1] * best[2]) best = [a, b, c];
  }
  if (!best || best[0] * best[1] * best[2] > core) return null;
  const moduli = best, product = moduli[0] * moduli[1] * moduli[2];
  const basis = moduli.map((m) => { const part = product / m; return part * modInverse(part % m, m); });
  const values = Array.from({ length: S }, (_, k) => {
    const r = rowOf(P, k);
    return (basis[0] * r.loss + basis[1] * r.win + basis[2] * r.tie) % product;
  });
  return { moduli, values };
}
// What the emitted ROWS code plays and stores, from the result (-1 first round) and stored number.
export function rowsChoice(P, core, result, stored) {
  const plan = rowsPlan(P, core);
  let state = P.FIRST;
  if (result !== -1) {
    const m = plan.moduli[Math.min(2, result === 0 ? 0 : result === 1 ? 1 : 2)];
    const r = stored % m;
    state = r < P.STATES ? r : P.FIRST;
  }
  return { branch: rowOf(P, state).member, state, stored: plan.values[state] };
}

function emitRows(ctx, entries) {
  const { L, P } = ctx, plan = rowsPlan(P, ctx.core);
  const res = L('result'), row = L('row');
  ctx.ins('start', 'LDP', 'AB', '#0', res);
  ctx.ins('', 'ADD', 'AB', '#1', res);                          // the first round becomes 0
  ctx.ins('', 'JMZ', 'B', L('first'), res);
  ctx.ins('', 'SLT', 'B', res, '#4');                           // loss 1, win 2, tie 3 (more survivors: a tie too)
  ctx.ins('', 'MOV', 'AB', '#3', res);
  ctx.ins('', 'ADD', 'AB', `#${L('moduli')}-${res}-1`, res);
  ctx.ins('', 'LDP', 'AB', `#${P.CELL}`, row);
  ctx.ins('', 'MOD', 'B', `@${res}`, row);
  ctx.ins('', 'SLT', 'B', row, `#${P.STATES}`);                  // a number from no state (a brainwash): FIRST
  ctx.ins('first', 'MOV', 'AB', `#${P.FIRST}`, row);
  ctx.ins('', 'ADD', 'AB', `#${L('table')}-${row}`, row);
  ctx.ins(P.SEAL ? 'put' : '', 'STP', 'B', `@${row}`, `#${P.CELL}`);
  if (P.SEAL) ctx.ins('', 'MOV', 'I', res, L('put'));
  ctx.ins('', 'JMP', 'B', `@${row}`);
  ctx.ins('result', 'DAT', 'F', '#0', '#0');
  ctx.ins('row', 'DAT', 'F', '#0', '#0');
  plan.moduli.forEach((m, i) => ctx.ins(i ? '' : 'moduli', 'DAT', 'F', '#0', `#${m}`));
  plan.values.forEach((v, k) => ctx.ins(k ? '' : 'table', 'JMP', 'B', entries[rowOf(P, k).member], `#${v}`));
}

export function emitSwitchTable(ctx, entries) {
  const { L, P } = ctx;
  if (P.ROWS) return emitRows(ctx, entries);
  if (P.TRACK) return emitTracked(ctx, entries);
  if (P.PACKED) return emitPacked(ctx, entries, packedPlan(P, ctx.core));
  const row = L('row'), result = L('result'), dispatch = L('dispatch');
  ctx.ins('start', 'LDP', 'AB', '#0', result);
  ctx.ins('', 'ADD', 'AB', '#1', result);
  ctx.ins('', 'JMZ', 'B', L('first'), result);
  ctx.ins('', 'LDP', 'AB', `#${P.CELL}`, row);
  ctx.ins('', 'MOD', 'AB', '#4', row);
  ctx.ins('', 'DJN', 'B', L('nonloss'), result);
  ctx.ins('', 'JMP', 'B', dispatch);
  ctx.ins('nonloss', 'DJN', 'B', L('tie'), result);
  ctx.ins('', 'ADD', 'AB', '#4', row);
  ctx.ins('', 'JMP', 'B', dispatch);
  ctx.ins('tie', 'ADD', 'AB', '#8', row);
  ctx.ins('', 'JMP', 'B', dispatch);
  ctx.ins('first', 'MOV', 'AB', '#12', row);
  ctx.ins('dispatch', 'ADD', 'AB', `#${L('table')}-${row}`, row);
  ctx.ins(P.SEAL ? 'put' : '', 'STP', 'B', `@${row}`, `#${P.CELL}`);
  if (P.SEAL) ctx.ins('', 'MOV', 'I', result, L('put'));
  ctx.ins('', 'JMP', 'B', `@${row}`);
  ctx.ins('result', 'DAT', 'F', '#0', '#0');
  ctx.ins('row', 'DAT', 'F', '#0', '#0');
  tableRows(P).forEach(({ branch, next }, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entries[branch], `#${next}`));
}
