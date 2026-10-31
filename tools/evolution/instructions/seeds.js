// Initial sources, grafts and scratch survivors; consumes the run's RNG in order.
import { clone, fits, genomeOf, graft, legal88, randomGenome, toWarrior } from '../../genes.js';
import { strip } from '../../hill.js';
import { measureSolo } from '../execution.js';

export async function initialGenomes({ sources, champions, units, random, options, pool }) {
  const { maxLength, batchSize, scratch, settings, entrySettings, geo } = options;
  const coreSize = settings.coreSize;
  const pick = xs => xs[Math.floor(random() * xs.length)];
  const solo = w => measureSolo(pool, w, settings);
  // Round 1 starts from the sources themselves plus random grafts of their
  // slices; from scratch, from random programs that survive alone, and (with
  // no kings) four of those survivors are generation 0's champions.
  const unitList = Object.values(units).flat();
  const startingSources = sources.map((s) => ({ g: genomeOf(s.w), name: s.w.name })).filter((s) => fits(s.g, maxLength));
  let start = startingSources.map((s) => s.g);
  if (scratch) {
    const alive = [];
    for (let tries = 0; alive.length < Math.max(batchSize, 40) && tries < 20000; tries++) {
      const min = Math.min(4, maxLength);
      const g = randomGenome(min + Math.floor(random() * (maxLength - min + 1)), { coreSize, geo, random, pSpace: entrySettings.pSpace !== false && entrySettings.dialect !== '88' });
      if (settings.dialect === '88') g.code.forEach(legal88);
      if ((await solo(toWarrior(g, 'Random', coreSize))).survives) alive.push(g);
    }
    if (!alive.length) throw new Error('no random program survived alone');
    if (!champions.length) {
      for (const [k, g] of alive.slice(0, 4).entries()) {
        champions.push({ round: 0, name: `Random ${k + 1}`, g, w: strip(toWarrior(g, `Random ${k + 1}`, coreSize)) });
      }
    }
    start.push(...alive);
  }
  const originalCount = start.length;
  for (let tries = 0; start.length < Math.max(batchSize, 40) && tries < 1000 && unitList.length; tries++) {
    const c = graft(clone(pick(unitList)), pick(unitList));
    if (fits(c, maxLength)) start.push(c);
  }

  return { start, originalCount, startingSources };
}
