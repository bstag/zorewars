// A one-pass, one-process LP scanner whose scan ends by finding itself.
//
// The scan pointer walks a lattice (STEP apart) that is aimed, through PROBES, at
// one cell of the scanner's own loop: the trip. Every stun bomb leaves a known
// field of the trip changed, and the instruction that returns to the scan reads
// that field, so the probe that bombs the trip is the last one: the process falls
// into `spl #0`, which feeds a DAT clear up to the eight-process cap. There is
// no counter and no range guard, so the layout carries the proof: `mismatches`
// replays the lattice against the block's own cells and refuses any setting
// where a cell the scan can see is reached before the trip, or where the trip's
// bombs land on the clear.
//
// MODE 0: `jmz.f` looks at one cell every two cycles (0.5c); the trip is the
//   `add` that steps the pointer. Bombs have both fields zero (invisible to it).
// MODE 1: `sne.f` compares two cells GAP apart every three cycles (0.66c); the
//   trip is the `jmp` that closes the scan loop. Both cells are bombed.
// STUN 0: `jmp #x` (holds a process in place). 1: `spl #x` with `jmp -1` after it
//   (fills the opponent's eight slots). 2: `djn #0,#0` (holds for 7,999 turns).
// CLEAR 0: forward, the pointer is the SPL's B-field. 1: backward, the pointer
//   is a cell after the loop. Either way the DAT that lands on the pointer
//   carries the skip over the clear's own cells, so it laps the core forever.
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const wrap = (value, core) => ((value % core) + core) % core;

// The block as numbers: every operand is an offset inside the block.
function plainPlan(P, core = 8000) {
  const pair = P.MODE === 1, two = P.STUN === 1, back = P.CLEAR === 1;
  const shared = pair && two;                     // the bomb's fields double as the pair step
  const hits = (pair ? 2 : 1) * (two ? 2 : 1);
  const names = ['adv', 'look', ...(pair ? ['lb'] : []), ...Array.from({ length: hits }, (_, i) => `s${i + 1}`),
    'back', 'feed', 'wipe', 'loop', 'kill',
    ...(back ? (two ? ['bomb', 'cur', 'jbomb'] : ['bomb', 'cur']) : (two ? ['bomb', 'jbomb'] : ['bomb'])),
    ...(pair && !shared ? ['inc'] : []), ...(two ? ['fix'] : [])];
  const at = Object.fromEntries(names.map((name, i) => [name, i]));
  const trip = pair ? 'lb' : 'adv';
  // First probe is one STEP on from these, and probe PROBES is the trip.
  const first = wrap(at[trip] - at.look - P.PROBES * P.STEP, core);
  const fieldsOfBomb = shared ? P.STEP : 0;
  const cells = [];
  const put = (label, op, mod, am, a, bm, b) => cells.push({ label, op, mod, am, a, bm, b });
  const to = (label, from) => at[label] - at[from];
  const again = two ? 'fix' : 'adv';
  if (pair) put('adv', 'ADD', 'F', '$', to(shared ? 'bomb' : 'inc', 'adv'), '$', to('look', 'adv'));
  else put('adv', 'ADD', 'AB', '#', P.STEP, '$', to('look', 'adv'));
  if (pair) {
    put('look', 'SNE', 'F', '$', first, '$', wrap(first + P.GAP, core));
    put('lb', 'JMP', 'B', '$', to('adv', 'lb'), '$', 0);
  } else put('look', 'JMZ', 'F', '$', to('adv', 'look'), '$', first);
  const stunLine = (label, source, mode) => put(label, 'MOV', 'I', '$', to(source, label), mode, to('look', label));
  if (!pair && !two) stunLine('s1', 'bomb', '@');
  if (!pair && two) { stunLine('s1', 'bomb', '>'); stunLine('s2', 'jbomb', '@'); }
  if (pair && !two) { stunLine('s1', 'bomb', '*'); stunLine('s2', 'bomb', '@'); }
  if (pair && two) {
    stunLine('s1', 'bomb', '}'); stunLine('s2', 'bomb', '>'); stunLine('s3', 'jbomb', '*'); stunLine('s4', 'jbomb', '@');
  }
  // The bomb zeroes the trip's A-field, or (shared) fills the trip's empty B-field.
  if (shared) put('back', 'JMZ', 'B', '$', to(again, 'back'), '$', to(trip, 'back'));
  else put('back', 'JMN', 'A', '$', to(again, 'back'), '$', to(trip, 'back'));
  const keep = (back ? at.cur : at.kill + 1) - at.feed;          // cells from the SPL that the clear steps over
  put('feed', 'SPL', 'B', '#', 0, back ? '$' : '#', back ? 0 : keep);
  put('wipe', 'MOV', 'I', '$', to('kill', 'wipe'), back ? '<' : '>', to(back ? 'cur' : 'feed', 'wipe'));
  put('loop', 'JMP', 'B', '$', to('wipe', 'loop'), '$', 0);
  put('kill', 'DAT', 'F', '#', 0, '#', back ? -keep : keep);
  const bombOp = ['JMP', 'SPL', 'DJN'][P.STUN];
  for (const name of names.slice(at.kill + 1)) {
    if (name === 'bomb') put('bomb', bombOp, 'B', '#', fieldsOfBomb, P.STUN === 2 ? '#' : '$', fieldsOfBomb);
    if (name === 'jbomb') put('jbomb', 'JMP', 'B', '$', -1, '$', 0);
    if (name === 'cur') put('cur', 'DAT', 'F', '#', 0, '#', -at.cur);       // first DAT lands just before the block
    if (name === 'inc') put('inc', 'DAT', 'F', '#', P.STEP, '#', P.STEP);
    if (name === 'fix') put('fix', 'DJN', pair ? 'F' : 'B', '$', to('adv', 'fix'), '$', to('look', 'fix'));
  }
  const stunCount = hits;
  // Steps from entry until the SPL runs, when nothing but the trip is found.
  const handoff = (P.PROBES - 1) * (pair ? 3 : 2) + 2 + stunCount + 1;
  return { cells, at, names, trip, first, keep, pair, two, back, shared, handoff, size: names.length };
}

// GUARD 1: the same scanner with one more line (two for MODE 0 with the SPL/JMP
// pair), run only after the scan has found something: an SLT on the scan
// pointer that passes over every cell from `look` to the end of the block. The
// trip is the `add` in front of `look`, the one own cell the guard leaves out,
// so the lattice may be as fine as STEP allows and the first own cell that is
// bombed is still the trip. In pair mode the guard sits between the compare and
// the loop's jump (seq skips it when the pair is equal), so it needs no jump of
// its own; the pair is (trip - GAP, trip) on the last probe, and the window is
// GAP wider so it also covers an own cell seen through the lower pointer.
// The pair-mode SPL/JMP stun puts the JMP on the found cell and the SPL below it
// through predecrements, which the loop's DJN.F makes every probe anyway (the
// step is one larger), so no pointer repair is needed.
function guardedPlan(P, core = 8000) {
  const pair = P.MODE === 1, two = P.STUN === 1, back = P.CLEAR === 1;
  const hits = (pair ? 2 : 1) * (two ? 2 : 1);
  const names = ['adv', 'look', 'grd', ...(pair ? ['lb'] : (two ? ['res'] : [])), ...Array.from({ length: hits }, (_, i) => `s${i + 1}`),
    'back', 'feed', 'wipe', 'loop', 'kill', 'bomb', ...(pair && !two ? ['inc'] : []), ...(back ? ['cur'] : []),
    ...(two ? ['jbomb'] : []), ...(two && !pair ? ['fix'] : [])];
  const at = Object.fromEntries(names.map((name, i) => [name, i]));
  const tail = names.length - 1 - at.look;                       // offsets 0..tail from look are the block
  const window = tail + (pair ? P.GAP + (two ? 1 : 0) : 0);     // the pair's SPL lands one below each cell
  const firstB = wrap(-1 - P.PROBES * P.STEP, core);             // probe PROBES looks at look - 1, the trip
  const first = pair ? wrap(firstB - P.GAP, core) : firstB;
  const drift = pair && two ? 1 : 0;                             // the loop's DJN.F takes one back each probe
  const cells = [];
  const put = (label, op, mod, am, a, bm, b) => cells.push({ label, op, mod, am, a, bm, b });
  const to = (label, from) => at[label] - at[from];
  if (pair) put('adv', 'ADD', 'F', '$', to(two ? 'bomb' : 'inc', 'adv'), '$', to('look', 'adv'));
  else put('adv', 'ADD', 'AB', '#', P.STEP, '$', to('look', 'adv'));
  if (pair) put('look', 'SEQ', 'F', '$', wrap(first - drift, core), '$', wrap(firstB - drift, core));
  else put('look', 'JMZ', 'F', '$', to('adv', 'look'), '$', firstB);
  if (pair || two) put('grd', 'SLT', 'AB', '#', window, '$', to('look', 'grd'));      // outside the window: skip the way back
  else put('grd', 'SLT', 'B', '$', to('look', 'grd'), '#', window + 1);                // inside the window: skip the bomb
  if (pair) put('lb', two ? 'DJN' : 'JMP', two ? 'F' : 'B', '$', to('adv', 'lb'), '$', two ? to('look', 'lb') : 0);
  else if (two) put('res', 'JMP', 'B', '$', to('adv', 'res'), '$', 0);
  const stunLine = (label, source, mode) => put(label, 'MOV', 'I', '$', to(source, label), mode, to('look', label));
  if (!pair && !two) stunLine('s1', 'bomb', '@');
  if (!pair && two) { stunLine('s1', 'bomb', '>'); stunLine('s2', 'jbomb', '@'); }
  if (pair && !two) { stunLine('s1', 'bomb', '*'); stunLine('s2', 'bomb', '@'); }
  if (pair && two) { stunLine('s1', 'jbomb', '*'); stunLine('s2', 'jbomb', '@'); stunLine('s3', 'bomb', '{'); stunLine('s4', 'bomb', '<'); }
  // Every bomb that can land on the trip has a zero B-field; the trip's own is the distance to look.
  put('back', 'JMN', 'B', '$', to(two && !pair ? 'fix' : 'adv', 'back'), '$', to('adv', 'back'));
  const keep = (back ? at.cur : at.kill + 1) - at.feed;
  put('feed', 'SPL', 'B', '#', 0, back ? '$' : '#', back ? 0 : keep);
  put('wipe', 'MOV', 'I', '$', to('kill', 'wipe'), back ? '<' : '>', to(back ? 'cur' : 'feed', 'wipe'));
  put('loop', 'JMP', 'B', '$', to('wipe', 'loop'), '$', 0);
  put('kill', 'DAT', 'F', '#', 0, '#', back ? -keep : keep);
  const stride = pair && two ? P.STEP + 1 : 0;
  for (const name of names.slice(at.kill + 1)) {
    if (name === 'bomb') put('bomb', ['JMP', 'SPL', 'DJN'][P.STUN], 'B', '#', stride, P.STUN === 2 ? '#' : '$', stride);
    if (name === 'jbomb') put('jbomb', 'JMP', 'B', '$', -1, '$', 0);
    if (name === 'cur') put('cur', 'DAT', 'F', '#', 0, '#', -at.cur);
    if (name === 'inc') put('inc', 'DAT', 'F', '#', P.STEP, '#', P.STEP);
    if (name === 'fix') put('fix', 'DJN', 'B', '$', to('adv', 'fix'), '$', to('look', 'fix'));
  }
  // Own cells the scan sees before the trip are passed over by the guard, at a cost in steps.
  const fields = (offset) => {
    const i = wrap(offset + at.look, core);
    if (i >= cells.length) return '0,0';
    return i === at.look ? 'look' : `${wrap(cells[i].a, core)},${wrap(cells[i].b, core)}`;
  };
  let passed = 0;
  for (let k = 1; k < P.PROBES; k++) {
    const b = firstB + k * P.STEP;
    if (pair ? fields(b) !== fields(b - P.GAP) : fields(b) !== '0,0') passed++;
  }
  const handoff = (P.PROBES - 1) * (pair ? 3 : 2) + passed * (pair ? 1 : 2) + 3 + hits + 1;
  return { cells, at, names, trip: 'adv', first, keep, pair, two, back, shared: pair && two, handoff, size: names.length, guard: true, window, passed, below: pair && two };
}

// SECTOR D (2000 or 4000): one of core / D copies of the same scanner D cells apart (`copies`
// with N = core / D and the same D). Pair mode only, guarded, one process each.
//   - the guard reduces the probe offset modulo D, so it passes over every copy's code, not just its own;
//   - the trip is a data cell two before `look` (the add between them is off the lattice), so a copy
//     that bombs another copy's trip only makes that copy go to its clear at its next find;
//   - the clear is one process that sweeps forward from the trip and wraps (MOD D) just before the
//     next copy: the copies' clears tile the core and none ever writes on another copy.
// FEED 1: each copy's clear runs its share of the eight slots, 8 / copies processes, made by a fan of
// SPL 1 lines (so no copy's clear can take another's slots), all on one shared pointer (the guard's
// scratch cell, reset when the clear starts). A process that takes the pointer past the sector's end
// resets it; until then only the other processes of the same clear can write further, at most one
// cell each. So the sector ends at the first of 8 / copies - 1 blank cells laid out before the next
// copy's trip, and the overshoot lands on those, never on the copy's code.
function sectorPlan(P, core = 8000) {
  const two = P.STUN === 1, D = P.SECTOR, fed = !!P.FEED, share = 8 * D / core, PADS = fed ? share - 1 : 0;
  const fan = Array.from({ length: Math.log2(share) }, (_, i) => (i ? `fan${i}` : 'feed'));
  const clear = fed ? [...fan, 'rst', 'wipe', 'chk', 'loop', 'rj'] : ['wipe', 'wrap', 'loop'];
  const names = [...Array.from({ length: PADS }, (_, i) => `pad${i}`), 'tripc', 'adv', 'look', 'lb', 'gmov', 'gmod', 'grd', 'gback',
    ...Array.from({ length: two ? 4 : 2 }, (_, i) => `s${i + 1}`), 'back', ...clear, 'kill', 'bomb', two ? 'jbomb' : 'inc', 'gtmp'];
  const at = Object.fromEntries(names.map((name, i) => [name, i]));
  const tail = names.length - 1 - at.look;
  const window = tail + P.GAP + (two ? 1 : 0);
  const firstB = wrap(-2 - P.PROBES * P.STEP, core), first = wrap(firstB - P.GAP, core);
  const drift = two ? 1 : 0, keep = fed ? 1 : at.kill + 1 - at.tripc;
  // FEED 1: the pointer is gtmp, the last cell; T is where the next copy's first pad sits.
  const last = fed ? D - at.gtmp : 0;
  const cells = [];
  const put = (label, op, mod, am, a, bm, b) => cells.push({ label, op, mod, am, a, bm, b });
  const to = (label, from) => at[label] - at[from];
  for (let i = 0; i < PADS; i++) put(`pad${i}`, 'DAT', 'F', '$', 0, '$', 0);
  put('tripc', 'DAT', 'F', '#', 0, '#', 1);
  put('adv', 'ADD', 'F', '$', to(two ? 'bomb' : 'inc', 'adv'), '$', to('look', 'adv'));
  put('look', 'SNE', 'F', '$', wrap(first - drift, core), '$', wrap(firstB - drift, core));      // differ: skip the way back
  put('lb', two ? 'DJN' : 'JMP', two ? 'F' : 'B', '$', to('adv', 'lb'), '$', two ? to('look', 'lb') : 0);
  put('gmov', 'MOV', 'B', '$', to('look', 'gmov'), '$', to('gtmp', 'gmov'));
  put('gmod', 'MOD', 'AB', '#', D, '$', to('gtmp', 'gmod'));
  put('grd', 'SLT', 'AB', '#', window, '$', to('gtmp', 'grd'));                                   // outside every copy: skip the way back
  put('gback', 'JMP', 'B', '$', to('lb', 'gback'), '$', 0);
  const stunLine = (label, source, mode) => put(label, 'MOV', 'I', '$', to(source, label), mode, to('look', label));
  if (two) { stunLine('s1', 'jbomb', '*'); stunLine('s2', 'jbomb', '@'); stunLine('s3', 'bomb', '{'); stunLine('s4', 'bomb', '<'); }
  else { stunLine('s1', 'bomb', '*'); stunLine('s2', 'bomb', '@'); }
  put('back', 'JMN', 'B', '$', to('adv', 'back'), '$', to('tripc', 'back'));
  if (fed) {
    for (const line of fan) put(line, 'SPL', 'B', '$', 1, '$', 0);
    put('rst', 'MOV', 'AB', '#', keep, '$', to('gtmp', 'rst'));                 // the first cell after the block
    put('wipe', 'MOV', 'I', '$', to('kill', 'wipe'), '>', to('gtmp', 'wipe'));
    put('chk', 'SLT', 'AB', '#', last - 1, '$', to('gtmp', 'chk'));            // past the cell before the next copy's pads: skip the way back
    put('loop', 'JMP', 'B', '$', to('wipe', 'loop'), '$', 0);
    put('rj', 'JMP', 'B', '$', to('rst', 'rj'), '$', 0);
    put('kill', 'DAT', 'F', '#', 0, '#', 0);                                   // blank, so a pad it lands on stays blank
  } else {
    put('wipe', 'MOV', 'I', '$', to('kill', 'wipe'), '>', to('tripc', 'wipe'));
    put('wrap', 'MOD', 'AB', '#', D, '$', to('tripc', 'wrap'));
    put('loop', 'JMP', 'B', '$', to('wipe', 'loop'), '$', 0);
    put('kill', 'DAT', 'F', '#', 0, '#', keep);
  }
  const stride = two ? P.STEP + 1 : 0;
  put('bomb', ['JMP', 'SPL', 'DJN'][P.STUN], 'B', '#', stride, P.STUN === 2 ? '#' : '$', stride);
  if (two) put('jbomb', 'JMP', 'B', '$', -1, '$', 0);
  else put('inc', 'DAT', 'F', '#', P.STEP, '#', P.STEP);
  put('gtmp', 'DAT', 'F', '#', 0, '#', 0);
  return { cells, at, names, trip: 'tripc', first, keep, pair: true, two, back: false, shared: two, handoff: 0, size: names.length,
    guard: true, window, below: two, sector: D, copies: core / D, fed, last, pads: PADS, share };
}

function sectorIssues(P, core) {
  if (!P.SECTOR) return [];
  const g = gcd(P.STEP, core), out = [];
  if (P.SECTOR !== 2000 && P.SECTOR !== 4000) out.push('lp-selfhit-scanner: SECTOR is 2000 (four copies) or 4000 (two)');
  if (P.MODE !== 1 || !P.GUARD) out.push('lp-selfhit-scanner: SECTOR needs the guarded pair scan (MODE 1, GUARD 1)');
  if (g < 2 || (1 + P.GAP) % g === 0) out.push('lp-selfhit-scanner: SECTOR needs a lattice that never probes the cell before look (STEP even, GAP + 1 not a multiple of its spacing)');
  if (P.SECTOR % g) out.push('lp-selfhit-scanner: SECTOR must be a multiple of the lattice spacing, so every copy sees the same lattice');
  if (P.GAP > 64) out.push('lp-selfhit-scanner: GUARD 1 passes over GAP more cells than the block, so GAP may be at most 64');
  return out;
}
function feedIssues(P) {
  return P.FEED && !P.SECTOR ? ['lp-selfhit-scanner: FEED is the fed sector clear, for SECTOR copies'] : [];
}

const plans = new Map();
export function selfhitPlan(P, core = 8000) {
  const key = `${core}:${P.MODE}:${P.STEP}:${P.PROBES}:${P.GAP}:${P.STUN}:${P.CLEAR}:${P.GUARD ? 1 : 0}:${P.SECTOR ?? 0}:${P.FEED ?? 0}`;
  if (!plans.has(key)) plans.set(key, P.SECTOR ? sectorPlan(P, core) : P.GUARD ? guardedPlan(P, core) : plainPlan(P, core));
  return plans.get(key);
}

// Replay the lattice against the block's own cells.
export function selfhitIssues(P, core = 8000) {
  if (P.FEED && !P.SECTOR) return feedIssues(P);
  if (P.SECTOR) { const out = sectorIssues(P, core); if (out.length) return out; }
  const plan = selfhitPlan(P, core), { at, cells, pair, two } = plan;
  const lattice = core / gcd(P.STEP, core);
  if (P.PROBES > lattice) return [`lp-selfhit-scanner: STEP ${P.STEP} returns to its start after ${lattice} probes, before PROBES ${P.PROBES}`];
  // A visible bomb left by the lower pointer would be found by the upper one, bombed again, and so on along the lattice.
  if (pair && two && P.GAP % gcd(P.STEP, core) === 0) return ['lp-selfhit-scanner: GAP is a multiple of the lattice spacing, so the pair would find its own SPL/JMP bombs'];
  if (plan.guard) return pair && P.GAP > 64 ? ['lp-selfhit-scanner: GUARD 1 passes over GAP more cells than the block, so GAP may be at most 64'] : [];
  const visible = (i) => i >= 0 && i < cells.length && (wrap(cells[i].a, core) !== 0 || wrap(cells[i].b, core) !== 0);
  const own = (address) => { const i = wrap(address + at.look, core); return i < cells.length ? i : -1; };   // address is an offset from look
  for (let k = 1; k <= P.PROBES; k++) {
    const a = own(plan.first + k * P.STEP), b = pair ? own(plan.first + P.GAP + k * P.STEP) : -1;
    const seen = [a, b].filter(visible);
    if (k < P.PROBES) {
      if (seen.length) return [`lp-selfhit-scanner: probe ${k} finds its own ${cells[seen[0]].label} before the trip (probe ${P.PROBES})`];
      continue;
    }
    // The trip probe: inside the block its bombs may only land on the trip (and, for a pair, the cell after it).
    const bases = pair ? [plan.first + k * P.STEP, plan.first + P.GAP + k * P.STEP] : [plan.first + k * P.STEP];
    const bombed = bases.flatMap((base) => (two ? [own(base), own(base + 1)] : [own(base)])).filter((i) => i >= 0);
    const allowed = new Set([at[plan.trip], ...(two ? [at[plan.trip] + 1] : [])]);
    const hurt = bombed.find((i) => !allowed.has(i));
    if (hurt !== undefined) return [`lp-selfhit-scanner: the trip's bombs also land on its own ${cells[hurt].label}`];
  }
  return [];
}

// Under a switch, a roaming process of the member that runs (a paper's copy, an imp) can execute the
// cell where a member not taken starts, and the gate then counts that member as entered. A block has
// really started only when a process runs its entry while its first instruction is still there.
const started = new WeakMap();
const sameShape = (a, b) => a.op === b.op && a.mod === b.mod && a.aMode === b.aMode && a.bMode === b.bMode;
function entryWatch(api, label) {
  const state = { entered: false }, entry = api.entry(), code = api.code(label);
  started.set(api, state);
  return { state, see(pc) { if (!state.entered && pc === entry && sameShape(api.vm.peek(pc), code)) state.entered = true; } };
}
const notStarted = (api) => !started.get(api)?.entered;

const fmt = (mode, value) => `${mode}${value}`;

export default {
  id: 'lp-selfhit-scanner',
  kind: 'body', exit: 'never', dialects: '94', processes: (P) => (P.SECTOR ? (P.FEED ? 8 * P.SECTOR / 8000 : 1) : 8), writes: 'core', attacks: 'all',   // FEED: exactly its share of the eight slots
  // SECTOR: the copies' clears tile the core, so under `copies` (or `apart`) it spares the others.
  protects: (P) => (P.SECTOR ? 'siblings' : undefined),
  entry: 'adv',
  purpose: 'A one-pass LP scanner of 9 to 16 cells run by one process (MODE 0: jmz.f on one cell, 0.5c; 1: a pair GAP apart compared by fields, 0.66c) that stuns what it finds (STUN 0 jmp #, 1 spl/jmp pair, 2 djn #0) and whose scan ends when it bombs one cell of its own loop, the trip, which drops it into an spl #0-fed DAT clear (CLEAR 0 forward, 1 backward); no counter. GUARD 1 adds an SLT that passes over the rest of the block, so any lattice works (the default pair looks at every 2nd cell in 6,000 cycles); GUARD 0 has no guard and accepts only lattices whose first visible own cell is the trip.',
  params: { MODE: [0, 1], STEP: [1, 7999], PROBES: [1, 8000], GAP: [1, 7999], STUN: [0, 2], CLEAR: [0, 1], GUARD: [0, 1], SECTOR: [0, 4000], FEED: [0, 1] },
  defaults: { MODE: 1, STEP: 28, PROBES: 2000, GAP: 14, STUN: 1, CLEAR: 1, GUARD: 1, SECTOR: 0, FEED: 0 },
  mutable(P) {
    const plan = selfhitPlan(P);
    if (plan.sector) return [['look', ['a', 'b']], ['tripc', ['a', 'b']], ['gtmp', ['b']]];
    return [['look', ['a', 'b']], ['feed', ['a', 'b']], ...(plan.back ? [['cur', ['a', 'b']]] : [])];
  },
  mismatches(P, settings) {
    if (settings.coreSize !== 8000 || settings.maxProcesses !== 8 || settings.topology) {
      return ['lp-selfhit-scanner requires the 8,000-cell LP ring with eight process slots'];
    }
    return selfhitIssues(P, settings.coreSize);
  },
  emit({ ins, P, core, siblings }) {
    const plan = selfhitPlan(P, core);
    if (plan.sector) {
      // The other copies must sit at every multiple of D, as `copies` with N = core / D and D = SECTOR lays them.
      const want = Array.from({ length: plan.copies - 1 }, (_, k) => ((k + 1) * plan.sector) % core).sort((a, b) => a - b).join();
      const have = [...new Set((siblings ?? []).map((w) => ((w.start % core) + core) % core))].sort((a, b) => a - b).join();
      if (want !== have) throw new Error(`lp-selfhit-scanner: SECTOR ${plan.sector} runs as one of ${plan.copies} copies ${plan.sector} apart (copies N ${plan.copies}, D ${plan.sector})`);
    }
    for (const cell of plan.cells) {
      ins(cell.label, cell.op, cell.mod, fmt(cell.am, cell.a), fmt(cell.bm, cell.b));
    }
  },
  // A target on the first probe that is clear of the warrior.
  plant(api) {
    const target = firstFreeProbe(api);
    return target === null ? [] : [[target.cell, { op: 'MOV', mod: 'I', aMode: '$', a: 1, bMode: '$', b: 2 }]];
  },
  running: (api) => notStarted(api) || api.vm.processes(0).some((pc) => api.inSelf(pc)),
  watch(api) {
    const { vm, at, P, core, norm, same } = api;
    const real = entryWatch(api, 'adv');
    const plan = selfhitPlan(P, core);
    const look = at('look'), wipe = at('wipe'), trip = at(plan.trip);
    const feed = plan.sector && !plan.fed ? wipe : at('feed');                 // the clear's first cell
    const pointer = plan.fed ? at('gtmp') : plan.sector ? trip : plan.back ? at('cur') : feed;
    // The other copies' blocks (SECTOR), k D cells on.
    const others = plan.sector ? Array.from({ length: plan.copies - 1 }, (_, k) => norm(api.self.start + (k + 1) * plan.sector)) : [];
    const inOther = (c) => others.findIndex((o) => api.rel(c, o) < plan.size);
    // A pad (FEED 1) is blank junk: a clear's overshoot may land there.
    const onPad = (c) => [norm(api.self.start), ...others].some((o) => api.rel(c, o) < plan.pads);
    const stunAt = new Map(Array.from({ length: plan.names.filter((n) => /^s\d$/.test(n)).length }, (_, i) => [at(`s${i + 1}`), i]));
    const planted = api.scenario === 'lp-selfhit-scanner: planted target';
    const marker = planted ? firstFreeProbe(api) : null;
    const keptFrom = plan.sector ? norm(trip + 1) : norm(feed + 1), kept = plan.keep - 1;       // wipe, loop, kill (and the bomb before a backward pointer)
    const pure = api.alone && api.total === plan.size;
    let entered = null, handoff = null, clears = 0, lastClear = null, stunned = 0, markerAt = null;
    const cleared = new Set();
    return {
      before(pc) {
        real.see(pc);
        if (entered === null && real.state.entered) entered = vm.steps;
        if (entered === null) return null;
        if (handoff === null) {
          if (pc === feed && (plan.sector && !plan.fed ? api.same(vm.peek(feed), api.code('wipe')) : vm.peek(feed).op === 'SPL')) {
            handoff = vm.steps - entered;
            // Dead cells of a larger image (a boot's original) are found too, and each costs a few steps.
            if (pure ? handoff !== plan.handoff : handoff < plan.handoff) {
              throw new Error(`lp-selfhit-scanner reached its clear after ${handoff} steps, not the predicted ${plan.handoff}`);
            }
            return null;
          }
          if (!stunAt.has(pc)) return null;
          const line = vm.peek(pc), pointerCell = vm.peek(look);
          const field = '*}{'.includes(line.bMode) ? pointerCell.a : pointerCell.b;
          return { kind: 'stun', pc, target: norm(look + field - ('{<'.includes(line.bMode) ? 1 : 0)), expected: vm.peek(norm(pc + line.a)) };
        }
        if (pc !== wipe) return null;
        const field = vm.peek(pointer).b;
        return { kind: 'clear', target: norm(pointer + field + (plan.back ? -1 : 0)) };
      },
      after(event) {
        if (!event) return;
        const { target } = event;
        if (event.kind === 'stun') {
          if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== event.pc) throw new Error('lp-selfhit-scanner lost a stun write');
          const tripBomb = target === trip || (plan.two && !plan.below && target === norm(trip + 1));
          if (api.inSelf(target) && !tripBomb && !onPad(target)) {
            throw new Error('lp-selfhit-scanner stunned its own code before the trip');
          }
          // Another copy may only be hit on its trip, which sends it to its clear.
          const other = inOther(target);
          if (other >= 0 && target !== norm(others[other] + plan.at.tripc) && !onPad(target)) throw new Error('lp-selfhit-scanner stunned another copy\'s code');
          // The trip's second bomb may be written through a pointer the first one replaced.
          if (!api.inSelf(target) && !same(vm.peek(target), event.expected)) throw new Error('lp-selfhit-scanner wrote the wrong stun bomb');
          if (marker && target === marker.cell) markerAt = vm.steps;
          stunned++;
          return;
        }
        if (plan.fed) {
          // From just past the block to the next copy's pads; never on any code.
          if ((api.inSelf(target) && !onPad(target)) || (inOther(target) >= 0 && !onPad(target)) || api.rel(target, pointer) > plan.last + plan.pads - 1) {
            throw new Error('lp-selfhit-scanner cleared outside its sector');
          }
        } else {
          if (api.rel(target, keptFrom) < kept) throw new Error('lp-selfhit-scanner cleared its own clear');
          if (plan.sector && (api.rel(target, trip) >= plan.sector || inOther(target) >= 0)) throw new Error('lp-selfhit-scanner cleared outside its sector');
        }
        if (vm.lastWrite[target] !== vm.steps || vm.peek(target).op !== 'DAT') throw new Error('lp-selfhit-scanner lost a clear write');
        clears++; lastClear = vm.steps; cleared.add(target);
      },
      final() {
        if (entered === null) return;
        if (handoff === null) throw new Error('lp-selfhit-scanner never bombed its trip');
        if (planted && marker && (markerAt === null || (api.total === plan.size && markerAt - entered > marker.steps))) {
          throw new Error('lp-selfhit-scanner did not stun the planted target on its probe');
        }
        const queue = vm.processes(0);
        if (plan.sector) {
          // One process per copy: this one sweeps its sector, one write every three of its turns.
          const mine = queue.filter((pc) => api.rel(pc, at(plan.fed ? 'rst' : 'wipe')) < (plan.fed ? 5 : 3)).length;
          if (mine !== (plan.fed ? plan.share : 1)) throw new Error(`lp-selfhit-scanner: its clear runs ${mine} processes, not ${plan.fed ? plan.share : 1}`);
          if (lastClear === null || vm.steps - lastClear > 3 * queue.length + 3) throw new Error('lp-selfhit-scanner stopped clearing before the cycle limit');
          const span = plan.fed ? plan.last - 2 : plan.sector - plan.keep;
          if (api.scenario === 'alone' && cleared.size < span) throw new Error('lp-selfhit-scanner did not cover its sector');
          return;
        }
        if (queue.length !== 8 || queue.some((pc) => api.rel(pc, wipe) > 1)) throw new Error('lp-selfhit-scanner did not fill its eight slots with the clear');
        if (lastClear === null || vm.steps - lastClear > 2) throw new Error('lp-selfhit-scanner stopped clearing before the cycle limit');
        if ((pure && stunned !== stunAt.size) || (api.alone && cleared.size < core - plan.size)) {
          throw new Error('lp-selfhit-scanner did not cover the core');
        }
      },
    };
  },
};

// The first probe whose cells are all outside the warrior: where it is, and how
// many steps after entry its last bomb has landed.
function firstFreeProbe(api) {
  const { P, core, norm } = api, plan = selfhitPlan(P, core), look = api.at('look');
  for (let k = 1; k < P.PROBES; k++) {
    const a = norm(look + plan.first + k * P.STEP), cells = [norm(a - 1), a, norm(a + 1)];
    if (plan.pair) cells.push(norm(a + P.GAP - 1), norm(a + P.GAP), norm(a + P.GAP + 1));
    const near = (c, start, size) => api.rel(c, start) < size + 70 || api.rel(start, c) < 70;
    if (cells.some((c) => api.inImage(c) || near(c, api.image.start, api.total) || near(c, api.self.start, plan.size)
      || (plan.sector && Array.from({ length: plan.copies }, (_, k) => api.norm(api.self.start + k * plan.sector)).some((o) => near(c, o, plan.size))))) continue;
    return { cell: a, steps: (k - 1) * (plan.pair ? 3 : 2) + (plan.guard ? 2 * k + 1 : 0) + 2 + plan.names.filter((n) => /^s\d$/.test(n)).length };
  }
  return null;
}
