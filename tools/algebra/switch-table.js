// Outcome-indexed P-space dispatch. Four states are independent of the
// two to four selectable payloads. A row nibble is 4 * nextState + branch.
import { modInverse } from './util.js';

const outcomes = ['LOSS', 'WIN', 'TIE'];

export const switchTable = {
  kids: [2, 4],
  params: { CELL: [1, 500], FIRST: [0, 15], LOSS: [0, 65535], WIN: [0, 65535], TIE: [0, 65535], PACKED: [0, 1] },
  defaults: { CELL: 1, FIRST: 0, LOSS: 0x0505, WIN: 0x5050, TIE: 0x1414, PACKED: 0 },
  purpose: 'Chooses a payload and independently stores the next state using a result-indexed P-space table. FIRST is one row; LOSS, WIN and TIE pack four row nibbles each (low nibble is state 0). A row is 4 times its next state plus its zero-based payload. PACKED 1 deduplicates rows and encodes the next state as three outcome-specific residues.',
  testedProfiles: ['pspace', 'lp-hill', '94x-hill', 'tinylp'],
  knowledge: {
    parameterRoles: { CELL: 'Private persistent state slot', FIRST: 'First-round row and packed spare-row fallback', LOSS: 'Four loss rows', WIN: 'Four win rows', TIE: 'Four tie rows', PACKED: '0 explicit logical states, 1 outcome-specific residue encoding' },
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
  ctx.ins('', 'STP', 'B', `@${row}`, `#${P.CELL}`);
  ctx.ins('', 'JMP', 'B', `@${row}`);
  ctx.ins('result', 'DAT', 'F', '#0', '#0');
  ctx.ins('row', 'DAT', 'F', '#0', `#${plan.first}`);
  plan.moduli.forEach((modulus, i) => ctx.ins(i ? '' : 'moduli', 'DAT', 'F', '#0', `#${modulus}`));
  plan.rows.forEach(({ branch, next }, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entries[branch], `#${next}`));
}

export function emitSwitchTable(ctx, entries) {
  const { L, P } = ctx;
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
  ctx.ins('', 'STP', 'B', `@${row}`, `#${P.CELL}`);
  ctx.ins('', 'JMP', 'B', `@${row}`);
  ctx.ins('result', 'DAT', 'F', '#0', '#0');
  ctx.ins('row', 'DAT', 'F', '#0', '#0');
  tableRows(P).forEach(({ branch, next }, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entries[branch], `#${next}`));
}
