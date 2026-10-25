// What the Avatars views show, read from the VM: no drawing here, so the flat
// canvas view (avatars.js) and the WebGL one (avatars3d.js) always agree, and
// the tests can check it in Node.
//
// Each warrior's body is its own loaded code: one part per instruction, head
// first (the ORG instruction), then the rest in execution order. Per part:
// - kind: the shape its opcode gives it (see KIND_OF);
// - damage: how an enemy's write changed it. An enemy DAT smashes it
//   ('bombed'); an enemy SPL/JMP over something else webs it ('stunned'); the
//   same opcode with new fields chips it ('chipped': decrements and
//   arithmetic); any other instruction makes it the attacker's kind of part
//   ('converted');
// - activity: how recently it ran, and how many processes sit on it.
// Per warrior: processes elsewhere (a paper's copies), processes held captive
// by an enemy, how much of the body is still its own, and conversion: when
// its processes run an enemy's program it turns into that enemy.
//
// Hits come from the VM's events (VM.enableEvents): each override of a body
// part becomes a shot from the attacker's part that wrote it (vm.writerPc)
// to the part it hit, and each kill a blow that lands at once.

import { OP, MOD, MODES } from '../src/engine/index.js';

export const KIND_OF = new Map([
  [OP.DAT, 'pod'], [OP.MOV, 'claw'], [OP.SPL, 'arm'],
  [OP.ADD, 'gear'], [OP.SUB, 'gear'], [OP.MUL, 'gear'], [OP.DIV, 'gear'], [OP.MOD, 'gear'],
  [OP.JMP, 'joint'], [OP.DJN, 'joint'],
  [OP.JMZ, 'eye'], [OP.JMN, 'eye'], [OP.SEQ, 'eye'], [OP.SNE, 'eye'], [OP.SLT, 'eye'],
]);
export const KINDS = ['arm', 'claw', 'gear', 'joint', 'eye', 'pod', 'plate'];
export const kindOf = (op) => KIND_OF.get(op) ?? 'plate';
export const LEGEND = 'SPL arm · MOV claw · ADD…MOD gear · JMP/DJN joint · tests eye · DAT pod';

// How an enemy write changed one of our cells.
export function damageOf(curOp, origOp) {
  if (curOp === OP.DAT) return 'bombed';
  if (curOp === origOp) return 'chipped';
  if (curOp === OP.SPL || curOp === OP.JMP) return 'stunned';
  return 'converted';
}

const PER_UPDATE = 10;          // body hits kept per batch of events (kills: 4, others: 3)
const MAX_PENDING = 200;
const CAPTURE_MS = 320;         // smoothing of the captive share
const MORPH_MS = 260;           // and of the change of body

// One number per instruction (exact below 2^53 for cores up to ~70k cells).
const insKey = (op, mod, am, bm, a, b, n) => ((((op * 8 + mod) * 8 + am) * 8 + bm) * n + a) * n + b;

export class AvatarModel {
  constructor() {
    this.vm = null;
    this.bodies = [];
    this.hits = [];
    this.last = 0;
  }

  build(vm) {
    this.vm = vm;
    this.hits = [];
    this.last = 0;
    this.scannedSteps = -1;
    this.partW = new Int8Array(vm.size).fill(-1);
    this.partI = new Int16Array(vm.size);
    this.programs = new Map();             // instruction -> bitmask of warriors whose program has it
    this.bodies = vm.warriors.map((war, w) => {
      const n = war.length;
      const cells = [], orig = [];
      for (let i = 0; i < n; i++) {
        const k = (war.start + i) % n;                  // head first, in execution order
        const at = vm.geo ? vm.geo.add(war.position, vm.geo.encode(k, 0, 0)) : war.position + k;
        const cell = vm.norm(at);
        cells.push(cell);
        const o = war.original[k];             // as compiled: names and mode characters
        orig.push(OP[o.op]);
        const key = insKey(OP[o.op], MOD[o.mod], MODES.indexOf(o.aMode), MODES.indexOf(o.bMode), vm.norm(o.a), vm.norm(o.b), vm.size);
        this.programs.set(key, (this.programs.get(key) ?? 0) | (1 << w));
        this.partW[cell] = w;
        this.partI[cell] = i;
      }
      return {
        index: w,
        name: war.name,
        cells, orig,
        origKind: orig.map(kindOf),
        kind: orig.map(kindOf),                // shape now: changes when converted
        damage: new Array(n).fill(null),
        enemy: new Int8Array(n).fill(-1),      // who holds the part (-1: still ours)
        active: new Float32Array(n),           // 1: just ran, fading to 0
        procs: new Uint16Array(n),             // processes sitting on each part
        lastHit: new Float64Array(n).fill(-Infinity),
        lastHitBy: new Int8Array(n).fill(-1),
        alive: true, diedAt: null, deadAt: 0, shake: -Infinity,
        total: 0, away: 0, possessed: 0, captor: -1,
        integrity: 1,
        capture: 0, lastCaptor: -1, converted: false, morph: 0, morphTo: -1,
      };
    });
  }

  // The body part at a cell, or null.
  partAt(cell) {
    const w = this.partW?.[cell] ?? -1;
    return w >= 0 ? { w, i: this.partI[cell] } : null;
  }

  // Hit events since the last call: [cell, attacker, victim, kind] groups.
  // Bursts are sampled: kills first, then hits on bodies, then a few others.
  ingest(vm, events, now) {
    if (vm !== this.vm) this.build(vm);
    if (!events || !events.length) return;
    const kills = [], body = [], rest = [];
    for (let k = 0; k < events.length; k += 4) {
      if (events[k + 3] === 1) kills.push(k);
      else if (this.partW[events[k]] === events[k + 2]) body.push(k);
      else rest.push(k);
    }
    const picked = kills.slice(0, 4).concat(body.slice(0, PER_UPDATE));
    const stride = Math.max(1, rest.length / 3);
    for (let j = 0; j < rest.length && picked.length < PER_UPDATE + 4; j += stride) picked.push(rest[Math.floor(j)]);
    for (const k of picked) {
      const cell = events[k], attacker = events[k + 1], victim = events[k + 2], kind = events[k + 3];
      const onBody = this.partW[cell] === victim;
      const to = { w: victim, i: onBody ? this.partI[cell] : -1 };
      if (kind === 1) {
        // A process died on the attacker's code: no flight, the blow lands now.
        this.hits.push({ from: { w: attacker, i: -1 }, to, kind: 'kill', attacker, minor: false, cell, t: now });
        if (this.bodies[victim]) this.bodies[victim].shake = now;
        continue;
      }
      const wpc = vm.writerPc[cell];
      const from = { w: attacker, i: wpc >= 0 && this.partW[wpc] === attacker ? this.partI[wpc] : -1 };
      const dmg = onBody ? damageOf(vm.op[cell], this.bodies[victim].orig[to.i]) : vm.op[cell] === OP.DAT ? 'bombed' : 'converted';
      this.hits.push({ from, to, kind: dmg, attacker, minor: !onBody, cell, t: now });
    }
    if (this.hits.length > MAX_PENDING) this.hits.splice(0, this.hits.length - MAX_PENDING);
  }

  // The hits since the last call, for the renderer to animate.
  takeHits() {
    const h = this.hits;
    this.hits = [];
    return h;
  }

  // Refresh every body from the VM. `recentSteps`: how many steps back a
  // part still counts as just run. Smoothing runs on `now` (milliseconds).
  update(vm, now, recentSteps = 400) {
    if (vm !== this.vm) this.build(vm);
    const dt = this.last ? Math.min(250, Math.max(0, now - this.last)) : 16;
    this.last = now;
    // Counting the processes and parts reads the whole queue: only when the
    // VM has moved (or the fade changed). The smoothing runs every call.
    const scan = vm.steps !== this.scannedSteps || recentSteps !== this.scannedRecent;
    this.scannedSteps = vm.steps;
    this.scannedRecent = recentSteps;
    for (let w = 0; w < this.bodies.length; w++) {
      if (scan) this.census(vm, w, now, Math.max(1, recentSteps));
      this.smooth(vm, w, dt);
    }
  }

  // A process is captive when the instruction it is on is not from its own
  // program and either an enemy wrote it or it is from an enemy's program: a
  // process that runs imp code writes half the cells it runs itself.
  census(vm, w, now, recent) {
    const b = this.bodies[w];
    const war = vm.warriors[w];
    const n = vm.size, own = 1 << w;
    b.procs.fill(0);
    let away = 0, possessed = 0;
    const by = new Map();
    for (const pc of war.queue) {
      if (this.partW[pc] === w) b.procs[this.partI[pc]]++;
      else away++;
      const mask = this.programs.get(insKey(vm.op[pc], vm.mod[pc], vm.aMode[pc], vm.bMode[pc], vm.a[pc], vm.b[pc], n)) ?? 0;
      if (mask & own) continue;
      const o = vm.owner[pc];
      const captor = o >= 0 && o !== w ? o : mask ? 31 - Math.clz32(mask & -mask) : -1;
      if (captor >= 0) { possessed++; by.set(captor, (by.get(captor) ?? 0) + 1); }
    }
    let captor = -1, most = 0;
    for (const [o, c] of by) if (c > most) { most = c; captor = o; }
    b.total = war.queue.size;
    b.away = away;
    b.possessed = possessed;
    b.captor = captor;
    b.alive = war.alive;
    b.diedAt = war.diedAt;
    if (!war.alive && !b.deadAt) b.deadAt = now;
    if (war.alive) b.deadAt = 0;

    // The parts, and how much of the body is still ours.
    let lost = 0;
    for (let i = 0; i < b.cells.length; i++) {
      const cell = b.cells[i];
      const o = vm.owner[cell];
      const enemy = o >= 0 && o !== w ? o : -1;
      const cur = vm.op[cell];
      const dmg = enemy >= 0 ? damageOf(cur, b.orig[i]) : null;
      if (enemy >= 0) lost++;
      b.enemy[i] = enemy;
      b.damage[i] = dmg;
      b.kind[i] = dmg === 'converted' ? kindOf(cur) : enemy >= 0 ? b.origKind[i] : kindOf(cur);
      b.active[i] = war.alive ? Math.max(0, 1 - (vm.steps - vm.lastExec[cell]) / recent) : 0;
    }
    b.integrity = 1 - lost / b.cells.length;
    b.share = war.alive && b.total ? most / b.total : 0;
  }

  // Conversion: the captive share, smoothed (a captured imp's instant share
  // flickers), with hysteresis so the change of body doesn't flap.
  smooth(vm, w, dt) {
    const b = this.bodies[w];
    const war = vm.warriors[w];
    const share = b.share ?? 0;
    b.capture += (share - b.capture) * (1 - Math.exp(-dt / CAPTURE_MS));
    if (b.captor >= 0 && share > 0) b.lastCaptor = b.captor;
    if (b.capture > 0.4) b.converted = true;
    else if (b.capture < 0.15 || !war.alive) b.converted = false;
    b.morph += ((b.converted ? 1 : 0) - b.morph) * (1 - Math.exp(-dt / MORPH_MS));
    if (b.converted) b.morphTo = b.lastCaptor;
  }

  // One line for a warrior's label.
  status(vm, w) {
    const b = this.bodies[w];
    const war = vm.warriors[w];
    if (vm.done && war.alive && vm.warriors.filter((x) => x.alive).length === 1) return '★ winner';
    if (!war.alive) return `KO at cycle ${war.diedAt?.toLocaleString() ?? '?'}`;
    if (b.morph > 0.5 && b.morphTo >= 0) return `converted → ${vm.warriors[b.morphTo]?.name ?? '?'}`;
    let s = `${b.total.toLocaleString()} proc · body ${Math.round(b.integrity * 100)}%`;
    if (b.capture > 0.05) s += ` · ${Math.round(100 * b.capture)}% captive`;
    return s;
  }
}
