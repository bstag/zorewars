// Topologies: the shape of the battlefield.
//
// A topology decides how addresses wrap, how far apart two cells are, and
// where warriors may be loaded. The VM executes instructions on a flat array
// of cells; the topology gives that array its geometry. Classic Core War is
// a ring of CORESIZE cells. New battlefields (such as a 3D volume, see
// design/3d-battlefield.md) are added here as further topologies, without
// changing the classic ring or its pMARS-verified behaviour.

import { separationFor } from './constants.js';
import { pmarsRng } from './random.js';

const TOPOLOGIES = {
  ring: ringTopology,
};

export function topologyFor(settings) {
  const kind = settings.topology || 'ring';
  const make = TOPOLOGIES[kind];
  if (!make) throw new Error(`unknown topology '${kind}' (available: ${Object.keys(TOPOLOGIES).join(', ')})`);
  return make(settings);
}

// The classic battlefield: CORESIZE cells in a circle.
export function ringTopology(settings) {
  const size = settings.coreSize;
  const sep = separationFor(settings);
  const norm = (a) => ((a % size) + size) % size;
  // Shortest distance between two addresses, either way round the ring.
  const distance = (a, b) => {
    const d = norm(a - b);
    return Math.min(d, size - d);
  };

  return {
    kind: 'ring',
    size,
    separation: sep,
    norm,
    distance,

    // Start addresses for `count` warriors, driven by a Park-Miller seed so
    // a match is reproducible. Returns [positions, nextSeed].
    // Warrior 0 always loads at 0. With two warriors, warrior 1 loads at
    // separation + seed mod (size + 1 - 2*separation), then the seed
    // advances: the standard rule, which also lets 2-warrior matches be
    // replayed in pMARS with the same -F. With more warriors, each start is
    // drawn at random until it is at least `separation` from every other
    // start (measured round the ring); if that keeps failing, the warriors
    // are spaced evenly from a random offset.
    place(count, seed) {
      const positions = [0];
      if (count < 2) return [positions, seed];
      const spread = size + 1 - 2 * sep;
      if (count === 2) {
        positions.push(sep + (((seed % spread) + spread) % spread));
        return [positions, pmarsRng(seed)];
      }
      if (size < count * sep) throw new Error(`a core of ${size} cells can't hold ${count} warriors ${sep} apart`);
      for (let i = 1; i < count; i++) {
        let placed = false;
        for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
          seed = pmarsRng(seed);
          const candidate = sep + (seed % spread);
          if (positions.every((p) => distance(p, candidate) >= sep)) {
            positions.push(candidate);
            placed = true;
          }
        }
        if (!placed) {
          // Even spacing always fits, because size >= count * separation.
          seed = pmarsRng(seed);
          const gap = Math.floor(size / count);
          const shift = seed % (gap - sep + 1);
          positions.length = 1;
          for (let k = 1; k < count; k++) positions.push(k * gap + shift);
          break;
        }
      }
      return [positions, seed];
    },
  };
}
