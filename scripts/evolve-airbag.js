// Original Lifeboat recipe: gated structure/parameter GA, then existing tuner,
// followed by fresh common placements against plain and in-place controls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, RULESETS, measureSpecies, mulberry32 } from '../src/engine/index.js';
import { buildAirbag, airbagDefaults, airbagSpace, airbagGenerator } from '../tools/blocks/airbag.js';
import { buildRecipe, recipeDefaults } from '../tools/blocks/recipes.js';
import { evolveParameters } from '../tools/parameter-evolve.js';
import { tune } from '../tools/tune.js';
import { hash } from '../tools/blocks/inventory.js';
import { createPool, libraryOpponents, evaluate } from '../tools/hill.js';

const root=fileURLToPath(new URL('../',import.meta.url)), args=process.argv.slice(2), opts={};
for(let i=0;i<args.length;i+=2) {
  if(!['--out','--seed','--threads'].includes(args[i]) || !args[i+1])throw new Error('Usage: node scripts/evolve-airbag.js [--out directory] [--seed number] [--threads number]');
  opts[args[i].slice(2)]=args[i+1];
}
const seed=Number(opts.seed??4247),threads=Number(opts.threads??4);
if(!Number.isSafeInteger(seed)||seed<1||seed>1000000||!Number.isInteger(threads)||threads<1||threads>32)throw new Error('Invalid seed or threads');
const out=path.resolve(opts.out??path.join(root,'evolved/lifeboat-4247'));
if(fs.existsSync(out))throw new Error('Use a fresh output directory');
const settings={...RULESETS['94x']}, library=libraryOpponents(settings);
const select=files=>files.map(file=>{
  const x=library.find(w=>w.file===file);if(!x||!measureSpecies(x.w,settings).survives)throw new Error(`Missing/unsafe opponent ${file}`);return x;
});
const field=select(['dwarf.red','scanner.red','silk.red','vampire.red','mice.red','twopass.red']);
const comparison=select(['seeker.red','oneshot.red','fastsilk.js','gatekeeper.js']);
const report={schemaVersion:1,seed,settings,entryLength:50,backend:'CPU',sourceHash:hash(fs.readFileSync(path.join(root,'tools/blocks/airbag.js'),'utf8')),
  schedule:{population:8,generations:3,offspring:8,screenRounds:4,tuneCandidates:8,validationRounds:12,validationSeeds:[seed+2000000,seed+2100000,seed+2200000]},
  field:field.map(({w,...x})=>({...x,codeHash:hash(JSON.stringify(w.instructions))})),comparison:comparison.map(({w,...x})=>({...x,codeHash:hash(JSON.stringify(w.instructions))})),
  limitations:'Previously examined local panels; fresh placements are not a new opponent distribution. Scores do not imply public-hill strength. No default promotion. Fallback protects selected faults, not every possible enemy write.',history:[]};
fs.mkdirSync(out,{recursive:true});
const save=stage=>{report.stage=stage;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(stage);};
const rawPool=createPool(threads);let rounds=0;
const pool={match(task){rounds+=task.settings.rounds;return rawPool.match(task);}};
const score=async(b,matchSeed,roundCount=4,opponents=field)=>{
  const r=await evaluate(pool,b.w,opponents,{settings,seed:matchSeed,rounds:roundCount});return {...r,fit:r.score,cases:r.rows.map(x=>x.pts)};
};
const compact=b=>({P:b.P,sourceHash:hash(b.source),instructions:b.w.instructions.length,verification:b.verification});
try {
  save('Lifeboat baseline passes boot, attack, guard and timeout gates');
  const search=await evolveParameters({space:airbagSpace,current:airbagDefaults,seed,populationSize:8,generations:3,offspring:8,
    initial:[0,1,2].flatMap(PHASE=>[0,1].map(BOOT=>({...airbagDefaults,PHASE,BOOT}))),build:buildAirbag,
    evaluate:(b,generation)=>score(b,seed+generation*10000),onGeneration:r=>{report.history.push(r);save(`Generation ${r.generation}: ${r.score.toFixed(3)} points/round`);}});
  report.search={stats:search.stats,rejected:search.rejected,candidates:search.candidates.map(c=>({id:c.id,operator:c.operator,parents:c.parents,generation:c.generation,...compact(c)}))};
  const champion=search.population[0];
  let refined={...champion,...await score(champion,seed+500000)};
  report.refinement=[];
  for(const key of ['STEP','HOP','SHOTS','STUN']) {
    const [lo,hi]=airbagSpace[key],radius=Math.max(1,Math.round((hi-lo)/64)),parent=refined;
    for(const direction of [-1,1]) {
      const b=buildAirbag({...parent.P,[key]:Math.max(lo,Math.min(hi,parent.P[key]+direction*radius))}),r=await score(b,seed+500000);
      report.refinement.push({...compact(b),parameter:key,score:r.score});
      if(r.score>refined.score)refined={...b,...r};
    }
  }
  const generator=airbagGenerator(refined.P).replace(/^\/\/ SPACE .*$/m,`// SPACE ${JSON.stringify(Object.fromEntries(['STEP','HOP','SHOTS','STUN'].map(k=>[k,airbagSpace[k]])))}`);
  const random=Math.random;let pending;
  try { Math.random=mulberry32(seed+33);pending=tune({pool,source:generator,field,settings,candidates:8,screenRounds:4,checkRounds:8,seeds:3,finalists:3}); }
  finally {Math.random=random;}
  report.tuning=await pending;
  for(const r of report.tuning.results)buildAirbag(r.P);
  const tuned=buildAirbag(report.tuning.best.P);
  save('Search and parameter tuning complete; validating matched controls');
  const entries=[{name:'baseline',b:buildAirbag()},{name:'ga-champion',b:champion},{name:'parameter-steps',b:refined},{name:'tuner-choice',b:tuned},
    {name:'same-parameters-booted',b:buildAirbag({...tuned.P,BOOT:1})},{name:'same-parameters-in-place',b:buildAirbag({...tuned.P,BOOT:0})}];
  for(const PHASE of [0,1,2])entries.push({name:['plain-DAT','plain-short','plain-full'][PHASE],b:buildRecipe({...recipeDefaults,OPENING:0,RELOCATE:0,PHASE})});
  const reference=path.join(root,'imported/hill-leaders/extracted/airbag-stone-94x.red');
  if(fs.existsSync(reference)) {
    const source=fs.readFileSync(reference,'utf8'), w=compile(source,'redcode',{...settings,maxLength:50});
    const expected=JSON.parse(fs.readFileSync(path.join(root,'docs/hill-leaders.json'),'utf8')).extractions.find(x=>x.id==='airbag-stone-94x');
    if(!expected || hash(source)!==expected.outputHash)throw new Error('Public reference differs from its reviewed snapshot');
    if(!w.ok||!measureSpecies(w,settings).survives)throw new Error('Public reference no longer usable');
    entries.push({name:'public-stone-reference',b:{source,w}});
  } else report.publicReference='not cached; rerun scripts/hill-leaders.js to include it';
  report.validation=[];
  for(const {name,b} of entries) {
    const runs=[];
    for(const s of report.schedule.validationSeeds)runs.push({seed:s,training:await score(b,s,12),comparison:await score(b,s,12,comparison)});
    report.validation.push({name,...compact(b),runs});
    fs.writeFileSync(path.join(out,name+'.red'),b.source);
    if(b.P && Object.hasOwn(b.P,'SHOTS')) {
      fs.writeFileSync(path.join(out,name+'.js'),airbagGenerator(b.P));
      fs.writeFileSync(path.join(out,name+'.recipe.json'),JSON.stringify({rules:'94x',...compact(b)},null,2));
    }
    console.log(`Validated ${name}`);
  }
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  report.summary=report.validation.map(x=>({name:x.name,instructions:x.instructions,training:mean(x.runs.map(r=>r.training.score)),comparison:mean(x.runs.map(r=>r.comparison.score))}));
  report.paired=[];
  const pair=(entry,control)=>{
    for(const panel of ['training','comparison']) {
      const deltas=entry.runs.map((r,i)=>r[panel].score-control.runs[i][panel].score),gain=mean(deltas),margin=2.5*Math.sqrt(deltas.reduce((s,x)=>s+(x-gain)**2,0)/(deltas.length-1)/deltas.length);
      report.paired.push({entry:entry.name,control:control.name,panel,gain,margin,exceedsNoiseGuard:gain>margin});
    }
  };
  for(const x of report.validation.slice(1,4))for(const control of [report.validation[0],...report.validation.slice(6)])pair(x,control);
  pair(report.validation[4],report.validation[5]);
  report.battleRounds=rounds;save('Complete; candidates retained for study, no automatic promotion');console.log(JSON.stringify(report.summary));
} finally {await rawPool.close();}
