import { gpuKernel } from './kernel.js';
import { LIVE_STEPS } from './live-layout.js';

export function liveKernel(settings, layout) {
  const { count: W, contacts: C, events: E } = layout;
  const helpers = `
const W = ${W}u;
fn war(w: u32) -> u32 { return 32u + w * 32u; }
fn event(pc: u32, attacker: u32, victim: u32, kind: u32) {
  let used = memory[13u];
  if (used >= input[1u]) { memory[14u]++; return; }
  let p = ${E}u + used * 4u;
  memory[p] = pc; memory[p + 1u] = attacker; memory[p + 2u] = victim; memory[p + 3u] = kind;
  memory[13u]++;
}
fn touch(pc: u32) {
  let c = cell(pc); let prev = memory[c + 3u];
  if (prev < W && prev != turn) {
    event(pc, turn, prev, 0u);
    let p = ${C}u + (turn * W + prev) * 9u;
    if (memory[p] == 0u) {
      memory[12u]++; memory[p] = memory[12u];
      memory[p + 1u] = cycle; memory[p + 2u] = steps; memory[p + 3u] = pc;
      let writer = memory[7u]; let ir = cell(writer);
      memory[p + 4u] = writer; memory[p + 5u] = memory[ir]; memory[p + 6u] = memory[ir + 1u]; memory[p + 7u] = memory[ir + 2u];
    }
  }
  memory[c + 3u] = turn; memory[c + 4u] = steps; memory[c + 6u] = memory[7u]; memory[c + 7u] = cycle;
}
`;
  const entry = `
@compute @workgroup_size(1)
fn main() {
  base = 0u; steps = memory[0u]; cycle = memory[1u]; turn = memory[2u];
  var budget = bitcast<i32>(memory[3u]); var alive = memory[4u];
  for (var side = 0u; side < W; side++) { heads[side] = memory[war(side)]; sizes[side] = memory[war(side) + 1u]; }
  memory[13u] = 0u; memory[14u] = 0u; memory[16u] = 0u;
  for (var n = 0u; n < min(input[0u], ${LIVE_STEPS}u); n++) {
    if (memory[5u] != 0u) { break; }
    let m = war(turn);
    let v = memory[QOFF + turn * P + heads[turn]]; let pc = v % N; let heading = v / N;
    heads[turn] = (heads[turn] + 1u) % P; sizes[turn]--;
    memory[m + 2u] = heading; memory[m + 3u] = heading;
    steps++; memory[7u] = pc; memory[8u] = heading;
    let c = cell(pc); let owner = memory[c + 3u];
    if (owner < W && owner != turn) {
      memory[m + 7u]++;
      if (memory[m + 8u] == 0u) {
        memory[m + 8u] = 1u; memory[m + 9u] = cycle; memory[m + 10u] = pc; memory[m + 11u] = owner;
        memory[m + 12u] = memory[c]; memory[m + 13u] = memory[c + 1u]; memory[m + 14u] = memory[c + 2u];
      }
    }
    let writer = memory[c + 6u]; let written = memory[c + 7u];
    let killed = execute(pc, heading);
    if (killed) {
      var cause = 3u;
      if ((memory[c] & 31u) == 0u) {
        cause = 1u;
        if (owner == turn) { cause = 0u; } else if (owner >= W) { cause = 2u; }
      }
      memory[m + 15u]++; memory[m + 16u + cause]++;
      memory[m + 20u] = 1u; memory[m + 21u] = cycle; memory[m + 22u] = steps; memory[m + 23u] = pc;
      memory[m + 24u] = memory[c]; memory[m + 25u] = memory[c + 1u]; memory[m + 26u] = memory[c + 2u];
      memory[m + 27u] = cause; memory[m + 28u] = owner; memory[m + 29u] = writer; memory[m + 30u] = written;
      if (cause == 1u) { event(pc, owner, turn, 1u); }
    }
    memory[m + 6u] = max(memory[m + 6u], sizes[turn]);
    if (sizes[turn] == 0u) {
      memory[m + 4u] = 0u; memory[m + 5u] = cycle;
      if (alive >= 2u) { budget = budget - 1 - (budget - 1) / i32(alive); }
      alive--;
    }
    budget--;
    var nextTurn = turn;
    for (var k = 1u; k <= W; k++) { let candidate = (turn + k) % W; if (sizes[candidate] != 0u) { nextTurn = candidate; break; } }
    if (nextTurn <= turn) { cycle++; }
    memory[9u] = turn; memory[10u] = pc; memory[11u] = select(0u, 1u, killed);
    turn = nextTurn; memory[16u]++;
    if ((W > 1u && alive <= 1u) || alive == 0u) {
      memory[5u] = 1u; memory[6u] = 0xffffffffu;
      if (W > 1u && alive == 1u) { for (var i = 0u; i < W; i++) { if (sizes[i] != 0u) { memory[6u] = i; break; } } }
    } else if (budget <= 0) { memory[5u] = 1u; memory[6u] = 0xffffffffu; }
  }
  memory[0u] = steps; memory[1u] = cycle; memory[2u] = turn; memory[3u] = bitcast<u32>(budget); memory[4u] = alive;
  for (var side = 0u; side < W; side++) { memory[war(side)] = heads[side]; memory[war(side) + 1u] = sizes[side]; }
}
`;
  return gpuKernel(settings, layout.words, LIVE_STEPS, { ...layout, helpers, entry });
}
