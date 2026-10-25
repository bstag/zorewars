import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, runMatch, measureSpecies, topologyFor, VM, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { makeGeometry } from '../src/engine/geometry.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const torus = (x, y, z = 1) => ({ ...DEFAULT_SETTINGS, topology: 'torus', sizeX: x, sizeY: y, sizeZ: z, coreSize: x * y * z });
const PLANE = torus(100, 80);

test('geometry: every number is exactly one point, and steps wrap per axis', () => {
  for (const s of [torus(100, 80), torus(20, 20, 20), torus(7, 3, 5)]) {
    const g = makeGeometry(s);
    for (let v = 0; v < g.N; v++) { const [x, y, z] = g.decode(v); assert.equal(g.encode(x, y, z), v); }
  }
  const g = makeGeometry(PLANE);
  assert.deepEqual(g.decode(-1 + 8000), [-1, 0, 0]);               // -1 is still "one cell back"
  assert.deepEqual(g.decode(g.encode(0, 1)), [0, 1, 0]);
  assert.deepEqual(g.decode(g.add(g.encode(49, 0), 1)), [-50, 0, 0]);   // wraps within the row
  assert.deepEqual(g.decode(g.add(g.encode(0, 39), g.encode(0, 1))), [0, -40, 0]);
  assert.equal(g.div(5, 0), null);                                   // all-zero divisor kills
  assert.equal(g.format(g.encode(3, -2)), '[3,-2]');
});

test('torus(8000,1,1) is the classic ring: identical battles for the library', () => {
  const ring = { ...DEFAULT_SETTINGS };
  const line = torus(8000, 1);
  const list = JSON.parse(read('warriors/index.json')).filter((e) => (e.language === 'redcode' || e.language === 'javascript') && e.benchmark !== false);
  const ws = list.map((e) => ({ name: e.name, r: compile(read(`warriors/${e.file}`), e.language, ring), t: compile(read(`warriors/${e.file}`), e.language, line) }));
  for (const w of ws) assert.deepEqual(w.t.instructions, w.r.instructions, `${w.name} assembles differently`);
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
    const a = runMatch([ws[i].r, ws[j].r], { ...ring, rounds: 2 }, { seed: 7 + i * 50 + j });
    const b = runMatch([ws[i].t, ws[j].t], { ...line, rounds: 2 }, { seed: 7 + i * 50 + j });
    for (const [k, ra] of a.rounds.entries()) {
      const rb = b.rounds[k];
      assert.deepEqual([rb.winner, rb.cycles, rb.positions], [ra.winner, ra.cycles, ra.positions], `${ws[i].name} vs ${ws[j].name}, round ${k + 1}`);
    }
  }
});

test('assembler: vector literals, SIZEX/SIZEY, and a clear error on the ring', () => {
  const w = compile('MOV.I $0, $[0,1]\nDAT #SIZEX, #SIZEY', 'redcode', PLANE);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const g = makeGeometry(PLANE);
  assert.deepEqual(g.decode(w.instructions[0].b), [0, 1, 0]);
  assert.deepEqual([w.instructions[1].a, w.instructions[1].b], [100, 80]);
  const ring = compile('MOV.I $0, $[0,1]');
  assert.ok(!ring.ok && /torus/.test(ring.errors[0].message));
  assert.ok(compile('MOV.I $0, $[1,0]').ok);                        // an x-only vector is fine anywhere
});

test('the plane: code flows along rows, and fixed steps cover only a stripe', () => {
  // An imp circles its own row: 100 cells, never 8000.
  const imp = measureSpecies(compile('MOV.I 0, 1', 'redcode', PLANE), PLANE);
  assert.equal(imp.coverage, 100);
  // No single step visits every cell of Z100 x Z80 (it isn't cyclic): at most lcm(100,80) = 400.
  const g = makeGeometry(PLANE);
  let longest = 0;
  for (const s of [1, 3, 7, 99, g.encode(1, 1), g.encode(3, 7), g.encode(13, 11)]) {
    const seen = new Set();
    for (let p = 0; !seen.has(p); p = g.add(p, s)) seen.add(p);
    longest = Math.max(longest, seen.size);
  }
  assert.equal(longest, 400);
  // Warriors load on different rows, a quarter of the longest axis apart.
  const t = topologyFor(PLANE);
  let seed = 5;
  for (let r = 0; r < 50; r++) {
    const [[a, b], next] = t.place(2, seed);
    seed = next;
    assert.notEqual(g.position(a)[1], g.position(b)[1]);
    assert.ok(t.distance(a, b) >= 25);
  }
});

test('plane warriors work on the plane and say so on the ring', () => {
  for (const f of ['plaid', 'climber', 'planesilk', 'raster', 'columnimp', 'pillar', 'weave']) {
    const src = read(`warriors/plane/${f}.js`);
    const onRing = compile(src, 'javascript');
    assert.ok(!onRing.ok && /is for a plane/.test(onRing.errors[0].message), `${f} on the ring`);
    const w = compile(src, 'javascript', PLANE);
    assert.ok(w.ok, `${f}: ${JSON.stringify(w.errors)}`);
    assert.ok(measureSpecies(w, PLANE).survives, `${f} kills itself alone`);
  }
  // Climber really travels vertically: it runs code on many different rows.
  const climber = compile(read('warriors/plane/climber.js'), 'javascript', PLANE);
  assert.ok(measureSpecies(climber, PLANE).coverage > 300);
});

test('headings: TRN turns a process along the dominant axis, and the ring refuses TRN', () => {
  const g = makeGeometry(PLANE);
  // Column Imp: after TRN the process runs down its column, 80 cells (plus the launcher).
  const cimp = measureSpecies(compile(read('warriors/plane/columnimp.js'), 'javascript', PLANE), PLANE);
  assert.equal(cimp.coverage, 81);
  // TRN takes the dominant axis of its operand.
  const w = compile(`
        TRN $[0,-5]          ; face up (-y): dominant axis y, negative
        SPL $[0,-2]          ; a child at 2 rows up, still facing up
        DAT 0                ; never reached by this process: its next cell is above
  `, 'redcode', PLANE);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(PLANE);
  vm.load([w], { positions: [g.encode(0, 10)] });
  vm.step();                                           // TRN
  const [pc] = [...vm.warriors[0].queue];
  assert.deepEqual(g.decode(pc), [0, 9, 0]);           // moved up one row, not right
  assert.ok(!compile('TRN $[0,1]').ok);                // the ring has no headings
  assert.match(compile('TRN $[0,1]').errors[0].message, /torus/);
});

test('the VM agrees with an independent reference interpreter on random programs (2D and 3D)', async () => {
  const { fuzz } = await import('../scripts/plane-fuzz.js');
  const r = fuzz({ programs: 200, steps: 400, seed: 11 });
  assert.ok(r.ok, r.ok ? '' : `program ${r.program} (${r.shape}) step ${r.step}: ${r.diff.join('; ')}`);
  assert.ok(r.compared > 5000, `only ${r.compared} steps compared`);
});

test('on a torus a warrior is at most half a row long, so labels stay on their row', () => {
  const long = Array.from({ length: 51 }, () => 'NOP').join('\n');
  const w = compile(long, 'redcode', PLANE);
  assert.ok(!w.ok && /half a row/.test(w.errors[0].message));
  assert.ok(compile(Array.from({ length: 50 }, () => 'NOP').join('\n'), 'redcode', PLANE).ok);
});

test('3D: a volume runs warriors along all three axes', () => {
  const VOL = torus(40, 20, 10);
  const lift = measureSpecies(compile(read('warriors/volume/lift.js'), 'javascript', VOL), VOL);
  assert.equal(lift.coverage, 11);                      // the 10 layers of its z line, plus the launcher
  const star = measureSpecies(compile(read('warriors/volume/star.js'), 'javascript', VOL), VOL);
  assert.ok(star.survives && star.coverage > 60);      // a row, a column and a depth line
  const g = makeGeometry(VOL);
  assert.equal(g.maxCodeLength, 20);                   // half a row of 40
  for (const f of ['lift', 'star', 'volumesilk']) {
    assert.ok(!compile(read(`warriors/volume/${f}.js`), 'javascript', PLANE).ok, `${f} needs depth`);
  }
});

test('battle events: the VM reports overrides and kills for the highlights, only when asked', () => {
  const ws = ['warriors/twopass.red', 'warriors/plane/planesilk.js'].map((f) => compile(read(f), f.endsWith('.js') ? 'javascript' : 'redcode', PLANE));
  const vm = new VM(PLANE);
  vm.enableEvents();
  vm.load(ws, { seed: 4 });
  const seen = { 0: 0, 1: 0 };
  for (let s = 0; s < 60000 && !vm.done; s++) {
    vm.step();
    const e = vm.takeEvents();
    for (let k = 0; k < e.length; k += 4) {
      const [cell, attacker, victim, kind] = e.slice(k, k + 4);
      assert.ok(cell >= 0 && cell < vm.size && attacker !== victim);
      seen[kind]++;
    }
  }
  assert.ok(seen[0] > 0, 'overrides reported');
  assert.ok(seen[1] > 0, 'kills reported');
  const quiet = new VM(PLANE);
  quiet.load(ws, { seed: 4 });
  for (let s = 0; s < 1000; s++) quiet.step();
  assert.equal(quiet.takeEvents(), null);               // not collected unless enabled
});

test('fitsBattlefield: which library warriors can play where', async () => {
  const { fitsBattlefield } = await import('../src/engine/index.js');
  const VOL = torus(40, 20, 10);
  const fits = (f, s) => fitsBattlefield(compile(read(`warriors/${f}`), f.endsWith('.js') ? 'javascript' : 'redcode', s), s);
  assert.ok(fits('imp.red', {}) && fits('imp.red', VOL));          // runs anywhere
  assert.ok(!fits('hedgehog.js', VOL));                             // 85 instructions: too long for half a 40-cell row
  assert.ok(!fits('impring.red', PLANE));                           // ring arithmetic: destroys itself on the plane
  assert.ok(!fits('volume/star.js', {}) && fits('volume/star.js', VOL));
});

test('3D warriors: each survives alone on its battlefield and beats Dwarf there', () => {
  const VOL = torus(40, 20, 10), WIDE = torus(80, 10, 10);
  for (const [f, s] of [['slant', VOL], ['battleship', VOL], ['broadside', VOL], ['volumequeen', VOL], ['leapfrog', VOL], ['scatter', VOL], ['fleet', WIDE], ['volumechameleon', WIDE], ['antichameleon', WIDE], ['adapter', WIDE]]) {
    const w = compile(read(`warriors/volume/${f}.js`), 'javascript', s);
    assert.ok(w.ok, `${f} compiles`);
    assert.ok(measureSpecies(w, s).survives, `${f} survives alone`);
    const r = runMatch([w, compile(read('warriors/dwarf.red'), 'redcode', s)], { ...s, rounds: 6 }, { seed: 7 });
    assert.ok(r.warriors[0].score > r.warriors[1].score, `${f} beats Dwarf`);
  }
  assert.ok(!compile(read('warriors/volume/fleet.js'), 'javascript', VOL).ok);
  // Leapfrog sees a clear coming and leaps behind it: it beats Volume Queen
  const lf = compile(read('warriors/volume/leapfrog.js'), 'javascript', VOL);
  const vq = compile(read('warriors/volume/volumequeen.js'), 'javascript', VOL);
  const m = runMatch([lf, vq], { ...VOL, rounds: 6 }, { seed: 11 });
  assert.ok(m.warriors[0].wins >= 4, `Leapfrog vs Volume Queen ${m.warriors[0].wins}-${m.warriors[0].losses}`);
  // Anti-Chameleon reads Volume Chameleon's switching and stays a step ahead
  const ac = compile(read('warriors/volume/antichameleon.js'), 'javascript', WIDE);
  const vc = compile(read('warriors/volume/volumechameleon.js'), 'javascript', WIDE);
  const n = runMatch([ac, vc], { ...WIDE, rounds: 10 }, { seed: 5 });
  assert.ok(n.warriors[0].wins >= 6 && n.warriors[0].wins >= 2 * n.warriors[0].losses, `Anti-Chameleon vs Volume Chameleon ${n.warriors[0].wins}-${n.warriors[0].losses}`);   // 31 instructions: more than half a 40-cell row
});

test('prototypes: every 3D prototype still compiles on its battlefield', () => {
  const field = (f) => /^(sentry|fleet-scatter|bullfrog|dodgingqueen|scannerswarm|shieldswarm)/.test(f) ? torus(80, 10, 10) : /coprime/.test(f) ? torus(41, 20, 9) : torus(40, 20, 10);
  const files = fs.readdirSync(path.join(root, 'warriors/prototypes')).filter((f) => /\.(js|red)$/.test(f));
  assert.ok(files.length >= 22);
  for (const f of files) {
    const w = compile(read(`warriors/prototypes/${f}`), f.endsWith('.js') ? 'javascript' : 'redcode', field(f));
    assert.ok(w.ok, `${f}: ${JSON.stringify(w.errors)}`);
  }
});
