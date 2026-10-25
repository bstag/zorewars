// A live 3D view of a torus battlefield: every cell drawn at its (x, y, z)
// with perspective, coloured like the 2D grid (owner, and a glow for recent
// writes), running processes as white points. Drag to rotate, wheel or pinch
// to zoom, and it spins on its own until you grab it.
//
// Also: slicing (show only a slab of layers along x, y or z), battle
// highlights (splashes for overrides, sparks for kills; see highlights.js),
// and an "Action" camera that flies to where the fighting is and follows it.
//
// Same interface as the 2D CoreRenderer (layout, draw, addressAt, hover,
// pinned), so the arena can swap between them. Plain canvas, no libraries.

import { OP } from '../src/engine/index.js';
import { makePalettes, GLOW, WARRIOR_COLORS } from './arena.js';

const BACKGROUND = '#050812';
const EMPTY_DOT = 'rgba(120, 140, 190, 0.16)';
const EDGE = 'rgba(120, 140, 190, 0.35)';
const ACTION_ZOOM = 2.6;

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
    this.targetZoom = 1;
    this.center = [0, 0, 0];         // the point the camera looks at (world units)
    this.targetCenter = [0, 0, 0];
    this.spin = true;                 // turns on its own until grabbed
    this.follow = false;              // the Action camera
    this.slice = { axis: -1, pos: 0, thick: 1 };   // axis -1: no slicing
    this.active = false;
    this.dragMoved = false;
    this.pointers = new Map();
    this.highlights = null;
    this.attach();
  }

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
        if (this.startPinch) this.zoomBy(d / this.startPinch, true);
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
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), true);
    }, { passive: false });
  }

  // ---- camera controls (also used by the arena's buttons) ----
  zoomBy(f, now = false) {
    this.targetZoom = Math.max(0.5, Math.min(6, this.targetZoom * f));
    if (now) this.zoom = this.targetZoom;
    this.changed = true;
  }
  fit() {                                             // the whole shape, centred
    this.follow = false;
    this.targetZoom = 1;
    this.targetCenter = [0, 0, 0];
    this.changed = true;
  }
  setFollow(on) {
    this.follow = on;
    if (!on) this.fit();
    this.changed = true;
  }
  setSlice(axis, pos, thick) {
    this.slice = { axis, pos, thick };
    this.changed = true;
  }
  sliceSize(axis) { return this.geo ? [this.geo.X, this.geo.Y, this.geo.Z][axis] : 1; }

  consumeDrag() { const d = this.dragMoved; this.dragMoved = false; return d; }
  get easing() {
    const c = this.center, t = this.targetCenter;
    return Math.abs(this.zoom - this.targetZoom) > 1e-3 || Math.abs(c[0] - t[0]) + Math.abs(c[1] - t[1]) + Math.abs(c[2] - t[2]) > 1e-4;
  }
  get animating() { return this.active && (this.spin || this.changed || this.follow || this.easing || !!this.highlights?.active); }

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
    const [X, Y, Z] = geo ? [geo.X, geo.Y, geo.Z] : [coreSize, 1, 1];
    const s = 1 / Math.max(X, Y, Z);
    this.dims = [X * s, Y * s, Z * s];
    this.cellSize = s;
    this.pos = new Float32Array(coreSize * 3);
    this.coord = new Int16Array(coreSize * 3);       // integer (x, y, z), for slicing
    for (let i = 0; i < coreSize; i++) {
      const [x, y, z] = geo ? geo.position(i) : [i, 0, 0];
      this.coord[i * 3] = x; this.coord[i * 3 + 1] = y; this.coord[i * 3 + 2] = z;
      this.pos[i * 3] = (x - (X - 1) / 2) * s;
      this.pos[i * 3 + 1] = (y - (Y - 1) / 2) * s;
      this.pos[i * 3 + 2] = (z - (Z - 1) / 2) * s;
    }
    this.sx = new Float32Array(coreSize);
    this.sy = new Float32Array(coreSize);
    this.depth = new Float32Array(coreSize);
    this.scale = new Float32Array(coreSize);
    this.keys = new Float64Array(coreSize);           // depth-sort keys (no per-frame allocation)
    this.drawnCount = 0;
    this.drawnCells = new Int32Array(coreSize);
  }

  inSlice(i) {
    const { axis, pos, thick } = this.slice;
    if (axis < 0) return true;
    const size = this.sliceSize(axis);
    const d = ((this.coord[i * 3 + axis] - pos) % size + size) % size;
    return d < thick;
  }

  // Rotate around the camera's centre, then perspective-project every cell.
  project() {
    const cy = Math.cos(this.yaw), syaw = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dist = 2.4;
    const f = Math.min(this.w, this.h) * 1.9 * this.zoom;
    const ox = this.w / 2, oy = this.h / 2;
    const P = this.pos, n = this.coreSize;
    const [c0, c1, c2] = this.center;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3] - c0, y = P[i * 3 + 1] - c1, z = P[i * 3 + 2] - c2;
      const x1 = x * cy + z * syaw, z1 = -x * syaw + z * cy;     // yaw: around the vertical axis
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;        // pitch: tilt towards the viewer
      const k = f / Math.max(0.05, dist - z2);
      this.sx[i] = ox + x1 * k;
      this.sy[i] = oy + y2 * k;
      this.depth[i] = z2;
      this.scale[i] = k;
    }
    return { cy, syaw, cp, sp, dist, f, ox, oy };
  }

  draw(vm, fadeSteps, highlights = null) {
    if (vm.size !== this.coreSize || vm.geo !== this.geo) this.layout(vm.size, vm.geo);
    this.highlights = highlights;
    const now = performance.now();
    // Camera: spin, follow the action, ease towards targets.
    if (this.spin && !this.pointers.size) this.yaw += 0.006;
    if (this.follow && highlights) {
      const hot = highlights.hottest();
      if (hot >= 0) {
        this.targetCenter = [this.pos[hot * 3], this.pos[hot * 3 + 1], this.pos[hot * 3 + 2]];
        this.targetZoom = Math.max(this.targetZoom, ACTION_ZOOM);
      }
    }
    const ease = 0.12;
    this.zoom += (this.targetZoom - this.zoom) * ease;
    for (let k = 0; k < 3; k++) this.center[k] += (this.targetCenter[k] - this.center[k]) * ease;
    this.changed = false;

    const { ctx } = this;
    const cam = this.project();
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawBox(cam);

    const n = this.coreSize;
    const { owner, lastWrite, lastExec, op, a, b } = vm;
    const steps = vm.steps;
    const slicing = this.slice.axis >= 0;
    // Empty space as faint dots (one path, one fill); occupied cells are
    // collected with a depth key for sorting far to near.
    ctx.fillStyle = EMPTY_DOT;
    ctx.beginPath();
    let m = 0;
    const keys = this.keys;
    for (let i = 0; i < n; i++) {
      if (slicing && !this.inSlice(i)) continue;
      const empty = owner[i] < 0 && op[i] === OP.DAT && a[i] === 0 && b[i] === 0;
      if (empty && steps - lastExec[i] > fadeSteps) {
        const r = Math.max(0.6, this.cellSize * this.scale[i] * (slicing ? 0.2 : 0.12));
        ctx.rect(this.sx[i] - r / 2, this.sy[i] - r / 2, r, r);
      } else {
        keys[m++] = Math.round((this.depth[i] + 8) * 65536) * n + i;
      }
    }
    ctx.fill();
    const sorted = keys.subarray(0, m).sort();
    this.drawnCount = m;
    for (let j = 0; j < m; j++) {
      const i = sorted[j] % n;
      this.drawnCells[j] = i;
      const size = Math.max(1.2, this.cellSize * this.scale[i] * 0.78);
      const w = owner[i];
      const x = this.sx[i] - size / 2, y = this.sy[i] - size / 2;
      if (w < 0) {
        ctx.fillStyle = '#334155';
      } else {
        const age = steps - lastWrite[i];
        const level = age < fadeSteps ? Math.round(GLOW * (1 - age / fadeSteps)) : 0;
        ctx.fillStyle = this.palettes[w % this.palettes.length][level];
      }
      if (op[i] === OP.DAT) {
        const d = size * 0.45;            // data and bombs as smaller dots
        ctx.fillRect(this.sx[i] - d / 2, this.sy[i] - d / 2, d, d);
      } else ctx.fillRect(x, y, size, size);
      const ex = steps - lastExec[i];
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
        if (slicing && !this.inSlice(pc)) continue;
        const size = Math.max(1.5, this.cellSize * this.scale[pc] * 0.35);
        ctx.fillRect(this.sx[pc] - size / 2, this.sy[pc] - size / 2, size, size);
        if (++count > 2000) break;
      }
    }
    // Battle highlights.
    if (highlights) {
      highlights.draw(ctx, now, (cell) => (slicing && !this.inSlice(cell) ? null : [this.sx[cell], this.sy[cell], this.cellSize * this.scale[cell]]), WARRIOR_COLORS);
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
    const [c0, c1, c2] = this.center;
    const corner = (sx, sy, sz) => {
      const x = sx * dx - c0, y = sy * dy - c1, z = sz * dz - c2;
      const x1 = x * cam.cy + z * cam.syaw, z1 = -x * cam.syaw + z * cam.cy;
      const y2 = y * cam.cp - z1 * cam.sp, z2 = y * cam.sp + z1 * cam.cp;
      const k = cam.f / Math.max(0.05, cam.dist - z2);
      return [cam.ox + x1 * k, cam.oy + y2 * k];
    };
    const ctx = this.ctx;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [p0, p1] of [
      [[-1, -1, -1], [1, -1, -1]], [[-1, 1, -1], [1, 1, -1]], [[-1, -1, 1], [1, -1, 1]], [[-1, 1, 1], [1, 1, 1]],
      [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]], [[-1, -1, 1], [-1, 1, 1]], [[1, -1, 1], [1, 1, 1]],
      [[-1, -1, -1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]], [[-1, 1, -1], [-1, 1, 1]], [[1, 1, -1], [1, 1, 1]],
    ]) {
      const p = corner(...p0), q = corner(...p1);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(160, 175, 210, 0.75)';
    for (const [label, at] of [['x', [1.12, -1, -1]], ['y', [-1, 1.12, -1]], ['z', [-1, -1, 1.12]]]) {
      const [px, py] = corner(...at);
      ctx.fillText(label, px - 3, py + 4);
    }
  }

  // The cell under the pointer: the nearest drawn cell within reach, or any
  // visible cell if nothing is drawn there, preferring cells nearer the viewer.
  addressAt(clientX, clientY) {
    if (!this.sx) return -1;
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * this.w, y = ((clientY - r.top) / r.height) * this.h;
    const pickFrom = (count, cellAt, reach) => {
      let best = -1, bestScore = Infinity;
      for (let j = 0; j < count; j++) {
        const i = cellAt(j);
        if (i < 0) continue;
        const d = Math.hypot(this.sx[i] - x, this.sy[i] - y);
        if (d > Math.max(reach, this.cellSize * this.scale[i] * 0.6)) continue;
        const score = d - this.depth[i] * 4;
        if (score < bestScore) { bestScore = score; best = i; }
      }
      return best;
    };
    const hit = pickFrom(this.drawnCount, (j) => this.drawnCells[j], 6);
    if (hit >= 0) return hit;
    return pickFrom(this.coreSize, (i) => (this.inSlice(i) ? i : -1), 4);
  }
}
