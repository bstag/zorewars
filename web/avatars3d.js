// Avatars in WebGL: the battle as creatures fighting in a lit arena, drawn
// with three.js (web/vendor/three.js, loaded only when the Avatars view
// opens; the flat canvas view in avatars.js is the fallback).
//
// What is shown comes from avatar-model.js, exactly as in the flat view: each
// warrior's body is its own code, one part per instruction (SPL arm, MOV
// claw, ADD..MOD gear, JMP/DJN joint, tests eye, DAT pod), head first.
// This file adds what a real 3D scene can do:
// - parts as lit, shadowed meshes, batched per shape (InstancedMesh), long
//   warriors coiled as a helix; a part that has just run glows (bloom);
// - damage as materials: a smashed part is a dark shard with embers, a
//   stunned one sits in a spinning web, a chipped one has shards of the
//   attacker's colour stuck in it, a converted one becomes the attacker's
//   kind of part;
// - shots that arc from the attacker's part that wrote them, with trails,
//   and particle bursts, shock rings and light flashes where they land;
// - a real morph on conversion: each part slides from its own spine into
//   the captor's shape and colour;
// - a knocked-out warrior falls apart under gravity, in slow motion;
// - a director camera that sways, pushes in on kills and swings to a
//   knockout; drag (or pinch, or wheel) to take over, and it comes back after
//   a few seconds of quiet;
// - Map mode (setMap; the default on a plane or volume): the floor is the
//   live core, laid out like the 2D grid. Each avatar stands over where its
//   processes are, tethered to the cell, and hits outside any body land on
//   the cell that was written, so a bomber carpets the floor.
//
// Same interface as the other core views (layout, draw, addressAt, hover,
// pinned, ingest, consumeDrag): a part's address is its cell, so clicking one
// pins it in the inspector.

import * as THREE from './vendor/three.js';
import { AvatarModel, KINDS, LEGEND } from './avatar-model.js';
import { WARRIOR_COLORS, colorIndex, gridLayout } from './arena.js';
import { OP } from '../src/engine/index.js';

const { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = THREE;

const BACKGROUND = '#050812';
const FLIGHT_S = 0.5;
const MAX_FLYING = 80;
const TRAIL = 4;
const MAX_MINOR = 12;           // shots at cells outside any body (a paper's copies, bombs)
const MAX_PARTICLES = 2400;
const MAX_RINGS = 32;
const MAX_SPARKS = 28;          // orbiting processes per warrior
const USER_PAUSE_MS = 8000;     // the director waits this long after you move the camera
const SLOW_MS = 1600;           // slow motion after a knockout
const SETTLE_MS = 4000;         // keep animating this long after the VM or the user last moved
const SLOW = 0.3;
const MAP_W = 6.4;              // the map's width in world units (the arena is about 6)
const SPACING = 1.0;            // avatars on the map keep at least this far apart
const BOMB = new THREE.Color('#ff8a3c');

const Y = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);
const X = new THREE.Vector3(1, 0, 0);
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (t) => t * t * (3 - 2 * t);

// A body's shape in its own space (y up, +x towards the opponent): a column
// for short warriors, a helix for long ones, head on top.
function spine3(n) {
  const pos = [];
  let spacing;
  if (n <= 8) {
    const top = 0.55 + n * 0.13, low = 0.45;
    spacing = n > 1 ? (top - low) / (n - 1) : 0.2;
    for (let i = 0; i < n; i++) pos.push(new THREE.Vector3(0, n > 1 ? top - spacing * i : top, 0));
  } else {
    const turns = n / 12, rad = 0.17, S = 400;
    const pts = [];
    let len = 0;
    for (let k = 0; k <= S; k++) {
      const t = k / S, th = t * turns * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(th) * rad - rad, 1.6 - 1.15 * t, Math.sin(th) * rad);
      if (k) len += p.distanceTo(pts[k - 1].p);
      pts.push({ p, len });
    }
    spacing = len / (n - 1);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const at = i * spacing;
      while (k < S && pts[k + 1].len < at) k++;
      pos.push(pts[k].p.clone());
    }
  }
  return { pos, r: Math.min(0.125, spacing * 0.62) };
}

// A toothed gear, radius about 1, its axle along z.
function gearGeometry() {
  const shape = new THREE.Shape();
  const teeth = 10;
  for (let k = 0; k < teeth * 4; k++) {
    const a = (k / (teeth * 4)) * Math.PI * 2;
    const r = k % 4 < 2 ? 1.18 : 0.9;
    if (k) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 });
  g.translate(0, 0, -0.3);
  g.computeVertexNormals();
  return g;
}

// A jagged shard: what's left of a part hit by a DAT.
function shardGeometry() {
  const g = new THREE.DodecahedronGeometry(1, 0);
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 0.55 + 0.6 * hash(seen.size * 3.7));
    const f = seen.get(key);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

function spriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class AvatarView3D {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.hover = -1;
    this.pinned = -1;
    this.active = false;
    this.vm = null;
    this.model = new AvatarModel();
    this.t = 0;                         // scene time in seconds (slows down after a knockout)
    this.lastNow = 0;
    this.slowUntil = 0;
    this.userAt = -Infinity;
    this.userHolding = false;
    this.focus = null;
    this.dragMoved = false;
    this.mapChoice = null;              // null: map on a plane or volume, arena on the ring
    this.mapOn = false;
    this.onMapChange = null;

    // No antialias here: the bloom composer renders through its own targets,
    // so the default framebuffer's multisampling would be paid for and unused.
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    scene.fog = new THREE.FogExp2(BACKGROUND, 0.06);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(38, 1.6, 0.05, 80);
    this.camera.position.set(0, 1.7, 4.6);

    const controls = new OrbitControls(this.camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = 1.48;
    controls.target.set(0, 0.8, 0);
    controls.addEventListener('start', () => { this.userHolding = true; this.userAt = performance.now(); });
    controls.addEventListener('end', () => { this.userHolding = false; this.userAt = performance.now(); });
    controls.addEventListener('change', () => { this.userAt = performance.now(); });
    this.controls = controls;
    canvas.addEventListener('pointerdown', (e) => { this.down = [e.clientX, e.clientY]; this.dragMoved = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 4) this.dragMoved = true;
    });
    canvas.addEventListener('pointerup', () => { this.down = null; });

    // Light: a sky, a key light that casts shadows, a cool rim, and a few
    // point lights that flash where blows land.
    scene.add(new THREE.HemisphereLight('#8fa8ff', '#0b0f1e', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7c9cff', 1.1);
    rim.position.set(-4, 3, -5);
    scene.add(rim);
    this.flashes = [0, 1, 2].map(() => {
      const l = new THREE.PointLight('#ffffff', 0, 3.5, 2);
      scene.add(l);
      return { light: l, t0: -1, peak: 0 };
    });
    this.nextFlash = 0;

    this.buildArena();
    this.buildShapes();

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.colors = WARRIOR_COLORS.map((c) => new THREE.Color(c));
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), v: new THREE.Vector3(), v2: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() };
    // Scratch for the per-part drawing: put() copies what it is given, so
    // these are free again as soon as it returns.
    this.sq = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), c: new THREE.Quaternion(), dir: new THREE.Vector3(), id: new THREE.Quaternion() };

    this.legend = document.createElement('div');
    this.legend.className = 'avatar-legend';
    this.legend.textContent = `${LEGEND} · drag to turn`;
    overlay.append(this.legend);
    this.labels = [];
  }

  // ---- the arena: floor, rings, distant stars, particles, shock rings ----
  buildArena() {
    const { scene } = this;
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 96).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#0d1430', roughness: 1, metalness: 0 }),
    );
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;
    this.arenaRings = [[3.0, 0.32], [1.9, 0.18], [0.8, 0.12]].map(([r, o]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.012, r, 160).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#7890be', transparent: true, opacity: o, depthWrite: false }));
      ring.position.y = 0.002;
      scene.add(ring);
      return ring;
    });
    this.cycleR = 3.12;
    // The cycle count fills a ring at the rim.
    this.cycleRing = new THREE.Mesh(new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#a5b4fc').multiplyScalar(1.6), toneMapped: false }));
    this.cycleRing.position.y = 0.004;
    this.cycleStep = -1;
    scene.add(this.cycleRing);

    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const u = hash(i) * 2 - 1, th = hash(i + 0.5) * Math.PI * 2, r = 22 + hash(i + 0.25) * 10;
      const s = Math.sqrt(1 - u * u);
      starPos.set([Math.cos(th) * s * r, Math.abs(u) * r * 0.8 + 1, Math.sin(th) * s * r], i * 3);
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#7d8cc4', size: 0.09, fog: false })));

    // Particles: a ring buffer; a dead particle is black, so additive
    // blending makes it vanish.
    this.sprite = spriteTexture();
    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.07, map: this.sprite, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    this.particles.frustumCulled = false;
    scene.add(this.particles);
    this.pVel = new Float32Array(MAX_PARTICLES * 3);
    this.pLife = new Float32Array(MAX_PARTICLES);
    this.pMax = new Float32Array(MAX_PARTICLES).fill(1);
    this.pBase = new Float32Array(MAX_PARTICLES * 3);
    this.pGrav = new Float32Array(MAX_PARTICLES);
    this.pNext = 0;
    this.rings = [];
  }

  // ---- shapes and materials, shared by every round ----
  buildShapes() {
    const sphere = new THREE.SphereGeometry(1, 24, 16);
    const tentacleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 0.3, 0), new THREE.Vector3(1.3, 0.15, 0), new THREE.Vector3(1.95, -0.35, 0),
    ]);
    const jaw = new THREE.ConeGeometry(0.26, 1.1, 12).rotateZ(-Math.PI / 2).translate(0.55, 0, 0);
    this.shape = {
      arm: sphere,
      claw: sphere,
      gear: gearGeometry(),
      joint: new THREE.TorusGeometry(0.82, 0.3, 14, 32),
      eye: sphere,
      pod: new THREE.CylinderGeometry(1, 1, 1.3, 6),
      plate: new THREE.BoxGeometry(1.45, 1.45, 1.45),
      shard: shardGeometry(),
      tentacle: new THREE.TubeGeometry(tentacleCurve, 24, 0.17, 8),
      jaw,
      web: new THREE.IcosahedronGeometry(1, 1),
      chip: new THREE.TetrahedronGeometry(1),
      link: new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0),
      halo: new THREE.RingGeometry(0.8, 1, 64).rotateX(-Math.PI / 2),
      ring: new THREE.RingGeometry(0.86, 1, 48),
      hoverRing: new THREE.TorusGeometry(1, 0.06, 8, 40),
      net: new THREE.OctahedronGeometry(1, 0),
      ball: new THREE.SphereGeometry(1, 12, 8),
      square: new THREE.RingGeometry(0.62, 0.9, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
    };
    this.mat = {
      body: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3, emissive: '#000000' }),
      flat: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.25, flatShading: true }),
      shard: new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.05, flatShading: true }),
      white: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0 }),
      glow: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      glowWire: new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      glowFlat: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }),
    };
  }

  // One batch of a shape, written from scratch every frame (see begin/put).
  batch(geo, mat, count, shadow = false) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3), 3).setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = shadow;
    m.userData.n = 0;
    this.dyn.add(m);
    this.batches.push(m);
    return m;
  }

  // ---- bodies, built once per round ----
  build(vm) {
    this.vm = vm;
    this.model.build(vm);
    const bodies = this.model.bodies;
    const W = bodies.length;
    this.maxLen = Math.max(1, ...bodies.map((b) => b.cells.length));
    this.layouts = bodies.map((b) => spine3(b.cells.length));
    if (this.dyn) {
      this.scene.remove(this.dyn);
      for (const m of this.batches) m.dispose();
    }
    this.dyn = new THREE.Group();
    this.batches = [];
    const T = W * this.maxLen;
    const { shape: geo, mat } = this;
    this.parts = {};
    for (const k of KINDS) this.parts[k] = this.batch(geo[k], k === 'pod' || k === 'plate' ? mat.flat : mat.body, T, true);
    this.shards = this.batch(geo.shard, mat.shard, T, true);
    this.tentacles = this.batch(geo.tentacle, mat.body, T * 2, true);
    this.jaws = this.batch(geo.jaw, mat.body, T * 2, true);
    this.eyeballs = this.batch(geo.ball, mat.white, T + W * 2);
    this.pupils = this.batch(geo.ball, mat.body, T + W * 2);
    this.links = this.batch(geo.link, mat.body, T, true);
    this.legs = this.batch(geo.link, mat.body, W * 2, true);
    this.chips = this.batch(geo.chip, mat.glow, T * 3);
    this.webs = this.batch(geo.web, mat.glowWire, T);
    this.glows = this.batch(geo.ball, mat.glow, T * 4 + W * 2);   // up to 4 per part, 2 irises per head
    this.halos = this.batch(geo.halo, mat.glowFlat, W);
    this.sparks = this.batch(geo.ball, mat.glow, W * MAX_SPARKS);
    this.shots = this.batch(geo.ball, mat.glow, MAX_FLYING * (TRAIL + 1));
    this.nets = this.batch(geo.net, mat.glowWire, MAX_FLYING);
    this.ringMesh = this.batch(geo.ring, mat.glowFlat, MAX_RINGS);
    this.hoverMesh = this.batch(geo.hoverRing, mat.glow, 2);
    this.tethers = this.batch(geo.link, mat.glow, W);
    this.markers = this.batch(geo.square, mat.glowFlat, W + 4);
    this.scene.add(this.dyn);

    this.rt = bodies.map((b, w) => ({
      stage: new THREE.Vector3(),
      yaw: 0,
      slotPos: Array.from({ length: this.maxLen }, () => new THREE.Vector3()),
      slotR: new Float32Array(this.maxLen),
      slotCell: new Int32Array(this.maxLen).fill(-1),
      drawn: 0,
      wasAlive: true,
      fall: null,
      top: 1.5,
      anchor: -1,                       // map mode: the process it stands over
      want: new THREE.Vector3(),
      snap: true,
    }));
    const n = W;
    this.rt.forEach((rt, w) => { rt.yaw = n > 1 && w === n - 1 ? Math.PI : 0; });
    this.setupMap(vm);
    this.mapOn = this.mapChoice ?? !!vm.geo;
    this.applyMap();
    this.flying = [];
    this.rings = [];
    this.pLife.fill(0);
    this.pCol.fill(0);
    this.focus = null;
    this.slowUntil = 0;
    this.seenSteps = -1;
    this.quietSince = performance.now();
    this.mapDirty = true;

    for (const l of this.labels) l.el.remove();
    this.labels = bodies.map((b, w) => {
      const el = document.createElement('div');
      el.className = 'avatar-label';
      el.innerHTML = '<b></b><i><span></span></i><small></small>';
      el.querySelector('b').textContent = b.name || `Warrior ${w + 1}`;
      el.querySelector('b').style.color = WARRIOR_COLORS[colorIndex(w) % WARRIOR_COLORS.length];
      el.querySelector('span').style.background = WARRIOR_COLORS[colorIndex(w) % WARRIOR_COLORS.length];
      this.overlay.append(el);
      return { el, bar: el.querySelector('span'), text: el.querySelector('small'), last: '' };
    });
  }

  // ---- arena or map ----
  // The arena: avatars in a row (staggered beyond two).
  placeArena() {
    const n = this.rt.length;
    const R = n > 2 ? 1.75 : 1.1;
    this.rt.forEach((rt, w) => this.moveStage(rt, this.tmp.v.set(n > 1 ? -R + (2 * R * w) / (n - 1) : 0, 0, n > 2 ? (w % 2 ? 0.45 : -0.25) : 0)));
  }
  // Moves a body to a new spot at once; a fallen one's pieces go with it.
  moveStage(rt, to) {
    if (rt.fall) {
      const p = rt.fall.pos;
      for (let k = 0; k < p.length; k += 3) { p[k] += to.x - rt.stage.x; p[k + 1] += to.y - rt.stage.y; p[k + 2] += to.z - rt.stage.z; }
    }
    rt.stage.copy(to);
  }

  setMap(on) {
    this.mapChoice = on;
    this.mapOn = on;
    if (this.rt) this.applyMap();
  }

  applyMap() {
    const on = this.mapOn;
    this.mapDirty = true;
    this.quietSince = performance.now();
    this.mapMesh.visible = on;
    for (const r of this.arenaRings) r.visible = !on;
    this.floor.scale.setScalar(on ? 1.75 : 1);
    this.cycleR = on ? Math.hypot(this.mapW, this.mapD) / 2 + 0.3 : 3.12;
    this.cycleStep = -1;
    const n = this.rt.length;
    this.home = on ? { dist: this.mapW * 0.95, height: this.mapW * 0.6 }
      : n > 2 ? { dist: 5.4, height: 1.55 } : { dist: 3.9, height: 1.2 };
    if (on) for (const rt of this.rt) { rt.anchor = -1; rt.snap = true; }
    else this.placeArena();
    this.legend.textContent = `${LEGEND}${on ? ' · the floor is the core' : ''} · drag to turn`;
    this.onMapChange?.(on);
  }

  // The floor map: one texel per cell, laid out like the 2D grid.
  setupMap(vm) {
    const g = gridLayout(vm.size, vm.geo);
    this.grid = g;
    this.mapW = MAP_W;
    this.mapD = (MAP_W * g.rows) / g.cols;
    if (this.mapMesh) {
      this.scene.remove(this.mapMesh);
      this.mapMesh.geometry.dispose();
      this.mapMesh.material.dispose();
      this.mapTex.dispose();
    }
    const data = new Uint8Array(g.cols * g.rows * 4);
    for (let i = 0; i < data.length; i += 4) data.set([5, 8, 18, 255], i);
    this.mapTex = new THREE.DataTexture(data, g.cols, g.rows, THREE.RGBAFormat);
    this.mapTex.magFilter = THREE.NearestFilter;
    this.mapTex.minFilter = THREE.LinearFilter;
    this.mapTex.generateMipmaps = false;
    this.mapTex.colorSpace = THREE.SRGBColorSpace;
    this.mapTex.needsUpdate = true;
    this.mapMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.mapW, this.mapD).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: this.mapTex, emissiveMap: this.mapTex, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.9, metalness: 0 }),
    );
    this.mapMesh.position.y = 0.003;
    this.mapMesh.receiveShadow = true;
    this.scene.add(this.mapMesh);
    // Each warrior's colour from settled (dim) to just written (bright), as bytes.
    const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const empty = hex('#111a30');
    this.mapEmpty = empty;
    this.mapUnowned = hex('#334155');
    this.mapPal = WARRIOR_COLORS.map((h) => { const c = hex(h); return [mix(empty, c, 0.42), mix(c, [255, 255, 255], 0.35)]; });
  }

  // Where a cell is on the floor.
  cellFloor(cell, out) {
    const { gridOf, cols, rows } = this.grid;
    const g = gridOf[cell], gx = g % cols, gy = (g - gx) / cols;
    return out.set(((gx + 0.5) / cols - 0.5) * this.mapW, 0.02, ((gy + 0.5) / rows - 0.5) * this.mapD);
  }

  updateMap(vm, fade) {
    const data = this.mapTex.image.data;
    const { gridOf, cols, rows } = this.grid;
    const { owner, lastWrite, op, a, b, steps } = vm;
    const pal = this.mapPal, E = this.mapEmpty, U = this.mapUnowned;
    for (let i = 0; i < vm.size; i++) {
      const g = gridOf[i], gx = g % cols, gy = (g - gx) / cols;
      const k = ((rows - 1 - gy) * cols + gx) * 4;
      const o = owner[i];
      let r, gg, bb;
      if (o < 0) {
        const c = op[i] === OP.DAT && a[i] === 0 && b[i] === 0 ? E : U;
        r = c[0]; gg = c[1]; bb = c[2];
      } else {
        const [dim, bright] = pal[colorIndex(o) % pal.length];
        const age = steps - lastWrite[i];
        const t = age < fade ? 1 - age / fade : 0;
        const f = op[i] === OP.DAT ? 0.6 : 1;          // bombs and data darker than code
        r = (dim[0] + (bright[0] - dim[0]) * t) * f; gg = (dim[1] + (bright[1] - dim[1]) * t) * f; bb = (dim[2] + (bright[2] - dim[2]) * t) * f;
      }
      data[k] = r; data[k + 1] = gg; data[k + 2] = bb;
    }
    for (const war of vm.warriors) {                   // running processes: near white
      for (const pc of war.queue) {
        const g = gridOf[pc], gx = g % cols, gy = (g - gx) / cols;
        const k = ((rows - 1 - gy) * cols + gx) * 4;
        data[k] = 190; data[k + 1] = 200; data[k + 2] = 225;
      }
    }
    this.mapTex.needsUpdate = true;
  }

  // Each avatar walks to the process it follows (each frame the one of its
  // processes nearest to the last), keeping clear of the others.
  trackOnMap(vm, dt, moved = true) {
    const { gridOf, cols } = this.grid;
    this.rt.forEach((rt, w) => {
      const war = vm.warriors[w];
      if (war.alive && war.queue.size && (moved || rt.anchor < 0)) {      // the processes only move when the VM does
        let best = war.queue.buf[war.queue.head];
        if (rt.anchor >= 0) {
          const g0 = gridOf[rt.anchor], x0 = g0 % cols, y0 = (g0 - x0) / cols;
          let bestD = Infinity;
          for (const pc of war.queue) {
            const g = gridOf[pc], dx = (g % cols) - x0, dy = (g - (g % cols)) / cols - y0;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = pc; if (!d) break; }
          }
        }
        rt.anchor = best;
      }
      if (rt.anchor < 0) rt.anchor = this.model.bodies[w].cells[0];
      this.cellFloor(rt.anchor, rt.want).setY(0);
      if (rt.snap) { this.moveStage(rt, rt.want); rt.snap = false; }
      else if (war.alive) rt.stage.lerp(rt.want, 1 - Math.exp(-dt * 2.5));
    });
    const lim = [this.mapW / 2 - 0.3, this.mapD / 2 - 0.3];
    for (let pass = 0; pass < 3; pass++) {
      for (let a = 0; a < this.rt.length; a++) {
        for (let b = a + 1; b < this.rt.length; b++) {
          const A = this.rt[a].stage, B = this.rt[b].stage;
          let dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
          if (d >= SPACING) continue;
          if (d < 1e-4) { dx = Math.cos(a + b); dz = Math.sin(a + b); d = 1; }
          const aMoves = vm.warriors[a].alive, bMoves = vm.warriors[b].alive;
          const push = (SPACING - Math.hypot(B.x - A.x, B.z - A.z)) / ((aMoves && bMoves) ? 2 : 1);
          if (aMoves) { A.x -= (dx / d) * push; A.z -= (dz / d) * push; }
          if (bMoves) { B.x += (dx / d) * push; B.z += (dz / d) * push; }
        }
      }
    }
    for (const rt of this.rt) {
      rt.stage.x = Math.max(-lim[0], Math.min(lim[0], rt.stage.x));
      rt.stage.z = Math.max(-lim[1], Math.min(lim[1], rt.stage.z));
    }
  }

  // A glowing tether from each living avatar down to its process's cell.
  drawTethers(vm) {
    const { tmp, colors } = this;
    const cell = this.mapW / this.grid.cols;
    this.rt.forEach((rt, w) => {
      if (!vm.warriors[w].alive || rt.anchor < 0) return;
      const at = this.cellFloor(rt.anchor, tmp.v2);
      const col = colors[colorIndex(w) % colors.length];
      this.put(this.markers, at, IDENTITY, cell * 2.2, 1, cell * 2.2, tmp.c.copy(col).multiplyScalar(2.2));
      const from = tmp.v.copy(rt.stage).setY(0.03);
      const len = from.distanceTo(at);
      if (len < 0.02) return;
      const q = this.sq.a.setFromUnitVectors(Y, this.sq.dir.copy(at).sub(from).normalize());
      this.put(this.tethers, from, q, 0.012, len, 0.012, tmp.c.copy(col).multiplyScalar(1.4));
    });
  }

  ingest(vm, events, now) {
    if (vm !== this.vm) this.build(vm);
    this.model.ingest(vm, events, now);
  }

  consumeDrag() { const d = this.dragMoved; this.dragMoved = false; return d; }
  // Redraw while the battle or the camera is moving, and for a few seconds
  // after (effects settle, the camera eases); then rest until something
  // moves again, so a paused or finished battle costs nothing.
  get animating() {
    if (!this.active) return false;
    const now = performance.now();
    return this.userHolding || now - Math.max(this.quietSince ?? 0, this.userAt) < SETTLE_MS || now < this.slowUntil || this.flying?.length > 0;
  }

  layout(coreSize, geo) {
    this.coreSize = coreSize;
    this.geo = geo;
    const width = this.canvas.parentElement.clientWidth || 800;
    const height = Math.round(width * 0.62);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    // Phones: bloom at half its resolution (a quarter of the pixels in its
    // dozen blur passes); the glow is soft anyway.
    if (matchMedia('(pointer: coarse)').matches) this.bloom.setSize(Math.round(width * dpr / 2), Math.round(height * dpr / 2));
    this.canvas.style.width = '100%';
    this.canvas.style.aspectRatio = `${width} / ${height}`;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.w = width;
    this.h = height;
  }

  addressAt(clientX, clientY) {
    if (!this.rt) return -1;
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) / r.width, py = (clientY - r.top) / r.height;
    const aspect = r.width / r.height;
    const k = 1 / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const v = this.tmp.v;
    let best = -1, bestD = Infinity;
    for (const rt of this.rt) {
      for (let j = 0; j < rt.drawn; j++) {
        if (rt.slotCell[j] < 0) continue;
        const dist = this.camera.position.distanceTo(rt.slotPos[j]);
        v.copy(rt.slotPos[j]).project(this.camera);
        if (v.z > 1) continue;
        const dx = (px - (v.x + 1) / 2) * aspect, dy = py - (1 - v.y) / 2;
        const d = Math.hypot(dx, dy);
        const rad = Math.max(0.012, ((rt.slotR[j] * k) / dist) * 1.3);
        if (d < rad && d < bestD) { bestD = d; best = rt.slotCell[j]; }
      }
    }
    if (best < 0 && this.mapOn) best = this.floorCellAt(px, py);
    return best;
  }

  // The core cell on the floor under a point of the canvas (fractions), or -1.
  floorCellAt(px, py) {
    const ray = this.tmp.v.set(px * 2 - 1, 1 - py * 2, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    if (ray.y >= -1e-4) return -1;
    const t = -this.camera.position.y / ray.y;
    const x = this.camera.position.x + ray.x * t, z = this.camera.position.z + ray.z * t;
    const { cols, rows, cellAtGrid } = this.grid;
    const gx = Math.floor((x / this.mapW + 0.5) * cols), gy = Math.floor((z / this.mapD + 0.5) * rows);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
    return cellAtGrid[gy * cols + gx];
  }

  // ---- per frame ----
  begin() { for (const m of this.batches) m.userData.n = 0; }
  finish() {
    for (const m of this.batches) {
      m.count = m.userData.n;
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
    }
  }
  put(mesh, pos, quat, sx, sy, sz, color) {
    const i = mesh.userData.n;
    if (i >= mesh.instanceMatrix.count) return;
    mesh.userData.n++;
    this.tmp.m.compose(pos, quat, this.tmp.s.set(sx, sy, sz));
    mesh.setMatrixAt(i, this.tmp.m);
    mesh.setColorAt(i, color);
  }

  draw(vm, fadeSteps) {
    if (vm !== this.vm) this.build(vm);
    if (!this.w || vm.size !== this.coreSize) this.layout(vm.size, vm.geo);
    const now = performance.now();
    const realDt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0.016;
    this.lastNow = now;
    const dt = realDt * (now < this.slowUntil ? SLOW : 1);
    this.t += dt;
    const moved = vm.steps !== this.seenSteps;
    if (moved) { this.seenSteps = vm.steps; this.quietSince = now; }
    this.model.update(vm, now, Math.max(24, fadeSteps));
    const bodies = this.model.bodies;

    // New blows: kills land now (and pull the camera in), shots take flight.
    for (const h of this.model.takeHits()) {
      if (h.to.i < 0) h.to = { ...h.to, cell: h.cell };    // on the map, it lands on the cell itself
      if (h.kind === 'kill') {
        const at = this.endPoint(h.to);
        if (at) this.impact('kill', at, h.attacker, false);
        if (!this.focus || now - this.focus.start > 900) this.focus = { w: h.to.w, i: h.to.i, start: now, until: now + 1300 };
      } else if (this.flying.length < MAX_FLYING && (!h.minor || this.flying.filter((f) => f.minor).length < MAX_MINOR)) {
        this.flying.push({ ...h, t0: this.t });
      }
    }
    // Knockouts: the body falls apart, in slow motion, with the camera on it.
    bodies.forEach((b, w) => {
      const rt = this.rt[w];
      if (rt.wasAlive && !b.alive) {
        this.slowUntil = now + SLOW_MS;
        this.focus = { w, i: -1, start: now, until: now + 2400 };
        rt.fall = this.startFall(rt, b);
      }
      rt.wasAlive = b.alive;
    });

    if (this.mapOn) {
      this.trackOnMap(vm, realDt, moved);
      // The floor shows the whole core: rebuild it only when the VM moved.
      if (moved || this.mapDirty || fadeSteps !== this.mapFade) {
        this.updateMap(vm, Math.max(24, fadeSteps));
        this.mapDirty = false;
        this.mapFade = fadeSteps;
      }
    }

    // Everyone faces the nearest living opponent.
    for (let w = 0; w < bodies.length; w++) {
      const rt = this.rt[w];
      let target = null, bestD = Infinity;
      for (let o = 0; o < bodies.length; o++) {
        if (o === w || !bodies[o].alive) continue;
        const d = rt.stage.distanceTo(this.rt[o].stage);
        if (d < bestD) { bestD = d; target = this.rt[o].stage; }
      }
      if (target) {
        const want = Math.atan2(-(target.z - rt.stage.z), target.x - rt.stage.x);
        let diff = want - rt.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        rt.yaw += diff * Math.min(1, realDt * 4);
      }
    }

    this.begin();
    for (let w = 0; w < bodies.length; w++) this.drawWarrior(vm, w, now, dt);
    this.drawFlying(now);
    this.drawRings();
    this.stepParticles(dt);
    this.stepFlashes();
    this.drawHover();
    if (this.mapOn) this.drawTethers(vm);
    this.finish();
    this.drawCycle(vm);
    this.direct(now, realDt);
    this.drawLabels(vm);
    this.composer.render();
  }

  // A warrior: its parts (blending into its captor's shape while converted),
  // spine links, legs, glow, eyes, halo and the processes orbiting it.
  drawWarrior(vm, w, now, dt) {
    const b = this.model.bodies[w], L = this.layouts[w], rt = this.rt[w];
    const { tmp, colors } = this;
    const col = colors[colorIndex(w) % colors.length];
    const n = b.cells.length;
    const to = b.morph > 0.01 && b.morphTo >= 0 && b.alive ? b.morphTo : -1;
    const TB = to >= 0 ? this.model.bodies[to] : null, TL = to >= 0 ? this.layouts[to] : null;
    const e = to >= 0 ? smooth(Math.min(1, b.morph)) : 0;
    const N = to >= 0 ? Math.max(n, TB.cells.length) : n;
    const W = (rt.scratch ??= { q: new THREE.Quaternion(), fwd: new THREE.Vector3(), side: new THREE.Vector3(), local: new THREE.Vector3(), pos: new THREE.Vector3(), c: new THREE.Color(), body: new THREE.Color() });
    const qYaw = W.q.setFromAxisAngle(Y, rt.yaw);
    const fwd = W.fwd.set(Math.cos(rt.yaw), 0, -Math.sin(rt.yaw));
    const side = W.side.set(Math.sin(rt.yaw), 0, Math.cos(rt.yaw));
    const bob = b.alive ? Math.sin(this.t * 2.6 + w) * 0.02 : 0;
    const shake = now - b.shake < 300 ? (1 - (now - b.shake) / 300) * 0.05 : 0;
    const fallen = !!rt.fall;
    if (fallen) this.stepFall(rt, dt);
    const local = W.local, pos = W.pos, c = W.c;
    rt.top = 0;
    rt.drawn = N;

    for (let j = 0; j < N; j++) {
      const own = j < n;
      const tOwn = TL ? j < TB.cells.length : false;
      const srcR = own ? (j === 0 ? L.r * 1.45 : L.r) : 0;
      local.copy(own ? L.pos[j] : L.pos[n - 1]);
      let r = srcR;
      if (TL) {
        const tgt = tOwn ? TL.pos[j] : TL.pos[TL.pos.length - 1];
        local.lerp(tgt, e);
        r = srcR + ((tOwn ? (j === 0 ? TL.r * 1.45 : TL.r) : 0) - srcR) * e;
        r *= 0.35 + 0.65 * Math.abs(1 - 2 * e);          // shrink through the change of shape
      }
      rt.slotR[j] = r;
      rt.slotCell[j] = own ? b.cells[j] : -1;
      if (fallen && own) {
        if (j >= rt.fall.r.length) continue;
        pos.fromArray(rt.fall.pos, j * 3);
      } else {
        pos.copy(local).applyQuaternion(qYaw).add(rt.stage);
        pos.y += bob;
        if (shake) pos.x += (hash(now * 0.01 + j) - 0.5) * shake;
      }
      rt.slotPos[j].copy(pos);
      if (r < 0.004 || (fallen && !own)) continue;
      rt.top = Math.max(rt.top, pos.y + r);

      // Which shape and colour this part has right now.
      const useTarget = TL && e >= 0.5;
      let kind, dmg = null, enemy = -1, act = 0, procs = 0;
      if (useTarget) {
        kind = tOwn ? TB.origKind[j] : null;
        c.copy(colors[colorIndex(to) % colors.length]);
      } else if (own) {
        kind = b.kind[j]; dmg = b.damage[j]; enemy = b.enemy[j]; act = b.active[j]; procs = b.procs[j];
        c.copy(dmg === 'converted' ? colors[colorIndex(enemy) % colors.length] : col);
      }
      if (!kind) continue;
      if (TL && !useTarget) c.lerp(colors[colorIndex(to) % colors.length], e * 1.6);
      if (fallen) { c.set('#475569'); act = 0; procs = 0; }
      if (dmg === 'stunned') c.multiplyScalar(0.5);

      const q = tmp.q2.copy(qYaw);
      if (fallen) q.setFromAxisAngle(rt.fall.axis[j], rt.fall.spin[j] * this.t);
      if (dmg === 'bombed') {
        this.put(this.shards, pos, q, r, r, r, tmp.c.set('#1c2030'));
        if (!fallen) this.put(this.glows, pos, q, r * 1.08, r * 1.08, r * 1.08, tmp.c.copy(colors[colorIndex(enemy) % colors.length]).multiplyScalar(0.07 + 0.05 * Math.sin(this.t * 6 + j)));
      } else {
        this.drawPart(kind, pos, q, r, c, act, j, fwd, side, fallen);
      }
      if (dmg === 'stunned' && !fallen) {
        const qs = this.sq.a.setFromAxisAngle(Y, this.t * 0.9 + j);
        this.put(this.webs, pos, qs, r * 1.55, r * 1.55, r * 1.55, tmp.c.copy(colors[colorIndex(enemy) % colors.length]).multiplyScalar(1.6));
      }
      if (dmg === 'chipped' && !fallen) {
        for (let k = 0; k < 3; k++) {
          const a = hash(j * 5 + k) * Math.PI * 2, el = (hash(j * 7 + k) - 0.5) * 2;
          const dir = this.sq.dir.set(Math.cos(a), el, Math.sin(a)).normalize();
          const qc = this.sq.a.setFromUnitVectors(Y, dir);
          this.put(this.chips, tmp.v.copy(pos).addScaledVector(dir, r * 0.95), qc, r * 0.3, r * 0.5, r * 0.3, tmp.c.copy(colors[colorIndex(enemy) % colors.length]).multiplyScalar(1.4));
        }
      }
      if (!fallen) {
        if (act > 0.05) { const s = r * (1.12 + 0.15 * act); this.put(this.glows, pos, q, s, s, s, tmp.c.copy(c).multiplyScalar(0.22 * act)); }
        if (procs) { const s = r * 1.32; this.put(this.glows, pos, q, s, s, s, tmp.c.setScalar(Math.min(0.16, 0.05 + 0.025 * procs))); }
        const since = now - (own ? b.lastHit[j] : -Infinity);
        if (since < 450) { const s = r * (1.1 + since / 300); this.put(this.glows, pos, q, s, s, s, tmp.c.setScalar(1.4 * (1 - since / 450))); }
      }
      if (j === 0) this.drawHeadEyes(b, pos, r, fwd, side, fallen, w);
    }

    // Spine links between consecutive parts, and legs to the floor.
    if (!fallen) {
      const body = W.body.copy(col);
      if (to >= 0) body.lerp(colors[colorIndex(to) % colors.length], e);
      const lc = tmp.c.copy(body).multiplyScalar(0.55);
      for (let j = 1; j < N; j++) {
        const a = rt.slotPos[j - 1], z = rt.slotPos[j];
        const len = a.distanceTo(z);
        if (len < 1e-4 || rt.slotR[j] < 0.004 || rt.slotR[j - 1] < 0.004) continue;
        const ql = this.sq.a.setFromUnitVectors(Y, tmp.v.copy(z).sub(a).normalize());
        const th = Math.min(rt.slotR[j], rt.slotR[j - 1]) * 0.32;
        this.put(this.links, a, ql, th, len, th, lc);
      }
      const hip = rt.slotPos[Math.max(0, Math.min(N, n) - 1)];
      const step = b.alive ? Math.sin(this.t * 3.8) * 0.05 : 0;
      for (const s of [-1, 1]) {
        const foot = tmp.v2.copy(rt.stage).addScaledVector(side, s * 0.13).addScaledVector(fwd, s * step);
        const len = hip.distanceTo(foot);
        const ql = this.sq.a.setFromUnitVectors(Y, tmp.v.copy(hip).sub(foot).normalize());
        this.put(this.legs, foot, ql, 0.028, len, 0.028, tmp.c.copy(body).multiplyScalar(0.7));
      }
    }

    // A halo on the floor for how many processes it has.
    if (b.alive) {
      const v = Math.min(1, Math.log2(1 + b.total) / Math.log2(1 + vm.settings.maxProcesses));
      const s = 0.42 + 0.35 * v + 0.02 * Math.sin(this.t * 5);
      tmp.v.copy(rt.stage).setY(0.006);
      this.put(this.halos, tmp.v, this.sq.id, s, 1, s, tmp.c.copy(col).multiplyScalar(0.35 + 0.9 * v));
    }

    // Processes running elsewhere orbit the body; captives in the captor's colour.
    if (b.alive && b.away) {
      const dots = Math.min(MAX_SPARKS, Math.ceil(Math.log2(b.away + 1) * 3));
      const captive = b.total ? Math.round((dots * b.possessed) / b.total) : 0;
      for (let k = 0; k < dots; k++) {
        const a = this.t * (0.9 + 0.15 * (k % 4)) + (k * Math.PI * 2) / dots;
        const rad = 0.5 + 0.08 * (k % 3);
        tmp.v.set(rt.stage.x + Math.cos(a) * rad, 0.85 + Math.sin(a * 1.7 + k) * 0.35, rt.stage.z + Math.sin(a) * rad);
        this.put(this.sparks, tmp.v, qYaw, 0.024, 0.024, 0.024, tmp.c.copy(k < captive && b.captor >= 0 ? colors[colorIndex(b.captor) % colors.length] : col).multiplyScalar(2.2));
      }
    }
  }

  // One part, with what its shape needs: tentacles, jaws, an eye, a turning gear.
  drawPart(kind, pos, q, r, color, act, j, fwd, side, fallen) {
    const { tmp } = this;
    const local = this.sq.a.identity();
    switch (kind) {
      case 'gear': local.setFromAxisAngle(Z, (fallen ? 0 : this.t * (0.5 + 4 * act)) + j); break;
      case 'joint': local.setFromAxisAngle(X, Math.PI / 2 + Math.sin(this.t + j) * 0.3); break;
      case 'plate': local.setFromAxisAngle(Y, Math.PI / 4); break;
      default: break;
    }
    const qq = this.sq.b.copy(q).multiply(local);
    this.put(this.parts[kind], pos, qq, r, r, r, color);
    if (fallen) return;
    if (kind === 'arm') {                       // tentacles out both sides, waving
      for (const s of [-1, 1]) {
        const qt = this.sq.b.copy(q)
          .multiply(this.sq.a.setFromAxisAngle(Y, (s * Math.PI) / 2))
          .multiply(this.sq.c.setFromAxisAngle(Z, Math.sin(this.t * 3 + j + s) * 0.45 - 0.1));
        this.put(this.tentacles, pos, qt, r, r, r, color);
      }
    } else if (kind === 'claw') {               // a pincer towards the enemy, open while it runs
      const open = 0.2 + 0.5 * act;
      const at = tmp.v.copy(pos).addScaledVector(fwd, r * 0.75);
      for (const s of [-1, 1]) {
        const qj = this.sq.b.copy(q).multiply(this.sq.a.setFromAxisAngle(Z, s * open));
        this.put(this.jaws, at, qj, r * 1.25, r * 1.25, r * 1.25, color);
      }
    } else if (kind === 'eye') {                // a scanner looks around
      const look = Math.sin(this.t * 1.3 + j) * 0.35;
      const dir = tmp.v2.copy(fwd).multiplyScalar(Math.cos(look)).addScaledVector(side, Math.sin(look));
      this.put(this.eyeballs, tmp.v.copy(pos).addScaledVector(dir, r * 0.5), q, r * 0.62, r * 0.62, r * 0.62, tmp.c.setScalar(1));
      this.put(this.pupils, tmp.v.copy(pos).addScaledVector(dir, r * 1.02), q, r * 0.24, r * 0.24, r * 0.24, tmp.c.setScalar(0.02));
    } else if (kind === 'pod') {                // a live charge inside
      this.put(this.glows, pos, q, r * 0.55, r * 0.55, r * 0.55, tmp.c.copy(color).multiplyScalar(0.9));
    }
  }

  drawHeadEyes(b, pos, r, fwd, side, fallen, w) {
    const { tmp, colors } = this;
    const iris = fallen ? null : b.capture > 0.25 && b.lastCaptor >= 0 ? colors[colorIndex(b.lastCaptor) % colors.length] : null;
    const blink = !fallen && Math.sin(this.t * 0.6 + w * 2.1) > 0.985 ? 0.15 : 1;
    for (const s of [-1, 1]) {
      const at = tmp.v.copy(pos).addScaledVector(fwd, r * 0.72).addScaledVector(side, s * r * 0.4);
      at.y += r * 0.15;
      const ball = fallen ? tmp.c.set('#64748b') : iris ? tmp.c.copy(iris) : tmp.c.setScalar(1);
      this.put(this.eyeballs, at, this.tmp.q, r * 0.3, r * 0.3 * blink, r * 0.3, ball);
      if (iris) this.put(this.glows, at, this.tmp.q, r * 0.42, r * 0.42, r * 0.42, tmp.c.copy(iris).multiplyScalar(1.3));
      if (!fallen) {
        at.addScaledVector(fwd, r * 0.24);
        this.put(this.pupils, at, this.tmp.q, r * 0.13, r * 0.13 * blink, r * 0.13, tmp.c.setScalar(0.02));
      }
    }
  }

  // Falling apart: every part flies off, bounces and settles on the floor.
  // A body knocked out before it was ever drawn (dead in its first cycles)
  // has no parts placed yet: those start from where it stands.
  startFall(rt, b) {
    const n = Math.min(this.maxLen, Math.max(rt.drawn, b.cells.length));
    const fall = { pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), axis: [], spin: new Float32Array(n), r: new Float32Array(n) };
    for (let j = 0; j < n; j++) {
      (j < rt.drawn ? rt.slotPos[j] : rt.stage).toArray(fall.pos, j * 3);
      fall.vel.set([(hash(j * 3.1) - 0.5) * 1.6, 0.6 + hash(j * 5.3) * 1.8, (hash(j * 7.7) - 0.5) * 1.6], j * 3);
      fall.axis.push(new THREE.Vector3(hash(j) - 0.5, hash(j + 1) - 0.5, hash(j + 2) - 0.5).normalize());
      fall.spin[j] = 2 + hash(j * 9.1) * 6;
      fall.r[j] = rt.slotR[j];
    }
    return fall;
  }
  stepFall(rt, dt) {
    const f = rt.fall;
    for (let j = 0; j < f.r.length; j++) {
      const k = j * 3;
      f.vel[k + 1] -= 7 * dt;
      f.pos[k] += f.vel[k] * dt; f.pos[k + 1] += f.vel[k + 1] * dt; f.pos[k + 2] += f.vel[k + 2] * dt;
      if (f.pos[k + 1] < f.r[j]) {
        f.pos[k + 1] = f.r[j];
        f.vel[k + 1] *= -0.3;
        f.vel[k] *= 0.6; f.vel[k + 2] *= 0.6;
        f.spin[j] *= 0.6;
      }
    }
  }

  // Where a shot starts or lands: a part as drawn this frame, else the chest.
  endPoint(end) {
    const rt = this.rt?.[end.w];
    if (!rt) return null;
    if (end.i >= 0 && end.i < rt.drawn && rt.slotR[end.i] > 0.004) return rt.slotPos[end.i].clone();
    if (this.mapOn && end.cell >= 0) return this.cellFloor(end.cell, new THREE.Vector3());
    return rt.stage.clone().setY(0.85);
  }

  drawFlying(now) {
    const { tmp, colors } = this;
    const keep = [];
    for (const p of this.flying) {
      const a = this.endPoint(p.from), z = this.endPoint(p.to);
      if (!a || !z) continue;
      const t = (this.t - p.t0) / FLIGHT_S;
      if (t >= 1) {
        const body = this.model.bodies[p.to.w];
        if (!p.minor && body && p.to.i >= 0) { body.lastHit[p.to.i] = now; body.lastHitBy[p.to.i] = p.attacker; }
        this.impact(p.kind, z, p.attacker, p.minor);
        continue;
      }
      keep.push(p);
      const lift = 0.35 + a.distanceTo(z) * 0.3;
      const base = p.kind === 'bombed' ? BOMB : colors[colorIndex(p.attacker) % colors.length];
      const glow = p.minor ? 0.7 : 3;
      for (let k = 0; k <= TRAIL; k++) {
        const tk = t - k * 0.045;
        if (tk < 0) break;
        const at = tmp.v.copy(a).lerp(z, tk);
        at.y += Math.sin(tk * Math.PI) * lift;
        const s = (p.minor ? 0.025 : 0.045) * (1 - k / (TRAIL + 1.5));
        const c = tmp.c.copy(base).multiplyScalar(glow * (1 - k / (TRAIL + 1)));
        if (k === 0 && p.kind === 'stunned') {          // a spinning net
          this.put(this.nets, at, new THREE.Quaternion().setFromAxisAngle(Y, this.t * 9), s * 2.2, s * 2.2, s * 2.2, c);
        } else {
          this.put(this.shots, at, this.tmp.q, s, s, s, c);
        }
      }
    }
    this.flying = keep;
  }

  // A blow lands: sparks, a shock ring and, for the big ones, a flash of light.
  impact(kind, at, attacker, minor) {
    const color = new THREE.Color().copy(this.colors[colorIndex(attacker) % this.colors.length]);
    const spec = {
      kill: { n: 46, speed: 3.0, colors: ['#ffffff', '#fecaca', '#fca5a5'], ring: '#ffffff', light: '#ffe4e6', peak: 7, grav: 2, size: 0.38 },
      bombed: { n: 30, speed: 2.2, colors: ['#ff8a3c', '#fde68a', '#f97316'], ring: '#fb923c', light: '#fb923c', peak: 5, grav: 4 },
      stunned: { n: 16, speed: 1.0, colors: [color], ring: color, light: null, grav: 0.5, inward: true },
      converted: { n: 20, speed: 1.3, colors: [color, '#ffffff'], ring: color, light: color, peak: 2.5, grav: 0.3 },
      chipped: { n: 12, speed: 1.4, colors: [color], ring: null, light: null, grav: 2 },
    }[kind] ?? { n: 10, speed: 1, colors: [color], grav: 1 };
    const n = minor ? Math.ceil(spec.n / 3) : spec.n;
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const sp = spec.speed * (0.4 + Math.random() * 0.8) * (minor ? 0.6 : 1);
      this.spawn(at, Math.cos(th) * s * sp, u * sp + spec.speed * 0.3, Math.sin(th) * s * sp,
        new THREE.Color(spec.colors[k % spec.colors.length]).multiplyScalar(minor ? 1.2 : 2.4), 0.45 + Math.random() * 0.5, spec.grav);
    }
    if (minor) return;
    if (spec.ring) this.rings.push({ at: at.clone(), t0: this.t, dur: kind === 'kill' ? 0.6 : 0.45, color: new THREE.Color(spec.ring).multiplyScalar(1.3), size: spec.size ?? 0.3, inward: !!spec.inward });
    if (spec.light) {
      const f = this.flashes[this.nextFlash++ % this.flashes.length];
      f.light.position.copy(at);
      f.light.color.set(spec.light);
      f.t0 = this.t;
      f.peak = spec.peak;
    }
  }

  spawn(at, vx, vy, vz, color, life, grav) {
    const i = this.pNext++ % MAX_PARTICLES;
    this.pPos.set([at.x, at.y, at.z], i * 3);
    this.pVel.set([vx, vy, vz], i * 3);
    this.pBase.set([color.r, color.g, color.b], i * 3);
    this.pLife[i] = life;
    this.pMax[i] = life;
    this.pGrav[i] = grav;
  }

  stepParticles(dt) {
    const P = this.pPos, V = this.pVel, C = this.pCol, B = this.pBase;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i] <= 0) { if (C[i * 3] || C[i * 3 + 1] || C[i * 3 + 2]) C.fill(0, i * 3, i * 3 + 3); continue; }
      this.pLife[i] -= dt;
      const k = i * 3;
      V[k + 1] -= this.pGrav[i] * dt;
      V[k] *= 1 - 1.5 * dt; V[k + 2] *= 1 - 1.5 * dt;
      P[k] += V[k] * dt; P[k + 1] += V[k + 1] * dt; P[k + 2] += V[k + 2] * dt;
      if (P[k + 1] < 0.01) { P[k + 1] = 0.01; V[k + 1] *= -0.4; }
      const f = Math.max(0, this.pLife[i] / this.pMax[i]) ** 1.5;
      C[k] = B[k] * f; C[k + 1] = B[k + 1] * f; C[k + 2] = B[k + 2] * f;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  drawRings() {
    const q = this.camera.quaternion;
    this.rings = this.rings.filter((g) => this.t - g.t0 < g.dur);
    for (const g of this.rings) {
      const t = (this.t - g.t0) / g.dur;
      const s = g.size * (g.inward ? 1.6 - 1.3 * t : 0.2 + t);
      this.put(this.ringMesh, g.at, q, s, s, s, this.tmp.c.copy(g.color).multiplyScalar((1 - t) ** 2));
    }
  }

  stepFlashes() {
    for (const f of this.flashes) {
      const age = this.t - f.t0;
      f.light.intensity = f.t0 >= 0 && age < 0.35 ? f.peak * (1 - age / 0.35) ** 2 : 0;
    }
  }

  drawHover() {
    for (const cell of new Set([this.hover, this.pinned])) {
      if (cell < 0 || cell >= this.vm.size) continue;
      if (this.mapOn) {                                  // its real place on the floor
        const s = (this.mapW / this.grid.cols) * 1.6;
        this.put(this.markers, this.cellFloor(cell, this.tmp.v2), IDENTITY, s, 1, s, this.tmp.c.setScalar(cell === this.pinned ? 2 : 1.1));
      }
      const part = this.model.partAt(cell);
      if (!part) continue;
      const rt = this.rt[part.w];
      if (part.i >= rt.drawn || rt.slotR[part.i] < 0.004) continue;
      const s = rt.slotR[part.i] * 1.7;
      this.put(this.hoverMesh, rt.slotPos[part.i], this.camera.quaternion, s, s, s, this.tmp.c.setScalar(cell === this.pinned ? 1.6 : 0.8));
    }
  }

  drawCycle(vm) {
    const frac = Math.min(1, vm.cycle / vm.settings.maxCycles);
    const step = Math.round(frac * 240);
    if (step === this.cycleStep) return;
    this.cycleStep = step;
    this.cycleRing.geometry.dispose();
    this.cycleRing.geometry = step
      ? new THREE.RingGeometry(this.cycleR - 0.04, this.cycleR + 0.04, 160, 1, Math.PI / 2, (step / 240) * Math.PI * 2).rotateX(-Math.PI / 2)
      : new THREE.BufferGeometry();
  }

  // The director: sways round the arena, pushes in on a kill, swings to a
  // knockout. Moving the camera yourself pauses it for a few seconds.
  direct(now, dt) {
    const user = this.userHolding || now - this.userAt < USER_PAUSE_MS;
    if (!user) {
      const target = new THREE.Vector3(0, 0.9, 0);
      if (this.mapOn) {                                  // between the living avatars
        const alive = this.rt.filter((rt, w) => this.model.bodies[w].alive);
        if (alive.length) {
          for (const rt of alive) target.add(rt.stage.clone().multiplyScalar(0.6 / alive.length));
          target.y = 0.7;
        }
      }
      let dist = this.home.dist, height = this.home.height;
      const az = Math.sin(this.t * 0.13) * 0.3;
      if (this.focus && now < this.focus.until) {
        const at = this.endPoint({ w: this.focus.w, i: this.focus.i });
        if (at) {
          const life = (now - this.focus.start) / (this.focus.until - this.focus.start);
          const k = Math.min(1, life * 4, (1 - life) * 3);
          target.lerp(at, 0.4 * k);
          dist *= 1 - 0.2 * k;
          height *= 1 - 0.1 * k;
        }
      }
      const want = new THREE.Vector3(Math.sin(az) * dist, height, Math.cos(az) * dist).add(new THREE.Vector3(target.x * 0.5, 0, this.mapOn ? target.z : 0));
      const k = 1 - Math.exp(-dt * 2.2);
      this.camera.position.lerp(want, k);
      this.controls.target.lerp(target, k);
    }
    this.controls.update();
  }

  // Names and status over the avatars, nudged up where they would overlap.
  drawLabels(vm) {
    const v = this.tmp.v;
    const W = this.canvas.clientWidth || this.w, H = this.canvas.clientHeight || this.h;
    const placed = [];
    this.labels.map((l, w) => {
      const rt = this.rt[w];
      v.copy(rt.stage).setY(Math.max(rt.top, 0.4) + 0.12).project(this.camera);
      return { l, w, x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, off: v.z > 1 || Math.abs(v.x) > 1.2 };
    }).sort((p, q) => q.y - p.y).forEach(({ l, w, x, y, off }) => {
      if (off) { l.el.hidden = true; return; }
      let top = y;
      for (let moved = true; moved;) {
        moved = false;
        for (const o of placed) {
          if (Math.abs(o.x - x) < 120 && Math.abs(o.y - top) < 46) { top = o.y - 46; moved = true; }
        }
      }
      top = Math.max(62, top);                       // never off the top
      placed.push({ x, y: top });
      l.el.hidden = false;
      l.el.style.left = `${x}px`;
      l.el.style.top = `${top}px`;
      const text = this.model.status(vm, w);
      if (text !== l.last) { l.text.textContent = text; l.last = text; }
      l.bar.style.width = `${Math.round(this.model.bodies[w].integrity * 100)}%`;
    });
  }
}
