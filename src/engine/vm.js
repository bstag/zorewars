// The ZoreWars virtual machine: a circular array of Redcode instructions
// shared by competing programs, each with its own FIFO queue of processes.
//
// The core is stored as parallel typed arrays (one per instruction field) so a
// round of 80,000 cycles runs quickly in both the browser and Node.

import { OPCODES, MODIFIERS, MODES, OP, MOD, MODE, DEFAULT_SETTINGS, pSpaceSizeFor } from './constants.js';
import { mulberry32 } from './random.js';
import { topologyFor } from './topology.js';
import { makeGeometry } from './geometry.js';

const { DAT, MOV, ADD, SUB, MUL, DIV, MOD: MODOP, JMP, JMZ, JMN, DJN, SPL, SLT, SEQ, SNE, NOP, LDP, STP, TRN } = OP;
const { A, B, AB, BA, F, X, I } = MOD;

// Each process is a program counter and, on a torus, a heading: the axis
// and direction its code flows in (0..5 = +x -x +y -y +z -z; always 0 on the
// classic ring). push() stores the heading in `h`, which the VM sets to the
// running process's heading (TRN changes it); shift() leaves the heading of
// the process it returns in `lastH`.
class ProcessQueue {
  constructor(capacity) {
    this.buf = new Int32Array(capacity);
    this.heads = new Uint8Array(capacity);
    this.head = 0;
    this.size = 0;
    this.h = 0;
    this.lastH = 0;
  }
  push(pc) {
    if (this.size >= this.buf.length) return false;
    const i = (this.head + this.size) % this.buf.length;
    this.buf[i] = pc;
    this.heads[i] = this.h;
    this.size++;
    return true;
  }
  shift() {
    const pc = this.buf[this.head];
    this.lastH = this.heads[this.head];
    this.head = (this.head + 1) % this.buf.length;
    this.size--;
    return pc;
  }
  *[Symbol.iterator]() {
    for (let i = 0; i < this.size; i++) yield this.buf[(this.head + i) % this.buf.length];
  }
}

export class VM {
  constructor(settings = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    const n = this.settings.coreSize;
    this.size = n;
    // Torus battlefields: per-axis addressing and arithmetic (geometry.js).
    // null on the classic ring, where everything is plain modular arithmetic.
    this.geo = makeGeometry(this.settings);
    // One step along each heading (+x -x +y -y +z -z), as stored numbers.
    this.headingStep = this.geo ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([x, y, z]) => this.geo.encode(x, y, z)) : null;
    this.curH = 0;
    this.op = new Uint8Array(n);
    this.mod = new Uint8Array(n);
    this.aMode = new Uint8Array(n);
    this.bMode = new Uint8Array(n);
    this.a = new Int32Array(n);
    this.b = new Int32Array(n);
    // Forensics for the arena and post-mortems: who last wrote each cell,
    // when (step and cycle), and which instruction did it (-1: loaded).
    this.owner = new Int8Array(n);
    this.lastWrite = new Float64Array(n);
    this.lastExec = new Float64Array(n);
    this.writerPc = new Int32Array(n);
    this.writeCycle = new Int32Array(n);
    this.clear();
  }

  clear() {
    this.op.fill(DAT);
    this.mod.fill(F);
    this.aMode.fill(MODE.DIRECT);
    this.bMode.fill(MODE.DIRECT);
    this.a.fill(0);
    this.b.fill(0);
    this.owner.fill(-1);
    this.lastWrite.fill(-Infinity);
    this.lastExec.fill(-Infinity);
    this.writerPc.fill(-1);
    this.writeCycle.fill(-1);
    this.curPc = -1;
    this.contacts = [];          // first write by each warrior into another's memory
    this.contactSeen = new Set();
    this.trace = this.traceSize ? [] : null;
    this.warriors = [];
    this.turn = 0;
    this.cycle = 0;
    this.steps = 0;
    this.done = false;
    this.winner = null;
    this.aliveCount = 0;
  }

  // Load compiled warriors. `options.positions` may fix load addresses;
  // otherwise they are chosen randomly (warrior 0 at address 0).
  // `options.pspaces` passes each warrior's P-space from earlier rounds;
  // without it every warrior starts with fresh P-space whose cell 0 is -1.
  load(compiled, options = {}) {
    this.clear();
    const { maxProcesses, maxLength } = this.settings;
    const rng = mulberry32(options.seed ?? (Math.random() * 2 ** 32) >>> 0);
    const positions = options.positions || this.placeWarriors(compiled, rng);
    compiled.forEach((w, i) => {
      if (w.instructions.length > maxLength) {
        throw new Error(`${w.name} is ${w.instructions.length} instructions long (max ${maxLength})`);
      }
      const base = positions[i];
      const at = (k) => (this.geo ? this.geo.add(base, k) : base + k);   // code runs along x
      w.instructions.forEach((ins, k) => this.poke(at(k), ins, i));
      const queue = new ProcessQueue(maxProcesses);
      queue.push(this.norm(at(w.start)));
      const pspace = options.pspaces?.[i] || VM.freshPSpace(this.settings);
      this.warriors.push({
        index: i,
        name: w.name,
        author: w.author,
        position: base,
        length: w.instructions.length,
        queue,
        alive: true,
        diedAt: null,
        pspace,
        original: w.instructions.map(({ op, mod, aMode, a, bMode, b }) => ({ op, mod, aMode, a, bMode, b })),
        start: w.start,
        peak: 1,
        deaths: { total: 0, ownCode: 0, enemyCode: 0, emptyCore: 0, divideByZero: 0 },
        lastDeath: null,
        foreignSteps: 0,   // instructions run that another warrior wrote
        foreignFirst: null,
      });
    });
    this.aliveCount = this.warriors.length;
    // Instruction budget for the round, counted the way pMARS counts it:
    // maxCycles turns for every warrior, rescaled when a warrior dies.
    this.budget = this.settings.maxCycles * this.warriors.length;
    this.turn = (options.firstTurn ?? 0) % Math.max(1, this.warriors.length);
    return positions;
  }

  static pSpaceSize(settings) {
    return pSpaceSizeFor(settings);
  }

  static freshPSpace(settings) {
    const ps = new Int32Array(VM.pSpaceSize(settings));
    ps[0] = settings.coreSize - 1; // -1: no previous round
    return ps;
  }

  // After a round, P-space cell 0 tells each warrior how it went:
  // 0 if it lost, otherwise the number of warriors that survived.
  recordResults() {
    const survivors = this.warriors.filter((w) => w.alive).length;
    for (const w of this.warriors) w.pspace[0] = w.alive ? survivors : 0;
  }

  // Random load positions (used when none are given), from the topology.
  placeWarriors(compiled, rng) {
    const [positions] = topologyFor(this.settings).place(compiled.length, 1 + Math.floor(rng() * 2147483645));
    return positions;
  }

  norm(x) {
    const n = this.size;
    x %= n;
    return x < 0 ? x + n : x;
  }

  poke(addr, ins, owner = -1) {
    const p = this.norm(addr);
    this.op[p] = typeof ins.op === 'number' ? ins.op : OP[ins.op];
    this.mod[p] = typeof ins.mod === 'number' ? ins.mod : MOD[ins.mod];
    this.aMode[p] = typeof ins.aMode === 'number' ? ins.aMode : MODES.indexOf(ins.aMode);
    this.bMode[p] = typeof ins.bMode === 'number' ? ins.bMode : MODES.indexOf(ins.bMode);
    this.a[p] = this.norm(ins.a);
    this.b[p] = this.norm(ins.b);
    this.owner[p] = owner;
  }

  peek(addr) {
    const p = this.norm(addr);
    return {
      op: OPCODES[this.op[p]],
      mod: MODIFIERS[this.mod[p]],
      aMode: MODES[this.aMode[p]],
      a: this.a[p],
      bMode: MODES[this.bMode[p]],
      b: this.b[p],
    };
  }

  // Human-readable instruction at an address, with fields shown signed.
  disassemble(addr) {
    const i = this.peek(addr);
    const s = this.geo ? this.geo.format : (v) => (v > this.size / 2 ? v - this.size : v);
    return `${i.op}.${i.mod} ${i.aMode}${s(i.a)}, ${i.bMode}${s(i.b)}`;
  }

  processes(w) {
    return [...this.warriors[w].queue];
  }

  // Execute one instruction for the warrior whose turn it is.
  // Returns { warrior, pc, killed } or null when the round is over.
  step() {
    if (this.done || this.warriors.length === 0) return null;
    const w = this.turn;
    const warrior = this.warriors[w];
    const pc = warrior.queue.shift();
    this.curH = warrior.queue.lastH;      // heading of this process...
    warrior.queue.h = this.curH;          // ...which its successors keep (TRN changes it)
    this.steps++;
    this.curPc = pc;

    // Running code another warrior wrote: the classic "conversion".
    const codeOwner = this.owner[pc];
    if (codeOwner >= 0 && codeOwner !== w) {
      warrior.foreignSteps++;
      if (!warrior.foreignFirst) warrior.foreignFirst = { cycle: this.cycle, pc, owner: codeOwner, instruction: this.disassemble(pc) };
    }
    if (this.trace) {
      this.trace.push({ step: this.steps, cycle: this.cycle, warrior: w, pc, instruction: this.disassemble(pc), processes: warrior.queue.size + 1 });
      if (this.trace.length > this.traceSize) this.trace.shift();
    }
    const writerPc = this.writerPc[pc], writeCycle = this.writeCycle[pc];

    const killed = this.execute(w, pc, warrior.queue);

    if (killed) {
      const isDat = this.op[pc] === DAT;
      const cause = !isDat ? 'divideByZero' : codeOwner === w ? 'ownCode' : codeOwner < 0 ? 'emptyCore' : 'enemyCode';
      warrior.deaths.total++;
      warrior.deaths[cause]++;
      warrior.lastDeath = { cycle: this.cycle, step: this.steps, pc, instruction: this.disassemble(pc), cause, codeOwner, writerPc, writeCycle };
      if (this.trace) this.trace.at(-1).died = cause;
    }
    if (warrior.queue.size > warrior.peak) warrior.peak = warrior.queue.size;

    let died = false;
    if (warrior.queue.size === 0) {
      warrior.alive = false;
      warrior.diedAt = this.cycle;
      died = true;
    }
    // pMARS: when a warrior dies, the remaining budget is scaled so the
    // survivors keep the same number of turns each.
    if (died && this.aliveCount >= 2) {
      this.budget = this.budget - 1 - Math.floor((this.budget - 1) / this.aliveCount);
    }
    if (died) this.aliveCount--;
    this.budget--;

    // Pass the turn to the next living warrior; a full lap is one cycle.
    const n = this.warriors.length;
    let next = w;
    for (let k = 1; k <= n; k++) {
      const c = (w + k) % n;
      if (this.warriors[c].alive) { next = c; break; }
    }
    if (next <= w) this.cycle++;
    this.turn = next;

    const multi = n > 1;
    if ((multi && this.aliveCount <= 1) || this.aliveCount === 0) {
      this.done = true;
      this.winner = multi && this.aliveCount === 1 ? this.warriors.findIndex((x) => x.alive) : null;
      if (!multi) this.winner = null;
    } else if (this.budget <= 0) {
      this.done = true;
      this.winner = null; // tie: survivors share the round
    }
    return { warrior: w, pc, killed };
  }

  run(maxSteps = Infinity) {
    let n = 0;
    while (!this.done && n < maxSteps) { this.step(); n++; }
    return n;
  }

  // Resolve one operand to an absolute address. Predecrements happen here;
  // a postincrement is only recorded in `this.postCell` / `this.postField`,
  // because ICWS'94 copies the operand's instruction register *before*
  // incrementing (see applyPostIncrement).
  resolve(mode, field, pc, w) {
    this.postCell = -1;
    if (mode === MODE.IMMEDIATE) return pc;
    if (this.geo) return this.resolveTorus(mode, field, pc, w);
    const n = this.size;
    const p = (pc + field) % n;
    if (mode === MODE.DIRECT) return p;
    const a = this.a, b = this.b;
    switch (mode) {
      case MODE.A_INDIRECT: return (p + a[p]) % n;
      case MODE.B_INDIRECT: return (p + b[p]) % n;
      case MODE.A_PREDEC:
        a[p] = (a[p] + n - 1) % n; this.touch(p, w);
        return (p + a[p]) % n;
      case MODE.B_PREDEC:
        b[p] = (b[p] + n - 1) % n; this.touch(p, w);
        return (p + b[p]) % n;
      case MODE.A_POSTINC:
        this.postCell = p; this.postField = this.a;
        return (p + a[p]) % n;
      case MODE.B_POSTINC:
        this.postCell = p; this.postField = this.b;
        return (p + b[p]) % n;
    }
    return p;
  }

  // The same, on a torus: offsets are added per axis; the pointer itself
  // still counts as a plain number (see geometry.js).
  resolveTorus(mode, field, pc, w) {
    const g = this.geo, n = this.size, a = this.a, b = this.b;
    const p = g.add(pc, field);
    switch (mode) {
      case MODE.DIRECT: return p;
      case MODE.A_INDIRECT: return g.add(p, a[p]);
      case MODE.B_INDIRECT: return g.add(p, b[p]);
      case MODE.A_PREDEC:
        a[p] = (a[p] + n - 1) % n; this.touch(p, w);
        return g.add(p, a[p]);
      case MODE.B_PREDEC:
        b[p] = (b[p] + n - 1) % n; this.touch(p, w);
        return g.add(p, b[p]);
      case MODE.A_POSTINC:
        this.postCell = p; this.postField = this.a;
        return g.add(p, a[p]);
      case MODE.B_POSTINC:
        this.postCell = p; this.postField = this.b;
        return g.add(p, b[p]);
    }
    return p;
  }

  applyPostIncrement(w) {
    const p = this.postCell;
    if (p < 0) return;
    this.postField[p] = (this.postField[p] + 1) % this.size;
    this.touch(p, w);
  }

  touch(addr, w) {
    const prev = this.owner[addr];
    if (prev >= 0 && prev !== w && !this.contactSeen.has(w * 64 + prev)) {
      this.contactSeen.add(w * 64 + prev);
      this.contacts.push({ attacker: w, victim: prev, cycle: this.cycle, step: this.steps, addr, pc: this.curPc, instruction: this.disassemble(this.curPc) });
    }
    this.owner[addr] = w;
    this.lastWrite[addr] = this.steps;
    this.writerPc[addr] = this.curPc;
    this.writeCycle[addr] = this.cycle;
  }

  // Keep the last `size` executed instructions (see the CLI's trace command).
  enableTrace(size) {
    this.traceSize = size;
    this.trace = [];
  }

  execute(w, pc, queue) {
    const n = this.size;
    const core = this;
    const opA = this.op, modA = this.mod, amA = this.aMode, bmA = this.bMode, fa = this.a, fb = this.b;
    this.lastExec[pc] = this.steps;

    // Snapshot of the instruction register.
    const op = opA[pc], mod = modA[pc], am = amA[pc], bm = bmA[pc], ia = fa[pc], ib = fb[pc];

    const aPtr = this.resolve(am, ia, pc, w);
    // A-instruction register (copied before the B operand is evaluated).
    const sOp = opA[aPtr], sMod = modA[aPtr], sAm = amA[aPtr], sBm = bmA[aPtr];
    const aA = fa[aPtr], aB = fb[aPtr];
    this.applyPostIncrement(w);

    const bPtr = this.resolve(bm, ib, pc, w);
    const bA = fa[bPtr], bB = fb[bPtr];
    this.applyPostIncrement(w);

    // The next instruction is one step along the process's heading.
    const g = this.geo;
    const step = g ? this.headingStep[this.curH] : 1;
    const next = g ? g.add(pc, step) : (pc + 1) % n;
    const skipTo = g ? g.add(next, step) : (pc + 2) % n;
    let killed = false;

    const arith = (fn) => {
      // fn returns null for division by zero: that field is left unchanged
      // and the process dies.
      let ok = true;
      const setA = (v) => { if (v === null) ok = false; else fa[bPtr] = v; };
      const setB = (v) => { if (v === null) ok = false; else fb[bPtr] = v; };
      switch (mod) {
        case A: setA(fn(bA, aA)); break;
        case B: setB(fn(bB, aB)); break;
        case AB: setB(fn(bB, aA)); break;
        case BA: setA(fn(bA, aB)); break;
        case X: setA(fn(bA, aB)); setB(fn(bB, aA)); break;
        default: setA(fn(bA, aA)); setB(fn(bB, aB)); break; // F, I
      }
      core.touch(bPtr, w);
      if (ok) queue.push(next); else killed = true;
    };

    switch (op) {
      case DAT:
        killed = true;
        break;

      case MOV:
        switch (mod) {
          case A: fa[bPtr] = aA; break;
          case B: fb[bPtr] = aB; break;
          case AB: fb[bPtr] = aA; break;
          case BA: fa[bPtr] = aB; break;
          case F: fa[bPtr] = aA; fb[bPtr] = aB; break;
          case X: fa[bPtr] = aB; fb[bPtr] = aA; break;
          case I:
            opA[bPtr] = sOp; modA[bPtr] = sMod; amA[bPtr] = sAm; bmA[bPtr] = sBm;
            fa[bPtr] = aA; fb[bPtr] = aB;
            break;
        }
        this.touch(bPtr, w);
        queue.push(next);
        break;

      case ADD: arith(g ? g.add : (x, y) => (x + y) % n); break;
      case SUB: arith(g ? g.sub : (x, y) => (x - y + n) % n); break;
      case MUL: arith(g ? g.mul : (x, y) => (x * y) % n); break;
      case DIV: arith(g ? g.div : (x, y) => (y === 0 ? null : Math.floor(x / y))); break;
      case MODOP: arith(g ? g.mod : (x, y) => (y === 0 ? null : x % y)); break;

      case JMP:
        queue.push(aPtr);
        break;

      case JMZ:
      case JMN: {
        let zero;
        switch (mod) {
          case A: case BA: zero = bA === 0; break;
          case B: case AB: zero = bB === 0; break;
          default: zero = bA === 0 && bB === 0; // F, X, I: both fields
        }
        const jump = op === JMZ ? zero : !zero;
        queue.push(jump ? aPtr : next);
        break;
      }

      case DJN: {
        let nonZero;
        const dec = (v) => (v + n - 1) % n;
        switch (mod) {
          case A: case BA: {
            const v = dec(bA); fa[bPtr] = dec(fa[bPtr]); nonZero = v !== 0; break;
          }
          case B: case AB: {
            const v = dec(bB); fb[bPtr] = dec(fb[bPtr]); nonZero = v !== 0; break;
          }
          default: {
            const va = dec(bA), vb = dec(bB);
            fa[bPtr] = dec(fa[bPtr]); fb[bPtr] = dec(fb[bPtr]);
            nonZero = va !== 0 || vb !== 0;
          }
        }
        this.touch(bPtr, w);
        queue.push(nonZero ? aPtr : next);
        break;
      }

      case SPL:
        queue.push(next);
        queue.push(aPtr); // silently dropped when the process table is full
        break;

      case SEQ:
      case SNE: {
        let eq;
        switch (mod) {
          case A: eq = aA === bA; break;
          case B: eq = aB === bB; break;
          case AB: eq = aA === bB; break;
          case BA: eq = aB === bA; break;
          case F: eq = aA === bA && aB === bB; break;
          case X: eq = aA === bB && aB === bA; break;
          case I:
            eq = aA === bA && aB === bB && sOp === opA[bPtr] && sMod === modA[bPtr] &&
              sAm === amA[bPtr] && sBm === bmA[bPtr];
            break;
        }
        const skip = op === SEQ ? eq : !eq;
        queue.push(skip ? skipTo : next);
        break;
      }

      case SLT: {
        let lt;
        switch (mod) {
          case A: lt = aA < bA; break;
          case B: lt = aB < bB; break;
          case AB: lt = aA < bB; break;
          case BA: lt = aB < bA; break;
          case X: lt = aA < bB && aB < bA; break;
          default: lt = aA < bA && aB < bB; break; // F, I
        }
        queue.push(lt ? skipTo : next);
        break;
      }

      case NOP:
        queue.push(next);
        break;

      case TRN: { // turn: face along A, relative to this instruction (torus only)
        if (!g) { queue.push(next); break; }   // the assembler refuses TRN on the ring
        const [dx, dy, dz] = g.decode(g.sub(aPtr, pc));
        const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
        let h = this.curH;                       // a zero vector leaves the heading alone
        if (ax || ay || az) {
          if (ax >= ay && ax >= az) h = dx > 0 ? 0 : 1;
          else if (ay >= az) h = dy > 0 ? 2 : 3;
          else h = dz > 0 ? 4 : 5;
        }
        queue.h = h;
        queue.push(g.add(pc, this.headingStep[h]));
        break;
      }

      case LDP: { // load from P-space: index from A, into a field of B
        const ps = this.warriors[w].pspace;
        const fromB = mod === B || mod === BA || mod === F || mod === X || mod === I;
        const value = ps[(fromB ? aB : aA) % ps.length];
        if (mod === A || mod === BA) fa[bPtr] = value; else fb[bPtr] = value;
        this.touch(bPtr, w);
        queue.push(next);
        break;
      }

      case STP: { // store to P-space: value from A, index from B
        const ps = this.warriors[w].pspace;
        const value = mod === A || mod === AB ? aA : aB;
        const index = mod === A || mod === BA ? bA : bB;
        ps[index % ps.length] = value;
        queue.push(next);
        break;
      }
    }
    return killed;
  }
}
