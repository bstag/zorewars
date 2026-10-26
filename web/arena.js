// Canvas renderer for the core and the process-count chart.

import { OP } from '../src/engine/index.js';

export const WARRIOR_COLORS = ['#22d3ee', '#f472b6', '#fbbf24', '#a3e635', '#a78bfa', '#fb923c'];
// Warriors are numbered by their place in the round, but each keeps the
// colour of its editor slot (a slot that doesn't compile sits the round out).
let colorSlots = [];
export function setColorSlots(roster) { colorSlots = roster.slice(); }
export const colorIndex = (w) => colorSlots[w] ?? w;
export const warriorColors = () => WARRIOR_COLORS.map((_, w) => WARRIOR_COLORS[colorIndex(w) % WARRIOR_COLORS.length]);
const EMPTY = '#111a30';
const UNOWNED = '#334155';
const GLOW_LEVELS = 12;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// palettes[w][level]: each warrior's colour from dim (settled) to bright
// (just written). Shared by the 2D grid and the 3D view.
export const GLOW = GLOW_LEVELS;
export function makePalettes() {
  const empty = hexToRgb(EMPTY);
  return WARRIOR_COLORS.map((hex) => {
    const c = hexToRgb(hex);
    const dim = mix(empty, c, 0.42);
    return Array.from({ length: GLOW_LEVELS + 1 }, (_, i) => rgb(mix(dim, mix(c, [255, 255, 255], 0.35), i / GLOW_LEVELS)));
  });
}

// Where each cell sits on a flat grid (shared by this view and the floor of
// the 3D Avatars view). On a ring the cells are simply wrapped into a 5:4
// grid; on a torus each cell is at its real (x, y), with the z-slices of a
// volume side by side. Returns { cols, rows, gridOf, cellAtGrid }: the grid
// index of each cell, and the cell at each grid index (-1: none).
export function gridLayout(coreSize, geo = null) {
  let perRow = 1;
  if (geo && geo.Z > 1) {
    let best = Infinity;
    for (let k = 1; k <= geo.Z; k++) {
      const ratio = (k * geo.X) / (Math.ceil(geo.Z / k) * geo.Y);
      if (Math.abs(Math.log(ratio / 1.25)) < best) { best = Math.abs(Math.log(ratio / 1.25)); perRow = k; }
    }
  }
  let cols, rows;
  if (geo) {
    cols = geo.X * perRow;
    rows = geo.Y * Math.ceil(geo.Z / perRow);
  } else {
    // Aim for a 5:4 grid, e.g. 100 x 80 for the standard 8000-cell core.
    cols = Math.max(10, Math.round(Math.sqrt(coreSize * 1.25)));
    rows = Math.ceil(coreSize / cols);
  }
  const gridOf = new Int32Array(coreSize);
  const cellAtGrid = new Int32Array(cols * rows).fill(-1);
  for (let i = 0; i < coreSize; i++) {
    let g = i;
    if (geo) {
      const [x, y, z] = geo.position(i);
      g = (Math.floor(z / perRow) * geo.Y + y) * cols + (z % perRow) * geo.X + x;
    }
    gridOf[i] = g;
    cellAtGrid[g] = i;
  }
  return { cols, rows, gridOf, cellAtGrid };
}

export class CoreRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.coreSize = 0;
    this.cols = 0;
    this.cell = 4;
    this.hover = -1;
    this.pinned = -1;
    this.palettes = makePalettes();
  }

  // `geo`: the VM's torus geometry, or null for the classic ring. On a ring
  // the cells are simply wrapped into a 5:4 grid; on a torus each cell is
  // drawn at its real (x, y), with the z-slices of a volume side by side.
  layout(coreSize, geo = null) {
    this.coreSize = coreSize;
    this.geo = geo;
    const width = this.canvas.parentElement.clientWidth || 800;
    Object.assign(this, gridLayout(coreSize, geo));
    this.cell = Math.max(2, Math.floor(width / this.cols));
    const dpr = window.devicePixelRatio || 1;
    const w = this.cols * this.cell;
    const h = this.rows * this.cell;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // The buffer is an exact multiple of the cell size; CSS scales it to fit.
    this.canvas.style.width = '100%';
    this.canvas.style.aspectRatio = `${w} / ${h}`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = w;
  }

  addressAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * this.cols);
    const y = Math.floor(((clientY - r.top) / r.height) * this.rows);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return -1;
    return this.cellAtGrid[y * this.cols + x] ?? -1;
  }

  draw(vm, fadeSteps, highlights = null) {
    const { ctx, cols, cell } = this;
    const n = vm.size;
    if (n !== this.coreSize || vm.geo !== this.geo) this.layout(n, vm.geo);
    const grid = this.gridOf;
    ctx.fillStyle = '#050812';
    ctx.fillRect(0, 0, this.cssWidth, this.rows * cell);

    const now = vm.steps;
    const gap = cell >= 5 ? 1 : 0;
    const inner = cell - gap;
    const dotInset = Math.max(1, Math.floor(cell * 0.3));
    const { owner, lastWrite, lastExec, op, a, b } = vm;

    for (let i = 0; i < n; i++) {
      const x = (grid[i] % cols) * cell;
      const y = Math.floor(grid[i] / cols) * cell;
      const w = owner[i];
      const isDat = op[i] === OP.DAT;
      if (w < 0) {
        // Untouched cell: empty DAT 0,0 or (rarely) foreign content.
        ctx.fillStyle = isDat && a[i] === 0 && b[i] === 0 ? EMPTY : UNOWNED;
        ctx.fillRect(x, y, inner, inner);
        continue;
      }
      const age = now - lastWrite[i];
      const level = age < fadeSteps ? Math.round(GLOW_LEVELS * (1 - age / fadeSteps)) : 0;
      const pal = this.palettes[colorIndex(w) % this.palettes.length];
      if (isDat) {
        // Data and bombs are drawn as dots so code stands out as solid blocks.
        ctx.fillStyle = EMPTY;
        ctx.fillRect(x, y, inner, inner);
        ctx.fillStyle = pal[level];
        ctx.fillRect(x + dotInset, y + dotInset, Math.max(1, inner - 2 * dotInset), Math.max(1, inner - 2 * dotInset));
      } else {
        ctx.fillStyle = pal[level];
        ctx.fillRect(x, y, inner, inner);
      }
      const ex = now - lastExec[i];
      if (ex < fadeSteps * 0.5) {
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - ex / (fadeSteps * 0.5))})`;
        ctx.fillRect(x, y, inner, inner);
      }
    }

    // Current program counters.
    ctx.fillStyle = '#ffffff';
    for (const war of vm.warriors) {
      if (!war.alive) continue;
      let count = 0;
      for (const pc of war.queue) {
        const x = (grid[pc] % cols) * cell;
        const y = Math.floor(grid[pc] / cols) * cell;
        ctx.fillRect(x, y, inner, inner);
        if (++count > 2000) break; // plenty to show a swarm
      }
    }

    // Battle highlights: splashes for overrides, sparks for kills (highlights.js).
    if (highlights) {
      highlights.draw(ctx, performance.now(), (c) => [(grid[c] % cols) * cell + inner / 2, Math.floor(grid[c] / cols) * cell + inner / 2, cell], warriorColors());
    }
    for (const [addr, color] of [[this.hover, 'rgba(255,255,255,0.8)'], [this.pinned, '#fbbf24']]) {
      if (addr < 0) continue;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect((grid[addr] % cols) * cell - 1, Math.floor(grid[addr] / cols) * cell - 1, cell + 1, cell + 1);
    }
  }
}

export class ProcessChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reset(1, 80000);
  }

  reset(warriors, maxCycles) {
    this.series = Array.from({ length: warriors }, () => []);
    this.cycles = [];
    this.maxCycles = maxCycles;
  }

  sample(cycle, counts) {
    if (this.cycles.length && this.cycles.at(-1) === cycle) return;
    this.cycles.push(cycle);
    counts.forEach((c, i) => this.series[i].push(c));
    if (this.cycles.length > 1200) {
      // halve resolution to keep memory flat
      this.cycles = this.cycles.filter((_, i) => i % 2 === 0);
      this.series = this.series.map((s) => s.filter((_, i) => i % 2 === 0));
    }
  }

  draw(maxProcesses) {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = 6;
    const yOf = (v) => h - pad - (Math.log2(v + 1) / Math.log2(maxProcesses + 1)) * (h - 2 * pad);
    const lastCycle = Math.max(100, this.cycles.at(-1) || 0);
    const xOf = (c) => pad + (c / lastCycle) * (w - 2 * pad);

    ctx.strokeStyle = '#18223b';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#3b4a6b';
    ctx.font = '10px JetBrains Mono, monospace';
    for (const v of [1, 10, 100, 1000]) {
      if (v > maxProcesses) break;
      const y = Math.round(yOf(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      ctx.fillText(String(v), w - pad - 28, y - 2);
    }

    this.series.forEach((s, i) => {
      if (!s.length) return;
      ctx.strokeStyle = WARRIOR_COLORS[colorIndex(i) % WARRIOR_COLORS.length];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      s.forEach((v, k) => {
        const x = xOf(this.cycles[k]);
        const y = yOf(v);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }
}
