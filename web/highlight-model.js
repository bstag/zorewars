// Wall-clock battle effects and heat, independent of Canvas and projection.
// Flat VM packets remain flat while choosing effects; only displayed events
// allocate effect objects. Cooldowns come from visible effects, not history.
const OVERRIDE_MS = 650;
const KILL_MS = 900;
const MAX_EFFECTS = 140;
const PER_FRAME = 24;

function decayHeat(heat, dt) {
  if (dt <= 0) return;
  const factor = Math.pow(0.5, dt / 1500);
  for (let i = 0; i < heat.length; i++) heat[i] = heat[i] > 0.01 ? heat[i] * factor : 0;
}

// Count every valid event as heat, but offer each cell only once for display.
// A cell's first kill supersedes its write event; repeated kills keep their
// original attacker. Incomplete/stale packets must not create invalid effects.
function candidateOffsets(events, heat) {
  const cells = new Map();
  if (!events || !heat.length) return [];
  for (let k = 0; k + 3 < events.length; k += 4) {
    const cell = events[k], attacker = events[k + 1], kind = events[k + 3];
    if (!Number.isInteger(cell) || cell < 0 || cell >= heat.length || !Number.isInteger(attacker) || attacker < 0 || (kind !== 0 && kind !== 1)) continue;
    heat[cell] += kind === 1 ? 6 : 1;
    const previous = cells.get(cell);
    if (previous === undefined || events[previous + 3] < kind) cells.set(cell, k);
  }
  return [...cells.values()];
}

function canAnimate(kind, current, now) {
  if (!current) return true;
  if (current.kind === 1 && kind === 0) return false;
  if (current.kind === 0 && kind === 1) return true;
  return now >= current.t0 + current.ms * 0.6;
}

function pickOffsets(offsets, events) {
  const kills = offsets.filter(k => events[k + 3] === 1), overrides = offsets.filter(k => events[k + 3] === 0);
  const picked = kills.slice(0, PER_FRAME), room = PER_FRAME - picked.length;
  if (room > 0 && overrides.length) {
    const stride = Math.max(1, overrides.length / room);
    for (let j = 0; j < overrides.length && picked.length < PER_FRAME; j += stride) picked.push(overrides[Math.floor(j)]);
  }
  return picked;
}

export class HighlightModel {
  constructor() { this.reset(0); }

  reset(coreSize) {
    this.size = coreSize;
    this.effects = [];
    this.heat = new Float32Array(coreSize);
    this.lastDecay = null;
  }

  get active() { return this.effects.length > 0; }

  ingest(events, now) {
    decayHeat(this.heat, this.lastDecay === null ? 0 : now - this.lastDecay);
    this.lastDecay = now;
    this.effects = this.effects.filter(e => now - e.t0 < e.ms);
    const active = new Map(this.effects.map(e => [e.cell, e]));
    const candidates = candidateOffsets(events, this.heat).filter(k => canAnimate(events[k + 3], active.get(events[k]), now));
    const picked = pickOffsets(candidates, events), selected = new Set(picked.map(k => events[k]));
    this.effects = this.effects.filter(e => !selected.has(e.cell));
    for (const k of picked) {
      const kind = events[k + 3];
      this.effects.push({ cell: events[k], attacker: events[k + 1], kind, t0: now, ms: kind === 1 ? KILL_MS : OVERRIDE_MS });
    }
    if (this.effects.length > MAX_EFFECTS) this.effects.splice(0, this.effects.length - MAX_EFFECTS);
  }

  hottest(threshold = 2) {
    let best = -1, bestHeat = threshold;
    for (let i = 0; i < this.heat.length; i++) if (this.heat[i] > bestHeat) { bestHeat = this.heat[i]; best = i; }
    return best;
  }
}
