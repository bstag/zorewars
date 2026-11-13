import { RULESETS, compile, fitsBattlefield, inLibraryFor } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/build.js';
import { combinators } from '../tools/algebra/link.js';
import { leaves } from '../tools/algebra/leaves.js';
import { recipes } from '../tools/algebra/recipes.js';
import { createCpuMatchPool } from '../web/cpu-matches.js';

// This entry is bundled into web/vendor, two levels below the warrior library.
const libraryUrl = new URL('../../warriors/', import.meta.url);
let index;
let fieldCache;
let built;
let run;

function catalog() {
  const blocks = Object.entries({ ...leaves, ...combinators }).map(([id, def]) => ({
    id, purpose: def.purpose, kind: def.kind ?? 'group', params: def.params ?? {}, defaults: def.defaults ?? {},
    kids: def.kids, dialect: def.dialects, topologies: def.topologies ?? ['ring'], testedProfiles: def.testedProfiles ?? [],
    roles: def.knowledge?.parameterRoles ?? {},
  }));
  const starters = Object.entries(recipes).map(([id, { rules, purpose, length, verification }]) =>
    ({ id, rules, purpose, length, verification }));
  return { blocks, starters, rules: RULESETS };
}

async function readLibrary(file) {
  const response = await fetch(new URL(file, libraryUrl));
  if (!response.ok) throw new Error(`Could not load library file ${file} (${response.status}).`);
  return file === 'index.json' ? response.json() : response.text();
}

async function loadField(settings, torus) {
  const key = JSON.stringify(settings);
  if (fieldCache?.key === key) return fieldCache.field;
  index ??= await readLibrary('index.json');
  const entries = index.filter((entry) => inLibraryFor(entry, settings)
    && (!entry.battlefield || entry.battlefield === `torus:${torus}`));
  const sources = await Promise.all(entries.map((entry) => readLibrary(entry.file)));
  const field = { opponents: new Map(), skipped: [] };
  entries.forEach(({ file, name, language }, i) => {
    const warrior = compile(sources[i], language, settings);
    if (fitsBattlefield(warrior, settings)) field.opponents.set(file, { file, name, warrior });
    else field.skipped.push(name);
  });
  fieldCache = { key, field };
  return field;
}

async function benchmark({ opponent, rounds, seed }, post) {
  if (!built) throw new Error('Build a warrior first.');
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 50 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Use 1–50 rounds and a seed from 0 to 4294967295.');
  }
  const { opponents } = await loadField(built.settings, built.torus);
  const entries = opponent ? [opponents.get(opponent)].filter(Boolean) : [...opponents.values()];
  if (!entries.length) throw new Error('No compatible library opponents under these rules.');
  const job = { cancelled: false };
  run = job;
  const pool = createCpuMatchPool({ cancelled: () => job.cancelled });
  try {
    for (const [i, { name, warrior }] of entries.entries()) {
      const result = await pool.match({ a: built.w, b: warrior, settings: { ...built.settings, rounds }, seed });
      post('result', { name, ...result, done: i + 1, total: entries.length });
    }
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  } finally {
    pool.close();
    run = null;
  }
  post('finished', { cancelled: job.cancelled });
}

self.onmessage = async ({ data: { id, type, ...data } }) => {
  const post = (type, value) => self.postMessage({ id, type, value });
  try {
    if (type === 'catalog') post('catalog', catalog());
    if (type === 'starter') post('starter', recipes[data.recipe].tree(data.rules));
    if (type === 'build') {
      built = null;
      const result = buildTree(data.tree, data.options);
      built = { w: result.w, settings: result.settings, torus: data.options.torus };
      post('build', { source: result.source, total: result.total, budget: result.settings.maxLength, scope: result.verification.scope });
      try {
        const { opponents, skipped } = await loadField(built.settings, built.torus);
        post('field', { opponents: [...opponents.values()].map(({ file, name }) => ({ file, name })), skipped });
      } catch (error) {
        post('field-error', error.message);
      }
    }
    if (type === 'benchmark') await benchmark(data, post);
    if (type === 'cancel' && run) run.cancelled = true;
  } catch (error) {
    post('error', error.message);
  }
};
