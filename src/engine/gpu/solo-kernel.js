// Batched solo execution shares all instruction semantics with matches/live.
// Each lane returns peak processes, coverage, survival and torus shape only.
import { gpuKernel } from './kernel.js';
export function soloKernel(settings, stride, chunkSteps) {
  const helpers = `
fn touch(pc: u32) {
  memory[cell(pc) + 3u] = 0u;
  if (TORUS && DIMS.y > 1 && memory[base + 7u] < 3u) {
    let point = parts(pc);
    if (point.z != 0) { memory[base + 7u] = 3u; }
    else if (point.y != 0) { memory[base + 7u] = 2u; }
  }
}`;
  const entry = `
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  lane = id.x;
  if (lane >= input[0]) { return; }
  base = lane * STRIDE;
  if (memory[base + 1u] != 0u) { return; }
  turn = 0u;
  if (memory[base] == 0u) {
    for (var p = 0u; p < N; p++) {
      let c = cell(p);
      memory[c] = 2432u; memory[c + 1u] = 0u; memory[c + 2u] = 0u;
      memory[c + 3u] = 2u; memory[c + 4u] = 0u;
    }
    for (var p = 0u; p < PS; p++) { memory[base + PSOFF + p] = 0u; }
    memory[base + PSOFF] = N - 1u;
    let desc = 1u + lane * 3u;
    for (var k = 0u; k < input[desc + 1u]; k++) {
      let c = cell(add(0u, k)); let src = input[desc] + k * 3u;
      memory[c] = input[src]; memory[c + 1u] = input[src + 1u]; memory[c + 2u] = input[src + 2u];
      memory[c + 3u] = 0u;
    }
    memory[base + QOFF] = input[desc + 2u];
    memory[base] = 1u; memory[base + 4u] = 1u; memory[base + 5u] = 1u; memory[base + 7u] = 1u;
  }
  steps = memory[base + 2u]; heads[0] = memory[base + 3u]; sizes[0] = memory[base + 4u];
  var peak = memory[base + 5u]; var coverage = memory[base + 6u];
  for (var n = 0u; n < ${chunkSteps}u; n++) {
    if (sizes[0] == 0u || steps >= CYCLES) { break; }
    let v = memory[base + QOFF + heads[0]]; let pc = v % N; let heading = v / N;
    heads[0] = (heads[0] + 1u) % P; sizes[0]--;
    let c = cell(pc);
    if (memory[c + 4u] == 0u) { memory[c + 4u] = 1u; coverage++; }
    cycle = steps; steps++;
    let killed = execute(pc, heading);
    peak = max(peak, sizes[0]);
  }
  memory[base + 2u] = steps; memory[base + 3u] = heads[0]; memory[base + 4u] = sizes[0];
  memory[base + 5u] = peak; memory[base + 6u] = coverage;
  if (sizes[0] == 0u || steps >= CYCLES) {
    let out = lane * 4u;
    output[out] = peak; output[out + 1u] = coverage; output[out + 2u] = select(0u, 1u, sizes[0] > 0u); output[out + 3u] = memory[base + 7u];
    memory[base + 1u] = 1u; atomicAdd(&finished, 1u);
  }
}`;
  return gpuKernel(settings, stride, chunkSteps, null, { helpers, entry });
}
