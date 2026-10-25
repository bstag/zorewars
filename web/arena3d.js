// A live 3D view of a torus battlefield: every cell drawn at its (x, y, z)
// with perspective, coloured like the 2D grid (owner, and a glow for recent
// writes), running processes in white. Drag to rotate, wheel or pinch to
// zoom, and it spins on its own until you grab it. Same interface as the 2D
// CoreRenderer (layout, draw, addressAt, hover, pinned), so the arena can
// swap between them. Plain canvas: no WebGL or libraries needed.

import { OP } from '../src/engine/index.js';
import { makePalettes, GLOW } from './arena.js';

const BACKGROUND = '#050812';
const EMPTY_DOT = 'rgba(120, 140, 190, 0.16)';
const EDGE = 'rgba(120, 140, 190, 0.35)';

export class CoreView3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palettes = makePalettes();
    this.hover = -1;
    this.pinned = -1;
    this.yaw = -0.6;
    this.pitch = 0.45;
    this.zoom = 1;
    this.spin = true;          // turns on its own until grabbed
    this.active = false;
    this.dragMoved = false;
    this.pointers = new Map();
    this.attach();
  }

  // Rotating and zooming. Clicks that end a drag are not "clicks" for the
  // arena (see consumeDrag), so pinning a cell still works with a tap.
  attach() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragMoved = false;
      this.startPinch = null;
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.active || !this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {                 // pinch to zoom
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.startPinch) this.setZoom(this.zoom * (d / this.startPinch));
        this.startPinch = d;
        this.dragMoved = true;
        return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        if (Math.abs(dx) + Math.abs(dy) > 2) this.dragMoved = true;
        this.spin = false;
        this.yaw += dx * 0.01;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * 0.01));
        this.changed = true;
      }
    });
    const up = (e) => { this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.startPinch = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }
  setZoom(z) { this.zoom = Math.max(0.5, Math.min(4, z)); this.changed = true; }
  // True once after a drag, so the click that ends it doesn't pin a cell.
  consumeDrag() { const d = this.dragMoved; this.dragMoved = false; return d; }
  // While spinning (or just moved by hand) the view needs redrawing every frame.
  get animating() { return this.active && (this.spin || this.changed); }

  layout(coreSize, geo) {
    this.coreSize = coreSize;
    this.geo = geo;
    const width = this.canvas.parentElement.clientWidth || 800;
    const height = Math.round(width * 0.8);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.aspectRatio = `${width} / ${height}`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = width;
    this.h = height;
    // Each cell's position, centred and scaled so the largest side is 1.
    const [X, Y, Z] = geo ? [geo.X, geo.Y, geo.Z] : [coreSize, 1, 1];
    const s = 1 / Math.max(X, Y, Z);
    this.dims = [X * s, Y * s, Z * s];
    this.cellSize = s;
    this.pos = new Float32Array(coreSize * 3);
    for (let i = 0; i < coreSize; i++) {
      const [x, y, z] = geo ? geo.position(i) : [i, 0, 0];
      this.pos[i * 3] = (x - (X - 1) / 2) * s;
      this.pos[i * 3 + 1] = (y - (Y - 1) / 2) * s;
      this.pos[i * 3 + 2] = (z - (Z - 1) / 2) * s;
    }
    this.sx = new Float32Array(coreSize);
    this.sy = new Float32Array(coreSize);
    this.depth = new Float32Array(coreSize);
    this.scale = new Float32Array(coreSize);
  }

  // Rotate, then perspective-project every cell. Screen y grows downwards,
  // which matches y growing downwards in the 2D grid.
  project() {
    const cy = Math.cos(this.yaw), syaw = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dist = 2.4;
    const f = Math.min(this.w, this.h) * 1.9 * this.zoom;
    const ox = this.w / 2, oy = this.h / 2;
    const P = this.pos, n = this.coreSize;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const x1 = x * cy + z * syaw, z1 = -x * syaw + z * cy;     // yaw: around the vertical axis
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;        // pitch: tilt towards the viewer
      const k = f / (dist - z2);
      this.sx[i] = ox + x1 * k;
      this.sy[i] = oy + y2 * k;
      this.depth[i] = z2;
      this.scale[i] = k;
    }
    return { cy, syaw, cp, sp, dist, f, ox, oy };
  }

  draw(vm, fadeSteps) {
    if (vm.size !== this.coreSize || vm.geo !== this.geo) this.layout(vm.size, vm.geo);
    if (this.spin && !this.pointers.size) this.yaw += 0.006;
    this.changed = false;
    const { ctx } = this;
    const cam = this.project();
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawBox(cam);

    const n = this.coreSize;
    const { owner, lastWrite, lastExec, op, a, b } = vm;
    const now = vm.steps;
    // Empty space: a faint dot per cell, so the volume is visible.
    ctx.fillStyle = EMPTY_DOT;
    const drawn = [];
    for (let i = 0; i < n; i++) {
      const empty = owner[i] < 0 && op[i] === OP.DAT && a[i] === 0 && b[i] === 0;
      if (empty && now - lastExec[i] > fadeSteps) {
        const r = Math.max(0.6, this.cellSize * this.scale[i] * 0.12);
        ctx.fillRect(this.sx[i] - r / 2, this.sy[i] - r / 2, r, r);
      } else drawn.push(i);
    }
    // Everything else, far to near.
    drawn.sort((p, q) => this.depth[p] - this.depth[q]);
    this.drawnCells = drawn;
    for (const i of drawn) {
      const size = Math.max(1.2, this.cellSize * this.scale[i] * 0.78);
      const w = owner[i];
      const x = this.sx[i] - size / 2, y = this.sy[i] - size / 2;
      if (w < 0) {
        ctx.fillStyle = '#334155';
      } else {
        const age = now - lastWrite[i];
        const level = age < fadeSteps ? Math.round(GLOW * (1 - age / fadeSteps)) : 0;
        ctx.fillStyle = this.palettes[w % this.palettes.length][level];
      }
      if (op[i] === OP.DAT) {
        // Data and bombs as smaller dots, so code stands out as solid blocks.
        const d = size * 0.45;
        ctx.fillRect(this.sx[i] - d / 2, this.sy[i] - d / 2, d, d);
      } else ctx.fillRect(x, y, size, size);
      const ex = now - lastExec[i];
      if (ex < fadeSteps * 0.5) {
        ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - ex / (fadeSteps * 0.5))})`;
        ctx.fillRect(x, y, size, size);
      }
    }
    // Running processes: small bright points, so the warriors' colours show.
    ctx.fillStyle = '#ffffff';
    for (const war of vm.warriors) {
      if (!war.alive) continue;
      let count = 0;
      for (const pc of war.queue) {
        const size = Math.max(1.5, this.cellSize * this.scale[pc] * 0.35);
        ctx.fillRect(this.sx[pc] - size / 2, this.sy[pc] - size / 2, size, size);
        if (++count > 2000) break;
      }
    }
    for (const [addr, color] of [[this.hover, 'rgba(255,255,255,0.85)'], [this.pinned, '#fbbf24']]) {
      if (addr < 0 || addr >= n) continue;
      const size = Math.max(5, this.cellSize * this.scale[addr] * 1.4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.sx[addr] - size / 2, this.sy[addr] - size / 2, size, size);
    }
  }

  // The battlefield's bounding box and its axes, for orientation.
  drawBox(cam) {
    const [dx, dy, dz] = this.dims.map((d) => d / 2);
    const corner = (sx, sy, sz) => {
      const x = sx * dx, y = sy * dy, z = sz * dz;
      const x1 = x * cam.cy + z * cam.syaw, z1 = -x * cam.syaw + z * cam.cy;
      const y2 = y * cam.cp - z1 * cam.sp, z2 = y * cam.sp + z1 * cam.cp;
      const k = cam.f / (cam.dist - z2);
      return [cam.ox + x1 * k, cam.oy + y2 * k];
    };
    const ctx = this.ctx;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of [
      [[-1, -1, -1], [1, -1, -1]], [[-1, 1, -1], [1, 1, -1]], [[-1, -1, 1], [1, -1, 1]], [[-1, 1, 1], [1, 1, 1]],
      [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]], [[-1, -1, 1], [-1, 1, 1]], [[1, -1, 1], [1, 1, 1]],
      [[-1, -1, -1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]], [[-1, 1, -1], [-1, 1, 1]], [[1, 1, -1], [1, 1, 1]],
    ]) {
      const p = corner(...a), q = corner(...b);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    // Axis labels at the ends of the three edges from the origin corner.
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(160, 175, 210, 0.75)';
    for (const [label, at] of [['x', [1.12, -1, -1]], ['y', [-1, 1.12, -1]], ['z', [-1, -1, 1.12]]]) {
      const [px, py] = corner(...at);
      ctx.fillText(label, px - 3, py + 4);
    }
  }

  // The cell under the pointer: the nearest drawn cell within reach, or any
  // cell if nothing is drawn there, preferring cells nearer the viewer.
  addressAt(clientX, clientY) {
    if (!this.drawnCells) return -1;
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * this.w, y = ((clientY - r.top) / r.height) * this.h;
    const pick = (cells, reach) => {
      let best = -1, bestScore = Infinity;
      for (const i of cells) {
        const d = Math.hypot(this.sx[i] - x, this.sy[i] - y);
        const limit = Math.max(reach, this.cellSize * this.scale[i] * 0.6);
        if (d > limit) continue;
        const score = d - this.depth[i] * 4;          // nearer the viewer wins ties
        if (score < bestScore) { bestScore = score; best = i; }
      }
      return best;
    };
    const hit = pick(this.drawnCells, 6);
    if (hit >= 0) return hit;
    return pick(Array.from({ length: this.coreSize }, (_, i) => i), 4);
  }
}
