// Small matched screen of cached public-reference extractions. Not an admission
// gate, not a reproduction of native hill rankings, and never a source mutation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, RULESETS, measureSpecies } from '../src/engine/index.js';
import { createPool, libraryOpponents, evaluate } from '../tools/hill.js';
import { buildRecipe, recipeDefaults } from '../tools/blocks/recipes.js';
import { hash } from '../tools/blocks/inventory.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'docs/hill-leaders.json'), 'utf8'));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: node scripts/benchmark-leader-breakouts.js [--out directory]');
const out = path.resolve(args[1] ?? path.join(root, 'evolved/leader-breakouts'));
if (fs.existsSync(path.join(out, 'report.json'))) throw new Error('Report already exists; preserve it before starting another screen.');
const report = { schemaVersion: 1, snapshotAt: snapshot.fetchedAt, seeds: [2424601, 2434601], rounds: 8, backend: 'CPU',
  purpose: 'Exploratory matched screen only. Previously used local library opponents, two placement seeds, no winner promotion or hill-strength claim.', groups: [] };
const pool = createPool(4);
try {
  for (const rules of ['94x', '88', '94nop', 'lp']) {
    const settings = { ...RULESETS[rules], maxLength: 50 };
    const files = rules === '88' ? ['88/dwarf.red', '88/scout-88.red', '88/mice.red', '88/vampire.red'] : ['dwarf.red','scanner.red','mice.red','twopass.red'];
    const library = libraryOpponents(RULESETS[rules]);
    const field = files.map(file => library.find(x=>x.file===file));
    if (field.some(x=>!x || !measureSpecies(x.w, settings).survives)) throw new Error(`Opponent missing or fails solo: ${rules}`);
    const entries = snapshot.extractions.filter(x=>x.rules===rules && x.compile.ok).map(x => {
      const source = fs.readFileSync(path.join(root, 'imported/hill-leaders/extracted', x.id+'.red'), 'utf8');
      if (hash(source)!==x.outputHash) throw new Error(`Reference extraction changed: ${x.id}`);
      const w = compile(source,'redcode',settings);
      if (!w.ok || !measureSpecies(w,settings).survives) throw new Error(`Invalid extraction: ${x.id}`);
      return { name:x.id, w, sourceHash:x.outputHash, sourceUrl:x.sourceUrl };
    });
    for (const PHASE of [0,1,2]) {
      const b = buildRecipe({...recipeDefaults,OPENING:0,RELOCATE:0,PHASE},{rules});
      entries.push({ name:['plain-DAT','plain-short','plain-full'][PHASE], w:b.w, sourceHash:hash(b.source) });
    }
    const group = { rules, settings, opponents:field.map(x=>({file:x.file,name:x.name,codeHash:hash(JSON.stringify(x.w.instructions))})), results:[] };
    for (const entry of entries) {
      const runs = [];
      for (const seed of report.seeds) runs.push({seed,...await evaluate(pool,entry.w,field,{settings,rounds:report.rounds,seed})});
      group.results.push({name:entry.name,sourceHash:entry.sourceHash,sourceUrl:entry.sourceUrl,instructions:entry.w.instructions.length,runs,score:runs.reduce((n,r)=>n+r.score,0)/runs.length});
    }
    report.groups.push(group);
    console.log(JSON.stringify({rules,results:group.results.map(x=>({name:x.name,score:x.score}))}));
  }
  report.battleRounds = report.groups.reduce((n,g)=>n+g.results.length*g.opponents.length*report.seeds.length*report.rounds,0);
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/hill-leader-screen.json'),JSON.stringify(report,null,2)+'\n');
} finally { await pool.close(); }
