// The Park-Miller "minimal standard" generator (Park and Miller, "Random
// Number Generators: Good Ones Are Hard to Find", Communications of the ACM
// 31:10, 1988), in Schrage's overflow-free form. Core War simulators,
// pMARS included, use it for load positions, so using it too keeps
// two-warrior matches reproducible across simulators.
export function pmarsRng(seed) {
  let t = 16807 * (seed % 127773) - 2836 * Math.trunc(seed / 127773);
  if (t < 0) t += 2147483647;
  return t;
}

// Small seeded PRNG so battles are reproducible from a seed.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
