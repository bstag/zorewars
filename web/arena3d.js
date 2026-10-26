// A live 3D view of a torus battlefield: every cell drawn at its (x, y, z)
// with perspective, coloured like the 2D grid (owner, and a glow for recent
// writes), running processes as white points. Drag to rotate, wheel or pinch
// to zoom, and it spins on its own until you grab it.
//
// Also: slicing (show only a slab of layers along x, y or z), battle
// highlights (splashes for overrides, sparks for kills; see highlights.js),
// an "Action" camera that flies to where the fighting is and follows it, and
// following one warrior: the camera tracks one of its processes (each frame,
// the warrior's process nearest to where it was), with a trail behind it.
//
// Same interface as the 2D CoreRenderer (layout, draw, addressAt, hover,
// pinned), so the arena can swap between them. Plain canvas, no libraries.

import { OP } from '../src/engine/index.js';
import { makePalettes, GLOW, colorIndex, warriorColors } from './arena.js';

const BACKGROUND = '#050812';
const EMPTY_DOT = 'rgba(120, 140, 190, 0.16)';
const EDGE = 'rgba(120, 140, 190, 0.35)';
const ACTION_ZOOM = 2.6;
const FOLLOW_ZOOM = 2.8;
const TRAIL = 90;
// The torus shape: the ring's radius and the outermost tube's.
const RING = 0.36;
const TUBE = 0.15;

// Where each cell sits in 3D, fitting about a unit cube round the origin:
// unwrapped as a box ('box'), or bent into the doughnut the torus is
// ('torus'): x runs round the ring, y round the tube, and the z layers are
// nested tubes from the inside out. A plane (one layer) is exactly a torus's
// surface; a volume's third wrap (z) can't be shown in 3D space, so its seam
// lies between the innermost and outermost tube. Also used by the avatars'
// map (avatars3d.js). Returns positions, the gap between neighbouring cells,
// the extent along each axis, and the torus's radii (null for the box).
export function shapePositions(coreSize, geo, shape = 'box') {
  const [X, Y, Z] = geo ? [geo.X, geo.Y, geo.Z] : [coreSize, 1, 1];
  const pos = new Float32Array(coreSize * 3);
  const torus = shape === 'torus' && Y > 1;
  const s = 1 / Math.max(X, Y, Z);
  const thin = Z > 1 ? TUBE * 0.3 : TUBE;
  for (let i = 0; i < coreSize; i++) {
    const [x, y, z] = geo ? geo.position(i) : [i, 0, 0];
    if (torus) {
      const u = (2 * Math.PI * x) / X, v = (2 * Math.PI * y) / Y;
      const r = Z > 1 ? thin + ((TUBE - thin) * z) / (Z - 1) : TUBE;
      const across = RING + r * Math.cos(v);
      pos[i * 3] = across * Math.cos(u);
      pos[i * 3 + 1] = r * Math.sin(v);
      pos[i * 3 + 2] = across * Math.sin(u);
    } else {
      pos[i * 3] = (x - (X - 1) / 2) * s;
      pos[i * 3 + 1] = (y - (Y - 1) / 2) * s;
      pos[i * 3 + 2] = (z - (Z - 1) / 2) * s;
    }
  }
  if (!torus) return { pos, cellSize: s, dims: [X * s, Y * s, Z * s], rings: null };
  const spacing = Math.min((2 * Math.PI * RING) / X, (2 * Math.PI * (thin + TUBE) / 2) / Y, Z > 1 ? (TUBE - thin) / (Z - 1) : Infinity);
  return { pos, cellSize: Math.max(0.002, spacing), dims: [2 * (RING + TUBE), 2 * TUBE, 2 * (RING + TUBE)], rings: { R: RING, inner: thin, outer: TUBE } };
}

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
    this.followWarrior = -1;          // the warrior being followed (-1: none)
    this.followColor = '#ffffff';
    this.tracked = -1;                // the process (cell) the camera is on
    this.trail = [];
    this.slice = { axis: -1, pos: 0, thick: 1 };   // axis -1: no slicing
    this.shape = 'box';               // 'box': unwrapped; 'torus': the doughnut it wraps into
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
    this.followWarrior = -1;
    this.trail = [];
    this.targetZoom = 1;
    this.targetCenter = [0, 0, 0];
    this.changed = true;
  }
  setFollow(on) {
    if (on) { this.followWarrior = -1; this.trail = []; }
    this.follow = on;
    if (!on) this.fit();
    this.changed = true;
  }
  // Follow warrior k (its index in the VM); `color` for its trail.
  followWarriorIndex(k, color) {
    this.follow = false;
    this.followWarrior = k;
    this.followColor = color;
    this.tracked = -1;
    this.trail = [];
    this.spin = false;
    this.changed = true;
  }
  stopFollowingWarrior() {
    if (this.followWarrior >= 0) this.fit();
  }
  setShape(shape) {
    this.shape = shape;
    if (this.geo) this.layout(this.coreSize, this.geo);
    this.fit();
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
  get animating() { return this.active && (this.spin || this.changed || this.follow || this.followWarrior >= 0 || this.easing || !!this.highlights?.active); }

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
    const shape = shapePositions(coreSize, geo, this.shape);
    Object.assign(this, { pos: shape.pos, dims: shape.dims, cellSize: shape.cellSize, rings: shape.rings });
    this.coord = new Int16Array(coreSize * 3);       // integer (x, y, z), for slicing
    for (let i = 0; i < coreSize; i++) {
      const [x, y, z] = geo ? geo.position(i) : [i, 0, 0];
      this.coord[i * 3] = x; this.coord[i * 3 + 1] = y; this.coord[i * 3 + 2] = z;
    }
    this.sx = new Float32Array(coreSize);
    this.sy = new Float32Array(coreSize);
    this.depth = new Float32Array(coreSize);
    this.scale = new Float32Array(coreSize);
    this.keys = new Float64Array(coreSize);           // depth-sort keys (no per-frame allocation)
    this.drawnCount = 0;
    this.drawnCells = new Int32Array(coreSize);
  }

  // Torus distance between two cells (squared, per axis wrapping).
  gap(p, q) {
    const C = this.coord, [X, Y, Z] = this.geo ? [this.geo.X, this.geo.Y, this.geo.Z] : [this.coreSize, 1, 1];
    let dx = Math.abs(C[p * 3] - C[q * 3]); dx = Math.min(dx, X - dx);
    let dy = Math.abs(C[p * 3 + 1] - C[q * 3 + 1]); dy = Math.min(dy, Y - dy);
    let dz = Math.abs(C[p * 3 + 2] - C[q * 3 + 2]); dz = Math.min(dz, Z - dz);
    return dx * dx + dy * dy + dz * dz;
  }

  // Following a warrior: stay with the process nearest to the last one, so
  // the camera rides one line of descent rather than jumping between them.
  track(vm) {
    const war = vm.warriors[this.followWarrior];
    if (!war || !war.alive || !war.queue.size) return;     // stays where it last was
    let best = -1, bestGap = Infinity;
    if (this.tracked < 0) best = war.queue.buf[war.queue.head];
    else {
      for (const pc of war.queue) {
        const g = this.gap(pc, this.tracked);
        if (g < bestGap) { bestGap = g; best = pc; if (g === 0) break; }
      }
    }
    const prev = this.tracked;
    this.tracked = best;
    if (this.trail[this.trail.length - 1] !== best) {
      this.trail.push(best);
      if (this.trail.length > TRAIL) this.trail.shift();
    }
    const target = [this.pos[best * 3], this.pos[best * 3 + 1], this.pos[best * 3 + 2]];
    // Wrapping round the torus: jump straight there instead of sweeping across.
    // (On the doughnut only the z seam jumps: from the innermost tube to the outermost.)
    const far = prev >= 0 && (this.rings
      ? Math.hypot(...target.map((v, k) => v - this.center[k])) > this.rings.outer
      : target.some((v, k) => Math.abs(v - this.center[k]) > this.dims[k] / 2));
    if (far) this.center = target.slice();
    this.targetCenter = target;
    this.targetZoom = Math.max(this.targetZoom, FOLLOW_ZOOM);
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
    if (this.followWarrior >= 0) this.track(vm);
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
        // (On the doughnut the empty cells are the shape, so they show more.)
        const r = Math.max(this.rings ? 1 : 0.6, this.cellSize * this.scale[i] * (slicing ? 0.2 : this.rings ? 0.3 : 0.12));
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
        ctx.fillStyle = this.palettes[colorIndex(w) % this.palettes.length][level];
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
    // The followed process: its trail (broken where it jumps) and a pulsing ring.
    if (this.followWarrior >= 0 && this.tracked >= 0) {
      ctx.strokeStyle = this.followColor;
      ctx.lineWidth = 2;
      const t = this.trail;
      for (let j = 1; j < t.length; j++) {
        if (this.gap(t[j - 1], t[j]) > 9) continue;          // a hop, not a step
        ctx.globalAlpha = 0.15 + 0.75 * (j / t.length);
        ctx.beginPath();
        ctx.moveTo(this.sx[t[j - 1]], this.sy[t[j - 1]]);
        ctx.lineTo(this.sx[t[j]], this.sy[t[j]]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const c = this.tracked, px = this.cellSize * this.scale[c];
      const r = Math.max(6, px * (1.1 + 0.25 * Math.sin(now / 160)));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.sx[c], this.sy[c], r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Battle highlights.
    if (highlights) {
      highlights.draw(ctx, now, (cell) => (slicing && !this.inSlice(cell) ? null : [this.sx[cell], this.sy[cell], this.cellSize * this.scale[cell]]), warriorColors());
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
    const at = (x0, y0, z0) => {
      const x = x0 - c0, y = y0 - c1, z = z0 - c2;
      const x1 = x * cam.cy + z * cam.syaw, z1 = -x * cam.syaw + z * cam.cy;
      const y2 = y * cam.cp - z1 * cam.sp, z2 = y * cam.sp + z1 * cam.cp;
      const k = cam.f / Math.max(0.05, cam.dist - z2);
      return [cam.ox + x1 * k, cam.oy + y2 * k];
    };
    const corner = (sx, sy, sz) => at(sx * dx, sy * dy, sz * dz);
    const ctx = this.ctx;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    if (this.rings) {
      // The doughnut's guides: the ring's centre line, and the seam where
      // x = 0 meets the last column (a circle round the tube).
      const { R, outer } = this.rings;
      ctx.beginPath();
      for (let k = 0; k <= 96; k++) {
        const u = (2 * Math.PI * k) / 96, [px, py] = at(R * Math.cos(u), 0, R * Math.sin(u));
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      for (let k = 0; k <= 48; k++) {
        const v = (2 * Math.PI * k) / 48, [px, py] = at(R + outer * 1.15 * Math.cos(v), outer * 1.15 * Math.sin(v), 0);
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(160, 175, 210, 0.75)';
      const [sx, sy] = at(R + outer * 1.35, 0, 0);
      ctx.fillText('x = 0', sx + 2, sy + 4);
      return;
    }
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
