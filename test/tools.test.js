import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, runMatch, measureSpecies, speciesAxes, diagnoseRounds } from '../src/engine/index.js';
import { parseTunable, withConstants } from '../tools/tune.js';
import { makeGenePool, makeOperators, genomeOf, graft, toWarrior, toRedcode, roleOf, randomGenome } from '../tools/genes.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const warrior = (f) => {
  const w = compile(read(`warriors/${f}`), f.endsWith('.js') ? 'javascript' : 'redcode');
  assert.ok(w.ok, `${f}: ${JSON.stringify(w.errors)}`);
  return w;
};

test('smooth score: wins and ties as usual, a loss is the share of the round survived', () => {
  const m = runMatch([warrior('dwarf.red'), warrior('silk.red')], { rounds: 6 }, { seed: 3 });
  for (const [i, s] of m.warriors.entries()) {
    let expect = 0;
    for (const r of m.rounds) {
      if (r.survivors.includes(i)) expect += r.winner === i ? 3 : 1;
      else expect += r.diedAt[i] / 80000;
    }
    assert.ok(Math.abs(s.smooth - expect) < 1e-3, `${s.name}: ${s.smooth} vs ${expect}`);
    assert.ok(s.smooth >= s.score, 'never below the normal score');
    if (s.losses) assert.ok(s.smooth < s.score + s.losses, 'each loss adds less than a tie');
  }
});

test('species: imps cover the core with one process, papers hit the process limit', () => {
  const imp = measureSpecies(warrior('imp.red'));
  assert.deepEqual([imp.processes, imp.coverage, imp.key], [1, 8000, '0,5']);
  const silk = measureSpecies(warrior('silk.red'));
  assert.equal(silk.processes, 8000);
  assert.equal(silk.cell[0], speciesAxes().processes.edges.length);   // the "max" column
  assert.equal(silk.hint, 'paper (replicator)');
  const dwarf = measureSpecies(warrior('dwarf.red'));
  assert.equal(dwarf.key, '0,0');
  assert.ok(dwarf.survives);
  const suicide = measureSpecies(compile('DAT 0'));
  assert.equal(suicide.survives, false);
});

test('loss diagnosis sorts every non-win into one symptom', () => {
  const m = runMatch([warrior('dwarf.red'), warrior('silk.red')], { rounds: 8 }, { seed: 5, report: true });
  const d = diagnoseRounds(m.rounds, 0);
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  assert.equal(total, m.warriors[0].losses + m.warriors[0].ties);
  assert.equal(d.tie, m.warriors[0].ties);
});

test('every tuned library bot declares a SPACE that its constants fit', () => {
  for (const f of ['gatekeeper.js', 'papercut.js', 'blitz.js', 'chameleon.js', 'bandit.js', 'hedgehog.js', 'hydra.js', 'fastsilk.js']) {
    const src = read(`warriors/${f}`);
    const { space, current } = parseTunable(src);
    for (const [k, v] of Object.entries(space)) {
      assert.ok(k in current, `${f}: ${k} missing from P`);
      if (v.length === 2 && v.every(Number.isInteger)) assert.ok(current[k] >= v[0] && current[k] <= v[1], `${f}: ${k}=${current[k]} outside ${v}`);
    }
    // Rewriting the constants changes the program and still compiles.
    const changed = withConstants(src, { ...current });
    assert.equal(compile(changed, 'javascript').instructions.length, compile(src, 'javascript').instructions.length);
  }
});

test('evolver genes: grafts keep both programs running and round-trip through Redcode', () => {
  assert.equal(roleOf('Silk paper'), 'paper');
  assert.equal(roleOf('CMP scanner'), 'scan');
  assert.equal(roleOf('Stone (bomber)'), 'stone');
  const dwarf = warrior('dwarf.red'), imp = warrior('imp.red');
  const g = graft(genomeOf(dwarf), genomeOf(imp));
  // an SPL in front, plus a JMP back to the old start when it wasn't line 0
  assert.equal(g.code.length, dwarf.instructions.length + (dwarf.start ? 2 : 1) + imp.instructions.length);
  const w = toWarrior(g);
  const back = compile(toRedcode(g, { name: 'Graft' }));
  assert.ok(back.ok, JSON.stringify(back.errors));
  assert.deepEqual(back.instructions.map((i) => `${i.op}.${i.mod} ${i.aMode}${(i.a + 8000) % 8000} ${i.bMode}${(i.b + 8000) % 8000}`),
    w.instructions.map((i) => `${i.op}.${i.mod} ${i.aMode}${i.a} ${i.bMode}${i.b}`));
  // Alone in the core both parts run: the imp crawls and the dwarf bombs.
  const s = measureSpecies(w);
  assert.ok(s.survives);
  assert.ok(s.processes >= 2 && s.coverage > 1000, JSON.stringify(s));
  const ops = makeOperators(makeGenePool([{ w: dwarf, role: 'stone' }, { w: imp, role: 'imp' }]));
  for (const op of Object.values(ops)) {
    const child = op(genomeOf(dwarf));
    if (child) assert.ok(compile(toRedcode(child)).ok);
  }
});

test('evolver on a volume: 3D mutations move numbers off the row, and species get a shape', async () => {
  const { makeGeometry } = await import('../src/engine/geometry.js');
  const VOL = { topology: 'torus', sizeX: 40, sizeY: 20, sizeZ: 10, coreSize: 8000 };
  const geo = makeGeometry(VOL);
  const ops = makeOperators({}, geo);
  assert.ok(ops.axis && ops.rotate && ops.lift && !makeOperators({}).lift);
  const g = genomeOf(compile(read('warriors/dwarf.red'), 'redcode', VOL));
  let offRow = 0;
  for (let k = 0; k < 200; k++) {
    const c = ops.lift(g);
    assert.equal(c.code.length, g.code.length);
    offRow += c.code.some((i) => [i.a, i.b].some((v) => { const [, y, z] = geo.decode(v); return y || z; })) ? 1 : 0;
  }
  assert.ok(offRow > 150, 'lift gives a field a part along y or z');
  const vrc = toRedcode(ops.lift(g), { geo, coreSize: 8000 });
  assert.ok(compile(vrc, 'redcode', VOL).ok, 'vector output compiles on the volume');
  // turn: a TRN along one axis, which compiles on the volume; the ring never gets one
  const t = ops.turn(g);
  const trn = t.code.find((i) => i.op === 'TRN');
  assert.ok(trn && geo.decode(trn.a).filter((v) => v !== 0).length === 1);
  assert.ok(compile(toRedcode(t, { geo, coreSize: 8000 }), 'redcode', VOL).ok);
  const ring = makeOperators({});
  assert.ok(!ring.turn);
  for (let k = 0; k < 400; k++) assert.ok(!ring.tweak(g).code.some((i) => i.op === 'TRN'));
  const shape = (f) => measureSpecies(compile(read(`warriors/${f}`), 'javascript', VOL), { ...VOL, maxProcesses: 8000, maxCycles: 80000, maxLength: 100 }).shape;
  assert.equal(shape('volume/lift.js'), 3);     // a line through the layers
});

test('evolving from scratch: random programs compile on the ring and on a plane', async () => {
  const { makeGeometry } = await import('../src/engine/geometry.js');
  const PLANE = { topology: 'torus', sizeX: 100, sizeY: 80, sizeZ: 1, coreSize: 8000 };
  const geo = makeGeometry(PLANE);
  let trn = 0;
  for (let k = 0; k < 200; k++) {
    const g = randomGenome(4 + (k % 16), { coreSize: 8000 });
    assert.ok(!g.code.some((i) => i.op === 'TRN'), 'no TRN on the ring');
    assert.ok(compile(toRedcode(g, { coreSize: 8000 }), 'redcode').ok);
    const p = randomGenome(4 + (k % 16), { coreSize: 8000, geo });
    trn += p.code.filter((i) => i.op === 'TRN').length;
    assert.ok(compile(toRedcode(p, { coreSize: 8000, geo }), 'redcode', PLANE).ok);
  }
  assert.ok(trn > 0, 'TRN appears on a plane');
  const ops = makeOperators({}, null, { scratch: true });
  assert.ok(ops.retune && !ops.graft_paper);
});
