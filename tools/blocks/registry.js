import { buildRecipe, recipeDefaults, recipeSpace, recipeGenerator, recipeSettings } from './recipes.js';
import { buildAirbag, airbagDefaults, airbagSpace, airbagGenerator } from './airbag.js';
import { buildCompass, compassDefaults, compassSpace, compassGenerator } from './compass.js';
import { buildCombo, comboDefaults, comboSpace, comboGenerator, comboCanonical, comboRepair, comboSlots } from './combo.js';

// Whole recipes own their pointers, queues and transitions. A family identifier
// is a structural gene; fields cross over only within that family's contract.
export const recipeFamilies = {
  clear: { defaults: recipeDefaults, space: recipeSpace, build: buildRecipe, generator: recipeGenerator,
    rules: ['88', '94nop', 'lp', '94x', '94x-hill'], numeric: ['WAIT', 'STEP', 'HOP', 'STUN'],
    blocks: ['opening-none', 'opening-bomber', 'opening-bscan', 'relocate-copy', 'enter-in-place', 'clear-dat', 'clear-stun-dat'] },
  lifeboat: { defaults: airbagDefaults, space: airbagSpace, build: buildAirbag, generator: airbagGenerator,
    rules: ['94x'], numeric: ['STEP', 'HOP', 'SHOTS', 'STUN'],
    blocks: ['relocate-copy', 'bounded-stone', 'schedule-watchdog', 'clear-dat', 'clear-stun-dat'] },
  compass: { defaults: compassDefaults, space: compassSpace, build: buildCompass, generator: compassGenerator,
    rules: ['94x'], numeric: ['HOP', 'STEP', 'GAP', 'START', 'SCANS', 'STUN', 'DECOYS'],
    blocks: ['relocate-copy', 'comparison-scan', 'scan-to-clear', 'decoy-layout', 'guarded-clear'] },
  // Any fitting combination of the single-process blocks above (tools/blocks/combo.js).
  combo: { defaults: comboDefaults, space: comboSpace, build: buildCombo, generator: comboGenerator, canonical: comboCanonical,
    slots: comboSlots, repair: comboRepair,
    rules: ['88', '94nop', 'lp', '94x', '94x-hill'], numeric: ['WAIT', 'STEP', 'HOP', 'STUN', 'SSTEP', 'GAP', 'START', 'SCANS', 'DECOYS'],
    blocks: ['opening-none', 'opening-bomber', 'opening-bscan', 'opening-cmpscan', 'in-place', 'relocate', 'counted-clear', 'guarded-clear', 'boot-first', 'decoys'] },
};

export function buildBlockRecipe(recipe, options = {}) {
  const family = recipeFamilies[recipe.family], rules = options.rules ?? '94x', length = options.length ?? 50;
  if (!Object.hasOwn(recipeFamilies, recipe.family) || !family.rules.includes(rules)) throw new Error(`Recipe ${recipe.family} is not admitted for ${rules}`);
  const settings = recipeSettings(rules, length);
  const P = recipe.P;
  if (!P || Object.keys(P).length !== Object.keys(family.space).length) throw new Error('Unexpected recipe parameters');
  for (const [key, [lo, hi]] of Object.entries(family.space)) {
    if (!Number.isSafeInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}`);
  }
  const built = family.build(P, { rules, length });
  if (!built.w.ok || built.w.instructions.length > length || built.verification?.ok !== true) throw new Error('Recipe failed length or behavior gate');
  return { ...built, settings, recipe: { family: recipe.family, P: { ...P } }, generator: family.generator(P, { rules, length }) };
}

export function defaultBlockRecipes(families = Object.keys(recipeFamilies)) {
  return families.map(family => {
    if (!recipeFamilies[family]) throw new Error(`Unknown recipe family: ${family}`);
    return { family, P: { ...recipeFamilies[family].defaults } };
  });
}

// All Planar category memberships are represented. They overlap, and neither
// a historical tag nor a compiling fragment is an admission certificate.
export const familyReadiness = [
  ['stone', ['clear', 'lifeboat'], 'Bounded bombing; probe ownership and timeout.'],
  ['paper', [], 'Copy extent, source restoration, child entry and parent/child queue schedule.'],
  ['vamp', [], 'Fang destination arithmetic, enemy entry, pit ownership and pit safety.'],
  ['stun', ['clear', 'lifeboat', 'compass'], 'Bomb count, process contract and guaranteed pristine transition to DAT.'],
  ['imp', [], 'Core-specific modular step, launch order and process count.'],
  ['clear', ['clear', 'lifeboat', 'compass'], 'Pointer frame, own-image exclusion, phase boundaries and wrap.'],
  ['scan', ['clear', 'compass'], 'Probe width, both target cases, equal-cell blind spots and self-exclusion.'],
  ['pspace', [], 'Separate P-space-enabled profile, cell ownership and between-round state.'],
  ['boot', ['clear', 'lifeboat', 'compass'], 'Exact copied payload, entry process and destination independent of other section lengths.'],
  ['gate', [], 'Gate position, decrement timing and interaction with imp launch/clear processes.'],
  ['quick', [], 'Probe table, decoding arithmetic and correct pointer at handoff.'],
  ['factor', [], 'Special-purpose factoring benchmark and correctness objective; not a combat block.'],
  ['sort', [], 'Special-purpose sorting benchmark and correctness objective; not a combat block.'],
  ['other', ['lifeboat'], 'Watchdog admitted only inside Lifeboat; repair, numeric disruption and reporting remain candidates.'],
].map(([category, recipes, nextContract]) => ({ category, recipes, status: recipes.length ? 'partial' : 'reference', nextContract }));
