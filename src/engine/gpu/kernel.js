// One invocation owns a match: its core, FIFO queues and persistent P-space.
// Different matches can execute concurrently; instructions within one match
// remain strictly ordered. Dispatches yield after a bounded instruction count.
export function gpuKernel(s, stride, chunkSteps, live = null, solo = null) {
  const torus = s.topology === 'torus';
  const count = solo ? 1 : live?.count ?? 2, core = live?.core ?? 32, words = solo ? 5 : live ? 8 : 4;
  return `
const N = ${s.coreSize}u;
const P = ${s.maxProcesses}u;
const PS = ${s.pSpaceSize}u;
const CYCLES = ${s.maxCycles}u;
const STRIDE = ${stride}u;
const QOFF = ${core + s.coreSize * words}u;
const PSOFF = QOFF + ${count}u * P;
const TORUS = ${torus};
const DIMS = vec3<i32>(${s.sizeX ?? s.coreSize}, ${s.sizeY ?? 1}, ${s.sizeZ ?? 1});
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> memory: array<u32>;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@group(0) @binding(3) var<storage, read_write> finished: atomic<u32>;
var<private> base: u32;
var<private> lane: u32;
var<private> roundNo: u32;
var<private> initialized: u32;
var<private> steps: u32;
var<private> cycle: u32;
var<private> turn: u32;
var<private> heads: array<u32, ${count}>;
var<private> sizes: array<u32, ${count}>;
var<private> foreign: array<u32, ${count}>;
var<private> postCell: i32;
var<private> postField: u32;

fn wrap(v: i32, n: i32) -> i32 { return ((v % n) + n) % n; }
fn parts(v: u32) -> vec3<i32> {
  let half = DIMS / 2;
  let x = (i32(v) + half.x) % DIMS.x - half.x;
  let r = (i32(v) - x) / DIMS.x;
  let y = (r + half.y) % DIMS.y - half.y;
  let z = ((r - y) / DIMS.y + half.z) % DIMS.z - half.z;
  return vec3<i32>(x, y, z);
}
fn encode(v: vec3<i32>) -> u32 {
  let h = DIMS / 2;
  let b = ((v + h) % DIMS + DIMS) % DIMS - h;
  return u32(wrap(b.x + DIMS.x * (b.y + DIMS.y * b.z), i32(N)));
}
fn add(a: u32, b: u32) -> u32 {
  if (TORUS) { return encode(parts(a) + parts(b)); }
  return (a + b) % N;
}
fn sub(a: u32, b: u32) -> u32 {
  if (TORUS) { return encode(parts(a) - parts(b)); }
  return (a + N - b) % N;
}
fn mulmod(a: u32, b: u32, n: u32) -> u32 {
  if (n <= 65536u) { return (a * b) % n; }
  var x = a; var y = b; var r = 0u;
  while (y != 0u) {
    if ((y & 1u) != 0u) { r = (r + x) % n; }
    x = (x + x) % n; y >>= 1u;
  }
  return r;
}
fn calc(op: u32, a: u32, b: u32) -> u32 {
  if (op == 2u) { return add(a, b); }
  if (op == 3u) { return sub(a, b); }
  if (TORUS) {
    let ap = parts(a); let bp = parts(b);
    let aa = vec3<u32>((ap % DIMS + DIMS) % DIMS);
    let bb = vec3<u32>((bp % DIMS + DIMS) % DIMS);
    var out = aa;
    for (var k = 0u; k < 3u; k++) {
      if (op == 4u) { out[k] = mulmod(aa[k], bb[k], u32(DIMS[k])); }
      else if (bb[k] != 0u) {
        if (op == 5u) { out[k] = aa[k] / bb[k]; }
        else { out[k] = aa[k] % bb[k]; }
      }
    }
    return encode(vec3<i32>(out));
  }
  if (op == 4u) { return mulmod(a, b, N); }
  if (b == 0u) { return a; }
  if (op == 5u) { return a / b; }
  return a % b;
}
fn cell(pc: u32) -> u32 { return base + ${core}u + pc * ${words}u; }
${live ? live.helpers : solo ? solo.helpers : 'fn touch(pc: u32) { memory[cell(pc) + 3u] = turn; }'}
fn resolve(mode: u32, field: u32, pc: u32) -> u32 {
  postCell = -1;
  if (mode == 0u) { return pc; }
  let p = add(pc, field);
  if (mode == 1u) { return p; }
  let f = select(2u, 1u, (mode & 1u) == 0u);
  let idx = cell(p) + f;
  if (mode == 4u || mode == 5u) {
    memory[idx] = (memory[idx] + N - 1u) % N; touch(p);
  }
  if (mode == 6u || mode == 7u) { postCell = i32(p); postField = f; }
  return add(p, memory[idx]);
}
fn post() {
  if (postCell >= 0) {
    let p = u32(postCell); let idx = cell(p) + postField;
    memory[idx] = (memory[idx] + 1u) % N; touch(p);
  }
}
fn push(pc: u32, heading: u32) {
  if (sizes[turn] >= P) { return; }
  memory[base + QOFF + turn * P + (heads[turn] + sizes[turn]) % P] = pc + N * heading;
  sizes[turn]++;
}
fn headingStep(h: u32) -> u32 {
  var v = vec3<i32>(0);
  v[h / 2u] = select(1, -1, (h & 1u) != 0u);
  return encode(v);
}

${live || solo ? '' : `
fn initRound() {
  for (var p = 0u; p < N; p++) {
    let c = cell(p);
    memory[c] = 2432u; memory[c + 1u] = 0u; memory[c + 2u] = 0u; memory[c + 3u] = 2u;
  }
  if (roundNo == 0u) {
    for (var p = 0u; p < 2u * PS; p++) { memory[base + PSOFF + p] = 0u; }
    memory[base + PSOFF] = N - 1u; memory[base + PSOFF + PS] = N - 1u;
  }
  let t = 1u + lane * 9u;
  let pos = input[t + 7u] + roundNo * 3u;
  for (var side = 0u; side < 2u; side++) {
    let desc = t + side * 3u;
    let start = input[pos + side];
    for (var k = 0u; k < input[desc + 1u]; k++) {
      let c = cell(add(start, k)); let src = input[desc] + k * 3u;
      memory[c] = input[src]; memory[c + 1u] = input[src + 1u]; memory[c + 2u] = input[src + 2u];
      memory[c + 3u] = side;
    }
    heads[side] = 0u; sizes[side] = 1u; foreign[side] = 0u;
    memory[base + QOFF + side * P] = add(start, input[desc + 2u]);
  }
  cycle = 0u; steps = 0u; turn = input[pos + 2u]; initialized = 1u;
}
`}

// Returns true when the current process dies. Registers are captured in the
// same order as VM.execute(), including operand postincrement side effects.
fn execute(pc: u32, h: u32) -> bool {
  ${live ? 'memory[cell(pc) + 5u] = steps;' : ''}
  let c = cell(pc); let ins = memory[c];
  let op = ins & 31u; let modifier = (ins >> 5u) & 7u;
  let am = (ins >> 8u) & 7u; let bm = (ins >> 11u) & 7u;
  let ia = memory[c + 1u]; let ib = memory[c + 2u];
  let ap = resolve(am, ia, pc); let ac = cell(ap);
  let ah = memory[ac]; let aa = memory[ac + 1u]; let ab = memory[ac + 2u]; post();
  let bp = resolve(bm, ib, pc); let bc = cell(bp);
  let ba = memory[bc + 1u]; let bb = memory[bc + 2u]; post();
  let delta = select(1u, headingStep(h), TORUS);
  let next = add(pc, delta); let skip = add(next, delta);
  if (op == 0u) { return true; }
  if (op == 1u) {
    switch modifier {
      case 0u: { memory[bc + 1u] = aa; }
      case 1u: { memory[bc + 2u] = ab; }
      case 2u: { memory[bc + 2u] = aa; }
      case 3u: { memory[bc + 1u] = ab; }
      case 5u: { memory[bc + 1u] = ab; memory[bc + 2u] = aa; }
      default: {
        memory[bc + 1u] = aa; memory[bc + 2u] = ab;
        if (modifier == 6u) { memory[bc] = ah; }
      }
    }
    touch(bp); push(next, h); return false;
  }
  if (op >= 2u && op <= 6u) {
    let useA = modifier != 1u && modifier != 2u;
    let useB = modifier != 0u && modifier != 3u;
    let srcA = select(aa, ab, modifier == 3u || modifier == 5u);
    let srcB = select(ab, aa, modifier == 2u || modifier == 5u);
    let okA = op < 5u || srcA != 0u;
    let okB = op < 5u || srcB != 0u;
    if (useA && okA) { memory[bc + 1u] = calc(op, ba, srcA); }
    if (useB && okB) { memory[bc + 2u] = calc(op, bb, srcB); }
    touch(bp);
    if ((useA && !okA) || (useB && !okB)) { return true; }
    push(next, h); return false;
  }
  if (op == 7u) { push(ap, h); return false; }
  if (op == 8u || op == 9u) {
    var zero = ba == 0u && bb == 0u;
    if (modifier == 0u || modifier == 3u) { zero = ba == 0u; }
    if (modifier == 1u || modifier == 2u) { zero = bb == 0u; }
    push(select(next, ap, select(!zero, zero, op == 8u)), h); return false;
  }
  if (op == 10u) {
    var nz = false;
    if (modifier != 1u && modifier != 2u) {
      nz = (ba + N - 1u) % N != 0u;
      memory[bc + 1u] = (memory[bc + 1u] + N - 1u) % N;
    }
    if (modifier != 0u && modifier != 3u) {
      nz = nz || (bb + N - 1u) % N != 0u;
      memory[bc + 2u] = (memory[bc + 2u] + N - 1u) % N;
    }
    touch(bp); push(select(next, ap, nz), h); return false;
  }
  if (op == 11u) { push(next, h); push(ap, h); return false; }
  if (op >= 12u && op <= 14u) {
    var yes = false;
    if (op == 12u) {
      switch modifier {
        case 0u: { yes = aa < ba; }
        case 1u: { yes = ab < bb; }
        case 2u: { yes = aa < bb; }
        case 3u: { yes = ab < ba; }
        case 5u: { yes = aa < bb && ab < ba; }
        default: { yes = aa < ba && ab < bb; }
      }
    } else {
      switch modifier {
        case 0u: { yes = aa == ba; }
        case 1u: { yes = ab == bb; }
        case 2u: { yes = aa == bb; }
        case 3u: { yes = ab == ba; }
        case 5u: { yes = aa == bb && ab == ba; }
        default: { yes = aa == ba && ab == bb; if (modifier == 6u) { yes = yes && ah == memory[bc]; } }
      }
      if (op == 14u) { yes = !yes; }
    }
    push(select(next, skip, yes), h); return false;
  }
  if (op == 16u) {
    let fromB = modifier != 0u && modifier != 2u;
    let value = memory[base + PSOFF + turn * PS + select(aa, ab, fromB) % PS];
    memory[bc + select(2u, 1u, modifier == 0u || modifier == 3u)] = value;
    touch(bp); push(next, h); return false;
  }
  if (op == 17u) {
    let value = select(ab, aa, modifier == 0u || modifier == 2u);
    let index = select(bb, ba, modifier == 0u || modifier == 3u);
    memory[base + PSOFF + turn * PS + index % PS] = value;
    push(next, h); return false;
  }
  if (op == 18u && TORUS) {
    let d = parts(sub(ap, pc)); let a = abs(d); var heading = h;
    if (any(a != vec3<i32>(0))) {
      var axis = 2u;
      if (a.x >= a.y && a.x >= a.z) { axis = 0u; }
      else if (a.y >= a.z) { axis = 1u; }
      heading = axis * 2u + select(0u, 1u, d[axis] < 0);
    }
    ${live ? 'memory[war(turn) + 2u] = heading;' : ''}
    push(add(pc, headingStep(heading)), heading); return false;
  }
  push(next, h); return false;
}

${live ? live.entry : solo ? solo.entry : `
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  lane = id.x;
  if (lane >= input[0]) { return; }
  base = lane * STRIDE;
  roundNo = memory[base]; initialized = memory[base + 1u];
  let rounds = input[1u + lane * 9u + 6u];
  if (roundNo >= rounds) { return; }
  steps = memory[base + 2u]; cycle = memory[base + 3u]; turn = memory[base + 4u];
  for (var side = 0u; side < 2u; side++) {
    heads[side] = memory[base + 5u + side]; sizes[side] = memory[base + 7u + side];
    foreign[side] = memory[base + 9u + side];
  }
  for (var n = 0u; n < ${chunkSteps}u; n++) {
    if (initialized == 0u) { initRound(); }
    let q = base + QOFF + turn * P;
    let encoded = memory[q + heads[turn]]; let pc = encoded % N; let heading = encoded / N;
    heads[turn] = (heads[turn] + 1u) % P; sizes[turn]--;
    let owner = memory[cell(pc) + 3u];
    if (owner < 2u && owner != turn) { foreign[turn]++; }
    let deathCycle = cycle;
    let killed = execute(pc, heading);
    // VM.step classifies DAT after operand side effects and execution.
    let enemy = killed && (memory[cell(pc)] & 31u) == 0u && owner < 2u && owner != turn;
    steps++;
    let died = sizes[turn] == 0u;
    let other = 1u - turn;
    var nextTurn = other;
    if (sizes[other] == 0u) { nextTurn = turn; }
    if (nextTurn <= turn) { cycle++; }
    if (died || steps >= CYCLES * 2u) {
      let winner = select(2u, other, died);
      let out = (input[1u + lane * 9u + 8u] + roundNo) * 5u;
      output[out] = winner; output[out + 1u] = cycle;
      output[out + 2u] = select(0xffffffffu, deathCycle, died);
      output[out + 3u] = select(0u, 1u, enemy); output[out + 4u] = foreign[0];
      memory[base + PSOFF] = select(select(1u, 0u, turn == 0u), 2u, !died);
      memory[base + PSOFF + PS] = select(select(1u, 0u, turn == 1u), 2u, !died);
      roundNo++; initialized = 0u;
      if (roundNo >= rounds) { atomicAdd(&finished, 1u); }
      // Bound initialization work too: even a match of instant deaths
      // initializes at most one core per invocation in each dispatch.
      break;
    }
    turn = nextTurn;
  }
  memory[base] = roundNo; memory[base + 1u] = initialized;
  memory[base + 2u] = steps; memory[base + 3u] = cycle; memory[base + 4u] = turn;
  for (var side = 0u; side < 2u; side++) {
    memory[base + 5u + side] = heads[side]; memory[base + 7u + side] = sizes[side];
    memory[base + 9u + side] = foreign[side];
  }
}
`}
`;
}
