// Battle highlights: turns the VM's events (overrides and kills, see
// VM.enableEvents) into short-lived on-screen effects, and keeps a fading
// "heat" per cell so the 3D view can find where the fighting is.
//
// Effects run on wall-clock time, so they are visible at any speed. When a
// burst of thousands of events arrives in one frame, kills are kept first,
// overrides are sampled evenly, and a cell gets at most one effect at a time.

const OVERRIDE_MS = 650;
const KILL_MS = 900;
const MAX_EFFECTS = 140;
const PER_FRAME = 24;

export class Highlights {
  constructor() { this.reset(0); }

  reset(coreSize) {
    this.size = coreSize;
    this.effects = [];                  // { cell, attacker, kind, t0, ms }
    this.heat = new Float32Array(coreSize);
    this.busy = new Map();              // cell -> time its effect ends
    this.lastDecay = 0;
  }

  get active() { return this.effects.length > 0; }

  ingest(events, now) {
    // Heat fades with time (half-life about 1.5 s), whether or not more arrives.
    const dt = this.lastDecay ? now - this.lastDecay : 0;
    this.lastDecay = now;
    if (dt > 0) {
      const f = Math.pow(0.5, dt / 1500);
      const h = this.heat;
      for (let i = 0; i < h.length; i++) if (h[i] > 0.01) h[i] *= f; else h[i] = 0;
    }
    if (events && events.length && this.size) {
      const kills = [], overrides = [];
      for (let k = 0; k < events.length; k += 4) {
        const cell = events[k], attacker = events[k + 1], kind = events[k + 3];
        if (cell >= this.size) continue;
        this.heat[cell] += kind === 1 ? 6 : 1;
        (kind === 1 ? kills : overrides).push(k);
      }
      const picked = kills.slice(0, PER_FRAME);
      const room = PER_FRAME - picked.length;
      if (room > 0 && overrides.length) {
        const stride = Math.max(1, overrides.length / room);
        for (let j = 0; j < overrides.length && picked.length < PER_FRAME; j += stride) picked.push(overrides[Math.floor(j)]);
      }
      for (const k of picked) {
        const cell = events[k], kind = events[k + 3];
        if ((this.busy.get(cell) ?? 0) > now) continue;
        const ms = kind === 1 ? KILL_MS : OVERRIDE_MS;
        this.busy.set(cell, now + ms * 0.6);
        this.effects.push({ cell, attacker: events[k + 1], kind, t0: now, ms });
      }
      if (this.effects.length > MAX_EFFECTS) this.effects.splice(0, this.effects.length - MAX_EFFECTS);
    }
    this.effects = this.effects.filter((e) => now - e.t0 < e.ms);
    if (this.busy.size > 2000) for (const [c, t] of this.busy) if (t <= now) this.busy.delete(c);
  }

  // The hottest cell right now, if anything is happening (-1 otherwise).
  hottest(threshold = 2) {
    let best = -1, bestHeat = threshold;
    const h = this.heat;
    for (let i = 0; i < h.length; i++) if (h[i] > bestHeat) { bestHeat = h[i]; best = i; }
    return best;
  }

  // Draw every effect with a projection: at(cell) -> [x, y, cellPixels] or null.
  draw(ctx, now, at, colors) {
    for (const e of this.effects) {
      const p = at(e.cell);
      if (!p) continue;
      const [x, y, px] = p;
      const t = Math.min(1, (now - e.t0) / e.ms);
      const fade = 1 - t;
      if (e.kind === 0) {
        // Override: a splash ring in the attacker's colour.
        ctx.globalAlpha = 0.9 * fade;
        ctx.strokeStyle = colors[e.attacker % colors.length] ?? '#ffffff';
        ctx.lineWidth = Math.max(1, 2 * fade + 0.5);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, px) * (0.8 + 4 * t), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Kill: a white flash and a burst of sparks.
        const r = Math.max(3, px) * (1 + 5 * t);
        ctx.globalAlpha = 0.55 * fade * fade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, px) * (1.2 + 1.5 * t), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = t < 0.4 ? '#ffffff' : '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + e.cell;            // a different burst per cell
          ctx.moveTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
