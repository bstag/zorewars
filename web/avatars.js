// Avatars: the battle shown as creatures fighting in an arena.
//
// Each warrior's body is its own loaded code, one part per instruction, and
// its opcode gives the part its shape:
//   SPL arm (spawns processes)   MOV claw (copies, throws)   ADD..MOD gear
//   JMP/DJN joint                JMZ/JMN/SEQ/SNE/SLT eye     DAT ammo pod
// Shots fly from the attacker's part that wrote them to the part they hit;
// parts are smashed, webbed, chipped or turned into the attacker's kind of
// part; processes elsewhere orbit the body; a converted warrior turns into
// its captor.
//
// What is shown comes from avatar-model.js (shared with the WebGL view,
// avatars3d.js); this file only draws it, on a plain canvas: the fallback
// when WebGL isn't available, and the flat view.
//
// Same interface as the other core views (layout, draw, addressAt, hover,
// pinned): a body part's address is its cell, so clicking one pins it in the
// inspector.

import { AvatarModel, LEGEND } from './avatar-model.js';
import { WARRIOR_COLORS, colorIndex } from './arena.js';

const BACKGROUND = '#050812';
const FLIGHT_MS = 420;
const IMPACT_MS = 650;
const MAX_FLYING = 80;
const BODY_HEIGHT = 1.45;        // world units, feet to head
const CAMERA_DISTANCE = 3.4;
const CAMERA_HEIGHT = 1.15;

const colorOf = (w) => WARRIOR_COLORS[colorIndex(w) % WARRIOR_COLORS.length];
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// A body's shape: segment centres and radius in body units (height 1, feet
// at y = 0, up is negative), laid along a spine that wiggles more the longer
// the warrior is, so a 100-instruction paper coils like a serpent.
function spine(n) {
  const waves = n <= 8 ? 0 : Math.ceil(n / 10);
  const amp = n <= 8 ? 0 : 0.2;
  const top = n <= 8 ? 0.35 + n * 0.08 : 1;
  const pts = [];
  let len = 0;
  const S = 240;
  for (let k = 0; k <= S; k++) {
    const t = k / S;
    const p = [Math.sin(t * Math.PI * waves) * amp, -top * (1 - t) - 0.12];
    if (k) len += Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]);
    pts.push([...p, len]);
  }
  const r = Math.min(0.085, (len / Math.max(1, n)) * 0.6);
  const seg = [];
  for (let i = 0; i < n; i++) {
    const at = n === 1 ? 0 : (i / (n - 1)) * len;
    let k = 0;
    while (k < S && pts[k + 1][2] < at) k++;
    seg.push([pts[k][0], pts[k][1]]);
  }
  return { seg, r };
}

export class AvatarView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hover = -1;
    this.pinned = -1;
    this.active = false;
    this.vm = null;
    this.model = new AvatarModel();
    this.yaw = 0;
    this.dragYaw = 0;
    this.pointer = null;
    this.dragMoved = false;
    this.flying = [];       // projectiles on their way
    this.impacts = [];
    this.hits = [];         // where each part was drawn, for addressAt
    this.attach();
  }

  attach() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.pointer = e.clientX;
      this.dragMoved = false;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.active || this.pointer === null) return;
      const dx = e.clientX - this.pointer;
      this.pointer = e.clientX;
      if (Math.abs(dx) > 1) this.dragMoved = true;
      this.dragYaw += dx * 0.008;
      this.dragAt = performance.now();
    });
    const up = () => { this.pointer = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', up);
  }
  consumeDrag() { const d = this.dragMoved; this.dragMoved = false; return d; }
  // Redraw while the battle or a drag is moving, and for a few seconds after;
  // then rest until something moves again (a paused battle costs nothing).
  get animating() {
    return this.active && (!!this.pointer || performance.now() - Math.max(this.quietSince ?? 0, this.dragAt ?? 0) < 4000 || this.flying?.length > 0);
  }

  layout(coreSize, geo) {
    this.coreSize = coreSize;
    this.geo = geo;
    const width = this.canvas.parentElement.clientWidth || 800;
    const height = Math.round(width * 0.62);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);     // 3x phones: 9x the pixels for no visible gain
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.aspectRatio = `${width} / ${height}`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = width;
    this.h = height;
  }

  addressAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * this.w;
    const y = ((clientY - r.top) / r.height) * this.h;
    let best = -1, bestD = Infinity;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < Math.max(h.r, 5) && d < bestD) { bestD = d; best = h.cell; }
    }
    return best;
  }

  // ---- bodies, built once per round ----
  build(vm) {
    this.vm = vm;
    this.seenSteps = -1;
    this.quietSince = performance.now();
    this.flying = [];
    this.impacts = [];
    this.model.build(vm);
    this.bodies = this.model.bodies;
    for (const b of this.bodies) {                     // where this view draws each part
      Object.assign(b, spine(b.cells.length), { screen: new Float32Array(b.cells.length * 3), base: [0, 0], scale: 1, face: 1 });
    }
  }

  // Hit events since the last frame: shots to fly, and kills that land now.
  ingest(vm, events, now) {
    if (vm !== this.vm) this.build(vm);
    this.model.ingest(vm, events, now);
    for (const h of this.model.takeHits()) {
      if (h.kind === 'kill') this.impacts.push({ to: h.to, kind: 'kill', attacker: h.attacker, t0: now });
      else if (this.flying.length < MAX_FLYING) this.flying.push({ from: h.from, to: h.to, kind: h.kind, attacker: h.attacker, t0: now, minor: h.minor });
    }
  }

  // ---- projection: a camera looking at the arena floor ----
  project(x, h, z) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const xr = x * c - z * s, zr = x * s + z * c;
    const d = CAMERA_DISTANCE + zr;
    const F = this.w * 0.55;
    return [this.w / 2 + (xr * F) / d, this.h * 0.42 + ((CAMERA_HEIGHT - h) * F) / d, F / d, d];
  }

  draw(vm, fadeSteps) {
    if (vm !== this.vm) this.build(vm);
    if (vm.size !== this.coreSize || !this.w) this.layout(vm.size, vm.geo);
    const { ctx } = this;
    const now = performance.now();
    const n = vm.warriors.length;
    if (vm.steps !== this.seenSteps) { this.seenSteps = vm.steps; this.quietSince = now; }
    this.yaw = Math.sin(now * 0.00015) * 0.3 + this.dragYaw;
    this.model.update(vm, now, Math.max(24, fadeSteps));

    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#0b1230');
    g.addColorStop(1, BACKGROUND);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawFloor(vm, now);

    // Where each avatar stands (a staggered row, so nobody hides behind
    // anybody), and what each one's processes are up to.
    const R = n > 2 ? 1.5 : 1;
    const order = vm.warriors.map((war, w) => {
      const ax = n > 1 ? -R + (2 * R * w) / (n - 1) : 0;
      const az = n > 2 ? (w % 2 ? 0.35 : -0.2) : 0;
      const [x, y, s, d] = this.project(ax, 0, az);
      const b = this.bodies[w];
      b.base = [x, y];
      b.scale = s * BODY_HEIGHT;
      b.depth = d;
      return w;
    });
    for (const w of order) {
      // Face the nearest living opponent on screen.
      const b = this.bodies[w];
      let best = null;
      for (const o of order) if (o !== w && vm.warriors[o].alive && (!best || Math.abs(this.bodies[o].base[0] - b.base[0]) < Math.abs(best.base[0] - b.base[0]))) best = this.bodies[o];
      b.face = best ? Math.sign(best.base[0] - b.base[0]) || 1 : 1;
    }
    order.sort((a, b) => this.bodies[b].depth - this.bodies[a].depth);   // far ones first

    this.hits = [];
    for (const w of order) this.drawAvatar(vm, w, now);
    this.drawFlying(now);
    for (const w of order) this.drawLabel(vm, w);

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#9fb0d8';
    ctx.font = `${Math.max(9, Math.round(this.w / 80))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(LEGEND, 8, this.h - 8);
    ctx.globalAlpha = 1;
  }

  drawFloor(vm, now) {
    const { ctx } = this;
    for (const [rad, a] of [[1.7, 0.35], [1.0, 0.18], [0.4, 0.12]]) {
      ctx.strokeStyle = `rgba(120, 140, 190, ${a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const t = (k / 64) * Math.PI * 2;
        const [x, y] = this.project(rad * Math.cos(t), 0, rad * Math.sin(t));
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // The cycle count as a slowly filling ring at the arena's rim.
    const frac = Math.min(1, vm.cycle / vm.settings.maxCycles);
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 96 * frac; k++) {
      const t = -Math.PI / 2 + (k / 96) * Math.PI * 2;
      const [x, y] = this.project(1.75 * Math.cos(t), 0, 1.75 * Math.sin(t));
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  drawAvatar(vm, w, now) {
    const { ctx } = this;
    const b = this.bodies[w];
    const war = vm.warriors[w];
    const col = colorOf(w);
    const [bx, by] = b.base;
    const s = b.scale;

    // Shadow and vitality halo on the floor.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(bx, by, s * 0.32, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    if (war.alive) {
      const v = Math.min(1, Math.log2(1 + b.total) / Math.log2(1 + vm.settings.maxProcesses));
      ctx.strokeStyle = rgba(col, 0.25 + 0.5 * v);
      ctx.lineWidth = 1 + 3 * v;
      ctx.beginPath();
      ctx.ellipse(bx, by, s * (0.3 + 0.25 * v + 0.03 * Math.sin(now / 200)), s * (0.065 + 0.05 * v), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const shake = b.shake && now - b.shake < 300 ? (1 - (now - b.shake) / 300) * s * 0.03 : 0;
    const bob = war.alive ? Math.sin(now / 380 + w) * s * 0.012 : 0;
    const collapse = b.deadAt ? Math.min(1, (now - b.deadAt) / 900) : 0;
    const face = b.face;
    const r = b.r * s;
    const m = b.morph;

    // Positions of the segments on screen.
    const N = b.cells.length;
    for (let i = 0; i < N; i++) {
      let lx = b.seg[i][0] * face, ly = b.seg[i][1];
      if (collapse) {                                   // a heap on the floor
        lx = lx * (1 - collapse) + (hash(i + w * 101) - 0.5) * 0.5 * collapse;
        ly = ly * (1 - collapse) + (-b.r * (1 + hash(i * 7) * 1.5)) * collapse;
      }
      b.screen[i * 3] = bx + lx * s + (shake ? (hash(now + i) - 0.5) * shake * 2 : 0);
      b.screen[i * 3 + 1] = by + ly * s + bob;
      b.screen[i * 3 + 2] = i === 0 ? r * 1.45 : r;
    }

    // Converted: the opponent's body grows in place of this one.
    if (m > 0.02 && b.morphTo >= 0 && this.bodies[b.morphTo]) {
      this.drawGhost(this.bodies[b.morphTo], b.morphTo, bx, by + bob, s, face, m, now);
    }
    ctx.globalAlpha = 1 - m * 0.85;

    // Spine links first, then the parts on top.
    ctx.strokeStyle = collapse ? 'rgba(90, 100, 120, 0.4)' : rgba(col, 0.5);
    ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = b.screen[i * 3], y = b.screen[i * 3 + 1];
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    if (!collapse) ctx.stroke();
    if (!collapse) this.drawLegs(b, bx, by + bob, s, col, now, war.alive);

    for (let i = N - 1; i >= 0; i--) {
      const cell = b.cells[i];
      const x = b.screen[i * 3], y = b.screen[i * 3 + 1], rr = b.screen[i * 3 + 2];
      const enemy = b.enemy[i], dmg = b.damage[i], kind = b.kind[i], act = b.active[i];
      const partCol = dmg === 'converted' ? colorOf(enemy) : col;
      const dead = collapse > 0;

      if (b.procs[i] && !dead) {                        // a process lives here
        ctx.fillStyle = rgba('#ffffff', Math.min(0.35, 0.1 + 0.05 * b.procs[i]));
        ctx.beginPath();
        ctx.arc(x, y, rr * 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      if (dmg === 'bombed') this.drawBombed(x, y, rr, colorOf(enemy), i);
      else this.drawPart(kind, x, y, rr, face, dead ? '#475569' : partCol, act, now, i);
      if (dmg === 'stunned') this.drawWeb(x, y, rr, colorOf(enemy), now);
      if (dmg === 'chipped') this.drawChips(x, y, rr, colorOf(enemy), i);
      if (i === 0) this.drawEyes(x, y, rr, face, b, dead, now);

      const since = now - b.lastHit[i];
      if (since < 400) {                                // just hit
        ctx.fillStyle = rgba('#ffffff', 0.7 * (1 - since / 400));
        ctx.beginPath();
        ctx.arc(x, y, rr * (1 + since / 250), 0, Math.PI * 2);
        ctx.fill();
      }
      if (cell === this.pinned || cell === this.hover) {
        ctx.strokeStyle = cell === this.pinned ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, rr * 1.6 + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.hits.push({ x, y, r: rr * 1.3, cell });
    }
    ctx.globalAlpha = 1;

    // Processes running elsewhere orbit the body; those on enemy code take
    // the captor's colour.
    if (war.alive && b.away) {
      const dots = Math.min(28, Math.ceil(Math.log2(b.away + 1) * 3));
      const captive = b.total ? Math.round((dots * b.possessed) / b.total) : 0;
      const cy = by - s * 0.55;
      for (let k = 0; k < dots; k++) {
        const t = now / (900 + 60 * (k % 5)) + (k * 2 * Math.PI) / dots;
        const rx = s * (0.38 + 0.06 * (k % 3)), ry = s * 0.5;
        ctx.fillStyle = k < captive ? colorOf(b.captor) : col;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(t) * rx, cy + Math.sin(t) * ry * 0.9, Math.max(1.5, s * 0.012), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    b.center = [bx, by - s * 0.55];

    // Impacts that landed on this avatar.
    for (const e of this.impacts) if (e.to.w === w) this.drawImpact(e, now);
    this.impacts = this.impacts.filter((e) => now - e.t0 < IMPACT_MS);
  }

  drawLegs(b, bx, by, s, col, now, alive) {
    const { ctx } = this;
    const tail = b.seg[b.seg.length - 1];
    const hipX = bx + tail[0] * b.face * s, hipY = by + tail[1] * s;
    const step = alive ? Math.sin(now / 260) * 0.03 : 0;
    ctx.strokeStyle = rgba(col, 0.75);
    ctx.lineWidth = Math.max(1.5, s * 0.018);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(bx + (side * 0.09 + step * side) * s, by);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  drawPart(kind, x, y, r, face, col, act, now, i) {
    const { ctx } = this;
    const fill = rgba(col, 0.35 + 0.45 * act);
    const edge = rgba(col, 0.9);
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.strokeStyle = edge;
    ctx.fillStyle = fill;
    const wave = Math.sin(now / 220 + i);
    switch (kind) {
      case 'arm': {                                     // tentacles out both sides
        ctx.beginPath();
        for (const side of [-1, 1]) {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + side * r * 1.8, y - r * (0.8 + wave * 0.6), x + side * r * 2.8, y + r * (0.2 + wave * 0.5));
        }
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'claw': {                                    // a pincer towards the enemy
        const open = 0.35 + 0.35 * act;
        const cx = x + face * r * 2.2;
        ctx.beginPath();
        ctx.moveTo(x + face * r, y);
        ctx.lineTo(cx, y);
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + face * r * 0.9, y - r * open * 1.4);
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + face * r * 0.9, y + r * open * 1.4);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'gear': {                                    // teeth turn when it runs
        const rot = now / 300 * (0.2 + act);
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = rot + (k / 16) * Math.PI * 2;
          const rr = k % 2 ? r : r * 1.3;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'joint': {
        ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.globalAlpha *= 0.5; ctx.stroke(); ctx.globalAlpha /= 0.5;
        break;
      }
      case 'eye': {                                     // scanners look around
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.6, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b1020';
        ctx.beginPath(); ctx.arc(x + Math.sin(now / 500 + i) * r * 0.3, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'pod': {                                     // ammunition
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = edge;
        ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default: {
        const q = r * 0.9;
        ctx.beginPath(); ctx.rect(x - q, y - q, q * 2, q * 2); ctx.fill(); ctx.stroke();
      }
    }
  }

  drawBombed(x, y, r, col, i) {
    const { ctx } = this;
    ctx.fillStyle = '#161b26';
    ctx.strokeStyle = rgba(col, 0.8);
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {                     // a jagged shard
      const a = (k / 7) * Math.PI * 2;
      const rr = r * (0.6 + 0.45 * hash(i * 13 + k));
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.4); ctx.lineTo(x + r * 0.1, y + r * 0.1); ctx.lineTo(x + r * 0.45, y - r * 0.2);
    ctx.stroke();
  }

  drawWeb(x, y, r, col, now) {
    const { ctx } = this;
    ctx.strokeStyle = rgba(col, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + now / 2000;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5);
    }
    for (const f of [0.6, 1.1, 1.5]) { ctx.moveTo(x + r * f, y); ctx.arc(x, y, r * f, 0, Math.PI * 2); }
    ctx.stroke();
  }

  drawChips(x, y, r, col, i) {
    const { ctx } = this;
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = hash(i * 5 + k) * Math.PI * 2;
      ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
      ctx.lineTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25);
    }
    ctx.stroke();
  }

  drawEyes(x, y, r, face, b, dead, now) {
    const { ctx } = this;
    // Eyes take the captor's colour once processes run enemy code.
    const iris = dead ? '#475569' : b.capture > 0.25 && b.lastCaptor >= 0 ? colorOf(b.lastCaptor) : '#f8fafc';
    const blink = !dead && Math.sin(now / 1700 + b.cells[0]) > 0.985 ? 0.15 : 1;
    for (const dx of [-0.35, 0.35]) {
      const ex = x + (dx + face * 0.2) * r, ey = y - r * 0.15;
      ctx.fillStyle = iris;
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.24, r * 0.3 * blink, 0, 0, Math.PI * 2); ctx.fill();
      if (dead) {
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex - r * 0.2, ey - r * 0.2); ctx.lineTo(ex + r * 0.2, ey + r * 0.2);
        ctx.moveTo(ex + r * 0.2, ey - r * 0.2); ctx.lineTo(ex - r * 0.2, ey + r * 0.2); ctx.stroke();
      } else {
        ctx.fillStyle = '#0b1020';
        ctx.beginPath(); ctx.arc(ex + face * r * 0.08, ey, r * 0.11, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // The captor's body, drawn where the converted warrior stands.
  drawGhost(other, ow, bx, by, s, face, m, now) {
    const { ctx } = this;
    const col = colorOf(ow);
    const r = other.r * s;
    ctx.globalAlpha = m;
    ctx.strokeStyle = rgba(col, 0.5);
    ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.beginPath();
    other.seg.forEach(([lx, ly], i) => { const x = bx + lx * face * s, y = by + ly * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    for (let i = other.seg.length - 1; i >= 0; i--) {
      const x = bx + other.seg[i][0] * face * s, y = by + other.seg[i][1] * s;
      this.drawPart(other.origKind[i], x, y, i === 0 ? r * 1.45 : r, face, col, 0.3, now, i);
    }
    ctx.globalAlpha = 1;
  }

  // Where a projectile end is now: a body part, or the middle of the avatar.
  endPoint(end) {
    const b = this.bodies[end.w];
    if (!b) return null;
    if (end.i >= 0) return [b.screen[end.i * 3], b.screen[end.i * 3 + 1], b.screen[end.i * 3 + 2]];
    return b.center ? [b.center[0], b.center[1], b.scale * 0.05] : null;
  }

  drawFlying(now) {
    const { ctx } = this;
    const landed = [];
    for (const p of this.flying) {
      const a = this.endPoint(p.from), z = this.endPoint(p.to);
      if (!a || !z) { p.done = true; continue; }
      const t = (now - p.t0) / FLIGHT_MS;
      if (t >= 1) { p.done = true; landed.push(p); continue; }
      const lift = Math.min(120, Math.abs(z[0] - a[0]) * 0.35 + 20);
      const x = a[0] + (z[0] - a[0]) * t;
      const y = a[1] + (z[1] - a[1]) * t - Math.sin(t * Math.PI) * lift;
      const col = colorOf(p.attacker);
      const size = p.minor ? 2 : 3.5;
      ctx.globalAlpha = p.minor ? 0.5 : 1;
      ctx.fillStyle = p.kind === 'bombed' ? '#fb7185' : col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (p.kind === 'stunned') {                      // a spinning net
        for (let k = 0; k < 4; k++) {
          const ang = now / 80 + (k * Math.PI) / 2;
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * size * 1.8, y + Math.sin(ang) * size * 1.8);
        }
        ctx.stroke();
      } else {
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        // a short trail behind it
        const t0 = Math.max(0, t - 0.12);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(a[0] + (z[0] - a[0]) * t0, a[1] + (z[1] - a[1]) * t0 - Math.sin(t0 * Math.PI) * lift);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    this.flying = this.flying.filter((p) => !p.done);
    for (const p of landed) {
      if (!p.minor) {
        const b = this.bodies[p.to.w];
        if (b && p.to.i >= 0) { b.lastHit[p.to.i] = now; b.lastHitBy[p.to.i] = p.attacker; }
      }
      if (this.impacts.length < MAX_FLYING) this.impacts.push({ to: p.to, kind: p.kind, attacker: p.attacker, t0: now, minor: p.minor });
    }
  }

  drawImpact(e, now) {
    const at = this.endPoint(e.to);
    if (!at) return;
    const { ctx } = this;
    const [x, y, r0] = at;
    const t = Math.min(1, (now - e.t0) / IMPACT_MS);
    const fade = 1 - t;
    const col = colorOf(e.attacker);
    const r = Math.max(4, r0) * (e.minor ? 0.6 : 1);
    ctx.globalAlpha = fade;
    if (e.kind === 'kill') {                          // a process died here
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath(); ctx.arc(x, y, r * (1 + 2 * t), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        ctx.moveTo(x + Math.cos(a) * r * (1 + 2 * t), y + Math.sin(a) * r * (1 + 2 * t));
        ctx.lineTo(x + Math.cos(a) * r * (2 + 4 * t), y + Math.sin(a) * r * (2 + 4 * t));
      }
      ctx.stroke();
    } else if (e.kind === 'bombed') {                 // a blast
      ctx.fillStyle = `rgba(251, 146, 60, ${0.7 * fade})`;
      ctx.beginPath(); ctx.arc(x, y, r * (1 + 3 * t), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(254, 240, 138, ${fade})`;
      ctx.beginPath(); ctx.arc(x, y, r * (0.6 + t), 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'stunned') {                // the net closes
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r * (3 - 2 * t), 0, Math.PI * 2); ctx.stroke();
    } else {                                          // paint: conversion or a chip
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) ctx.arc(x, y, r * (0.8 + k * 0.6 + 2 * t), t * 6 + k, t * 6 + k + Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawLabel(vm, w) {
    const { ctx } = this;
    const b = this.bodies[w];
    const war = vm.warriors[w];
    const col = colorOf(w);
    let top = Infinity;
    for (let i = 0; i < b.cells.length; i++) top = Math.min(top, b.screen[i * 3 + 1] - b.screen[i * 3 + 2]);
    const x = b.base[0], y = Math.max(14, Math.min(top, b.base[1] - b.scale * 0.2) - 30);
    const fs = Math.max(10, Math.round(this.w / 62));
    ctx.textAlign = 'center';
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.fillStyle = col;
    ctx.fillText(war.name || `Warrior ${w + 1}`, x, y);

    // Integrity (body cells still its own) and processes.
    const bw = Math.max(50, this.w * 0.09), bh = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x - bw / 2, y + 5, bw, bh);
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, y + 5, bw * b.integrity, bh);
    const status = this.model.status(vm, w);
    ctx.font = `${fs - 2}px system-ui, sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(status, x, y + 5 + bh + fs);
  }
}
