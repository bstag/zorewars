// Score-box P-space selector: every member has an accumulated score, the
// member played last round is credited with its result, and the member with
// the best score plays next. A sentinel cell resets everything on the first
// round and after a brainwash. Cells from CELL: last member, sentinel, one
// score per member, then the draw streak when STREAK is set.

export const switchScore = {
  kids: [2, 6],
  params: {
    CELL: [1, 3400], FIRST: [0, 5], WIN: [-9, 9], TIE: [-9, 9], LOSS: [-9, 9],
    HOLD: [0, 50], STREAK: [0, 20], SENT: [1, 4000], SEAL: [0, 1],
    TRACK: [0, 3400], TMEMBER: [0, 5], TMISS: [1, 9], TPROBE: [0, 2], TLOSS: [-10, 9], TTIE: [0, 1],
  },
  defaults: { CELL: 20, FIRST: 0, WIN: 1, TIE: 0, LOSS: -1, HOLD: 0, STREAK: 0, SENT: 1931, SEAL: 0, TRACK: 0, TMEMBER: 0, TMISS: 2, TPROBE: 2, TLOSS: -10, TTIE: 0 },
  purpose: 'Chooses a member by accumulated P-space scores. Each round the member played last round gets WIN, TIE or LOSS added to its score, then the member with the best score plays; the one just played keeps its place unless another beats its score plus HOLD (HOLD k-1 with LOSS -1 and WIN 0 is "move on after k losses"). STREAK s counts ties in a row and scores the s-th as a loss. A sentinel cell (SENT) that reads wrong, as on the first round or after a brainwash, resets every score and plays FIRST.',
  testedProfiles: ['94x-hill', 'lp-hill', 'pspace'],
  knowledge: {
    parameterRoles: {
      CELL: 'First private P-space cell: last member, then the sentinel, then one score per member, then the tie streak',
      FIRST: 'Member played after a reset (first round, or a sentinel that reads wrong)',
      WIN: 'Added to the last member\'s score after a win', TIE: 'Added after a tie', LOSS: 'Added after a loss',
      HOLD: 'Bonus the last member keeps when scores are compared; another member must beat score + HOLD',
      STREAK: '0 off; s scores the s-th tie in a row as a loss (an answer to imps that tie for ever)',
      SENT: 'Sentinel value; a reset writes it, a mismatch triggers a reset',
      TRACK: '0 off; otherwise the first of three cells that follow a two-armed opponent that keeps its arm after a win and switches otherwise: its arm (0 in the first round, whichever that is), a phase bit and a miss count; a switch-table with TRACK reads the first two. A reset leaves them alone: fresh P-space holds zeros',
      TMEMBER: 'With TRACK, the member that plays the prediction; its losses count as misses',
      TMISS: 'With TRACK, the phase bit flips after this many misses in a row by TMEMBER',
      TTIE: 'With TRACK and a TPROBE of 0 or 1, 1 flips the phase at once on a probe tie (a tie is the stronger sign that the probe met the arm it never beats)',
      TLOSS: 'With TRACK, -10 off; otherwise added instead of LOSS when TMEMBER loses, so the predictor can be kept longer than the other members',
      TPROBE: 'With TRACK, 2 counts every loss by TMEMBER as a miss; 0 or 1 counts only its rounds where (arm + phase) mod 2 was TPROBE, and there anything but a win is a miss (for a payload that never beats the other arm)',
      SEAL: '1 overwrites every STP with a DAT once the choice is stored, so a stray process that re-enters the selector mid-round (thrown there by an SPL carpet, say) dies instead of rewriting the scores',
    },
    invariants: [
      'P-space cell 0 is the prior result: 0 loss, 1 win, anything else a tie.',
      'Scores are stored as core/2 plus the score, so unsigned comparisons order them for up to core/2 rounds of drift.',
      'The gate checks a reset, a broken sentinel, every result for every last member, an out-of-range last member and, with STREAK, both sides of the streak limit, against scoreChoice.',
    ],
    failures: ['No shared payload: an arm used in two deployments is two members with two copies of its code.'],
    evidence: ['docs/hill-top30/94x.md', 'docs/hill-top30/block-gaps.md'],
  },
};

const norm = (x, core) => ((x % core) + core) % core;
export const scoreBias = (core) => Math.floor(core / 2);
export const scoreCells = (P, n) => ({ last: P.CELL, sentinel: P.CELL + 1, box: (i) => P.CELL + 2 + i, streak: P.CELL + 2 + n, top: Math.max(P.CELL + 1 + n + (P.STREAK ? 1 : 0), P.TRACK ? P.TRACK + 2 : 0) });
export const trackCells = (P) => ({ arm: P.TRACK, phase: P.TRACK + 1, miss: P.TRACK + 2 });

// What the emitted code picks and writes, from the P-space it starts with.
export function scoreChoice(P, n, pspace, core) {
  const cells = scoreCells(P, n), writes = new Map();
  const get = (i) => (writes.has(i) ? writes.get(i) : pspace[i] ?? 0);
  const put = (i, v) => writes.set(i, norm(v, core));
  let pick;
  if (get(cells.sentinel) !== P.SENT) {
    put(cells.sentinel, P.SENT);
    for (let i = 0; i < n; i++) put(cells.box(i), scoreBias(core));
    if (P.STREAK) put(cells.streak, 0);
    pick = P.FIRST;
  } else {
    const result = pspace[0], last = get(cells.last) % n;
    const lossFor = (m) => (P.TRACK && P.TLOSS > -10 && m === P.TMEMBER ? P.TLOSS : P.LOSS);
    if (P.TRACK) {
      // The opponent keeps its arm after its win (our loss) and switches otherwise.
      const t = trackCells(P);
      let arm = get(t.arm), phase = get(t.phase), miss = get(t.miss);
      const probed = P.TPROBE === 2 || (norm(arm, core) + norm(phase, core)) % 2 === P.TPROBE;
      const hit = P.TPROBE === 2 ? result !== 0 : result === 1;
      if (result !== 0) arm += 1;
      if (last === P.TMEMBER && probed) {
        if (hit) miss = 0;
        else if (P.TTIE && P.TPROBE < 2 && result !== 0) { phase += 1; miss = 0; }
        else if (P.TMISS - 1 < norm(miss + 1, core)) { phase += 1; miss = 0; } else miss += 1;
      }
      put(t.arm, norm(arm, core) % 2); put(t.phase, norm(phase, core) % 2); put(t.miss, miss);
    }
    let delta;
    if (result === 0 || result === 1) {
      delta = result ? P.WIN : lossFor(last);
      if (P.STREAK) put(cells.streak, 0);
    } else if (P.STREAK) {
      const s = norm(get(cells.streak) + 1, core);
      if (P.STREAK - 1 < s) { delta = lossFor(last); put(cells.streak, 0); } else { delta = P.TIE; put(cells.streak, s); }
    } else delta = P.TIE;
    const score = norm(get(cells.box(last)) + delta, core);
    put(cells.box(last), score);
    let best = norm(score + P.HOLD, core);
    pick = last;
    for (let i = 0; i < n; i++) { const c = get(cells.box(i)); if (best < c) { pick = i; best = c; } }
  }
  put(cells.last, pick);
  return { branch: pick, writes: [...writes] };
}

// Histories that reach every path of the emitted code.
export function scoreScenarios(P, n, core, fresh) {
  const cells = scoreCells(P, n), bias = scoreBias(core), out = [];
  const make = (name, result, last, boxes, streak, sentinel = P.SENT) => {
    const p = fresh(); p[0] = norm(result, core);
    if (sentinel !== null) p[cells.sentinel] = sentinel;
    if (last !== null) p[cells.last] = last;
    boxes?.forEach((b, i) => { p[cells.box(i)] = norm(bias + b, core); });
    if (P.STREAK && streak !== undefined) p[cells.streak] = streak;
    out.push({ name: `switch-score: ${name}`, pspace: p, ...scoreChoice(P, n, p, core) });
  };
  const flat = Array(n).fill(0), lead = Array.from({ length: n }, (_, i) => (i === 0 ? 5 : 0));
  make('first round', -1, null, null, undefined, null);
  make('broken sentinel', 1, 1, flat, 0, P.SENT + 1);
  for (const [result, label] of [[0, 'loss'], [1, 'win'], [2, 'tie']]) make(`${label} on member 0`, result, 0, flat, 0);
  make(`loss on member ${n - 1}`, 0, n - 1, flat, 0);
  make('win on member 1 behind a leader', 1, 1, lead, 0);
  make('out-of-range last member', 2, n + 2, lead, 0);
  make('several survivors', 3, 0, flat, 0);
  if (P.TRACK) {
    const t = trackCells(P);
    const tracked = (name, result, last, arm, phase, miss) => {
      const p = fresh(); p[0] = norm(result, core); p[cells.sentinel] = P.SENT; p[cells.last] = last;
      flat.forEach((b, i) => { p[cells.box(i)] = bias + b; });
      p[t.arm] = arm; p[t.phase] = phase; p[t.miss] = miss;
      out.push({ name: `switch-score: ${name}`, pspace: p, ...scoreChoice(P, n, p, core) });
    };
    const other = (P.TMEMBER + 1) % n;
    tracked('tracked loss on another member', 0, other, 1, 0, 0);
    tracked('tracked loss on the predictor', 0, P.TMEMBER, 0, 1, 0);
    tracked('tracked win on another member', 1, other, 0, 1, 1);
    tracked('tracked tie on the predictor', 2, P.TMEMBER, 1, 1, 1);
    tracked('tracked miss below the limit', 0, P.TMEMBER, 0, 0, Math.max(0, P.TMISS - 2));
    tracked('tracked miss at the limit', 0, P.TMEMBER, 1, 0, P.TMISS - 1);
    if (P.TPROBE < 2) {
      tracked('tracked tie on a probe', 2, P.TMEMBER, P.TPROBE, 0, P.TMISS - 1);
      tracked('tracked win on a probe', 1, P.TMEMBER, 0, P.TPROBE, 1);
      tracked('tracked loss off the probe', 0, P.TMEMBER, 1 - P.TPROBE, 0, P.TMISS - 1);
    }
  }
  if (P.STREAK) {
    make('tie that reaches the streak', 2, 0, flat, P.STREAK - 1);
    make('tie below the streak', 2, 1, flat, 0);
  }
  return out;
}

export function emitSwitchScore(ctx, entries) {
  const { L, P } = ctx, n = entries.length, cells = scoreCells(P, n), bias = scoreBias(ctx.core);
  const [tmp, res, last, ptr, sc, cand, pick, stk] = ['tmp', 'res', 'last', 'ptr', 'sc', 'cand', 'pick', 'stk'].map(L);
  ctx.ins('start', 'LDP', 'AB', `#${cells.sentinel}`, tmp);
  ctx.ins('', 'SEQ', 'AB', `#${P.SENT}`, tmp);
  ctx.ins('', 'JMP', 'B', L('reset'));
  ctx.ins('', 'LDP', 'AB', '#0', res);
  ctx.ins('', 'LDP', 'AB', `#${cells.last}`, last);
  ctx.ins('', 'MOD', 'AB', `#${n}`, last);
  ctx.ins('', 'MOV', 'B', last, ptr);
  ctx.ins('', 'ADD', 'AB', `#${cells.box(0)}`, ptr);
  ctx.ins('', 'LDP', 'B', ptr, sc);                       // sc = the last member's score
  if (P.TRACK) emitTracker(ctx, res, last);
  ctx.ins('', 'JMZ', 'B', L('loss'), res);
  ctx.ins('', 'DJN', 'B', L('tie'), res);                 // 1 becomes 0: a win falls through
  ctx.ins('', 'ADD', 'AB', `#${P.WIN}`, sc);
  ctx.ins('', 'JMP', 'B', L(P.STREAK ? 'clear' : 'store'));
  if (P.STREAK) {
    ctx.ins('tie', 'LDP', 'AB', `#${cells.streak}`, stk);
    ctx.ins('', 'ADD', 'AB', '#1', stk);
    ctx.ins('', 'SLT', 'AB', `#${P.STREAK - 1}`, stk);     // the streak reached: score it as a loss
    ctx.ins('', 'JMP', 'B', L('tieok'));
    ctx.ins('', 'JMP', 'B', L('loss'));
    ctx.ins('tieok', 'STP', 'B', stk, `#${cells.streak}`);
    ctx.ins('', 'ADD', 'AB', `#${P.TIE}`, sc);
  } else ctx.ins('tie', 'ADD', 'AB', `#${P.TIE}`, sc);
  ctx.ins('', 'JMP', 'B', L('store'));
  if (P.TRACK && P.TLOSS > -10) {
    ctx.ins('loss', 'SNE', 'AB', `#${P.TMEMBER}`, last);
    ctx.ins('', 'ADD', 'AB', `#${P.TLOSS - P.LOSS}`, sc);  // the predictor loses TLOSS instead
    ctx.ins('', 'ADD', 'AB', `#${P.LOSS}`, sc);
  } else ctx.ins('loss', 'ADD', 'AB', `#${P.LOSS}`, sc);
  if (P.STREAK) ctx.ins('clear', 'STP', 'AB', '#0', `#${cells.streak}`);
  ctx.ins('store', 'STP', 'B', sc, ptr);
  ctx.ins('', 'ADD', 'AB', `#${P.HOLD}`, sc);             // the last member keeps HOLD in hand
  ctx.ins('', 'MOV', 'B', last, pick);
  for (let i = 0; i < n; i++) {
    ctx.ins('', 'LDP', 'AB', `#${cells.box(i)}`, cand);
    ctx.ins('', 'SLT', 'B', sc, cand);                     // only a strictly better score takes over
    ctx.ins('', 'JMP', 'B', L(i + 1 < n ? `next${i}` : 'finish'));
    ctx.ins('', 'MOV', 'AB', `#${i}`, pick);
    ctx.ins('', 'MOV', 'B', cand, sc);
    if (i + 1 < n) ctx.mark(`next${i}`);
  }
  ctx.ins('finish', 'STP', 'B', pick, `#${cells.last}`);
  if (P.TRACK) for (const w of ['ts0', 'ts1', 'ts2']) ctx.ins('', 'MOV', 'I', L('tnop'), L(w));
  if (P.SEAL) {
    const writers = [...(P.STREAK ? ['tieok', 'clear'] : []), 'store', 'reset', ...Array.from({ length: n + (P.STREAK ? 1 : 0) }, (_, i) => `rs${i}`), 'finish'];
    for (const w of writers) ctx.ins('', 'MOV', 'I', tmp, L(w));
  }
  ctx.ins('', 'ADD', 'AB', `#${L('table')}-${pick}`, pick);
  ctx.ins('', 'JMP', 'B', `@${pick}`);
  ctx.ins('reset', 'STP', 'AB', `#${P.SENT}`, `#${cells.sentinel}`);
  for (let i = 0; i < n; i++) ctx.ins(P.SEAL ? `rs${i}` : '', 'STP', 'AB', `#${bias}`, `#${cells.box(i)}`);
  if (P.STREAK) ctx.ins(P.SEAL ? `rs${n}` : '', 'STP', 'AB', '#0', `#${cells.streak}`);
  ctx.ins('', 'MOV', 'AB', `#${P.FIRST}`, pick);
  ctx.ins('', 'JMP', 'B', L('finish'));
  for (const name of ['tmp', 'res', 'last', 'ptr', 'sc', 'cand', 'pick', ...(P.STREAK ? ['stk'] : []), ...(P.TRACK ? ['tarm', 'tph', 'tmiss', ...(P.TPROBE < 2 ? ['tplay'] : [])] : [])]) ctx.ins(name, 'DAT', 'F', '#0', '#0');
  if (P.TRACK) ctx.ins('tnop', 'NOP', 'F', '#0', '#0');   // a stray that re-enters passes the stores
  entries.forEach((entry, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entry));
}

// Follows a two-armed opponent that keeps its arm after a win and switches otherwise. Its
// stores become NOPs once the choice is made, so a stray process cannot flip the arm twice
// but still reaches the dispatch.
function emitTracker(ctx, res, last) {
  const { L, P } = ctx, t = trackCells(P);
  const [arm, ph, miss] = ['tarm', 'tph', 'tmiss'].map(L);
  ctx.ins('', 'LDP', 'AB', `#${t.arm}`, arm);
  ctx.ins('', 'LDP', 'AB', `#${t.phase}`, ph);
  ctx.ins('', 'LDP', 'AB', `#${t.miss}`, miss);
  const probe = P.TPROBE < 2, play = L('tplay');
  if (probe) {                                            // the payload played last round
    ctx.ins('', 'MOV', 'B', arm, play);
    ctx.ins('', 'ADD', 'B', ph, play);
    ctx.ins('', 'MOD', 'AB', '#2', play);
  }
  ctx.ins('', 'JMZ', 'B', L('tlost'), res);
  ctx.ins('', 'ADD', 'AB', '#1', arm);                    // we did not lose: they switch
  ctx.ins('', 'SEQ', 'AB', `#${P.TMEMBER}`, last);
  ctx.ins('', 'JMP', 'B', L('tstore'));
  if (probe) {
    ctx.ins('', 'SEQ', 'AB', `#${P.TPROBE}`, play);
    ctx.ins('', 'JMP', 'B', L('tstore'));
    ctx.ins('', 'SEQ', 'AB', '#1', res);                  // a probe's tie is a miss too
    ctx.ins('', 'JMP', 'B', L(P.TTIE ? 'tflip' : 'tmissed'));
  }
  ctx.ins('', 'MOV', 'AB', '#0', miss);                   // the prediction held
  ctx.ins('', 'JMP', 'B', L('tstore'));
  ctx.ins('tlost', 'SEQ', 'AB', `#${P.TMEMBER}`, last);
  ctx.ins('', 'JMP', 'B', L('tstore'));
  if (probe) {
    ctx.ins('', 'SEQ', 'AB', `#${P.TPROBE}`, play);
    ctx.ins('', 'JMP', 'B', L('tstore'));
  }
  ctx.ins('tmissed', 'ADD', 'AB', '#1', miss);
  ctx.ins('', 'SLT', 'AB', `#${P.TMISS - 1}`, miss);     // TMISS losses in a row: flip the phase
  ctx.ins('', 'JMP', 'B', L('tstore'));
  ctx.ins('tflip', 'ADD', 'AB', '#1', ph);
  ctx.ins('', 'MOV', 'AB', '#0', miss);
  ctx.ins('tstore', 'MOD', 'AB', '#2', arm);
  ctx.ins('', 'MOD', 'AB', '#2', ph);
  ctx.ins('ts0', 'STP', 'B', arm, `#${t.arm}`);
  ctx.ins('ts1', 'STP', 'B', ph, `#${t.phase}`);
  ctx.ins('ts2', 'STP', 'B', miss, `#${t.miss}`);
}
