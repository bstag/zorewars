// Exploratory review of unchanged historical sources, not an evolution admission gate.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile,VM,RULESETS} from '../src/engine/index.js';
import {createPool,evaluate,libraryOpponents} from '../tools/hill.js';
import {buildRecipe,recipeDefaults} from '../tools/blocks/recipes.js';
import {hash} from '../tools/blocks/inventory.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--out'))throw new Error('Usage: node scripts/screen-planar-other.js [--out fresh-directory]');
const out=path.resolve(args[1]??path.join(root,'evolved/planar-other-review-20261028'));
if(fs.existsSync(out))throw new Error('Output already exists: '+out);
const archive=JSON.parse(fs.readFileSync(path.join(root,'docs/planar-warrior-history.json'),'utf8'));
const wanted=['AirbagDemo.txt','4-lineBombDodger.txt','kill-9.txt','bunker[1].txt','bunker[2].txt','Dwarfer.txt','DwarferII.txt','tamper.txt','Antivamp.txt','Body-Snatcher3.txt','Signal1.1.txt'];
const candidates=wanted.map(file=>{
  const item=archive.sources.find(x=>x.url.endsWith('/'+file));
  if(!item || !item.components.includes('other'))throw new Error('Missing source '+file);
  const bytes=fs.readFileSync(path.join(root,item.cache));
  if(hash(bytes)!==item.sha256)throw new Error('Changed source '+file);
  const source=new TextDecoder(item.encoding.startsWith('utf-8')?'utf-8':'windows-1252').decode(bytes);
  return {id:file,name:item.name,url:item.url,sha256:item.sha256,source};
});
const settings=RULESETS['94x'],seeds=[20261028,20262028],rounds=4;
const solo=(w,cfg)=>[0,cfg.coreSize-7].map(base=>{
  const vm=new VM(cfg);vm.load([w],{positions:[base]});vm.run();
  return {base,alive:vm.warriors[0].alive,cycles:vm.cycle,peakProcesses:vm.warriors[0].peak,endingProcesses:vm.processes(0).length};
});
const field=libraryOpponents(settings).filter(x=>['dwarf.red','seeker.red','silk.red','vampire.red'].includes(x.file));
if(field.length!==4)throw new Error('Expected the four fixed comparison opponents');
const opponents=field.map(x=>({file:x.file,name:x.name,codeHash:hash(JSON.stringify(x.w)),solo:solo(x.w,settings)}));
if(opponents.some(x=>x.solo.some(s=>!s.alive)))throw new Error('Comparison opponent fails solo');
const report={schemaVersion:1,source:'Planar other-category review',settings,entryLength:50,seeds,rounds,backend:'CPU',
  limitations:'Small exploratory panel with previously used local opponents. Unmodified historical code; 94x failures can reflect old constants. Solo survival is not a repair, relocation, or composition contract. No evolution, tuning, held-out generalization or promotion.',
  sourceManifestHash:hash(fs.readFileSync(path.join(root,'docs/planar-warrior-history.json'))),opponents,screen:[],battleRounds:0};
fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const eligible=[];
for(const x of candidates) {
  const row={id:x.id,name:x.name,url:x.url,sourceHash:x.sha256,profiles:{}};
  for(const rules of ['94nop','94x']) {
    const cfg=RULESETS[rules],w=compile(x.source,'redcode',{...cfg,maxLength:50});
    row.profiles[rules]={compile:w.ok,instructions:w.instructions.length,errors:w.errors,
      ...(w.ok?{solo:solo(w,cfg)}:{})};
    if(rules==='94nop' && w.ok) {
      const extended={...cfg,maxCycles:settings.maxCycles};
      const extendedW=compile(x.source,'redcode',{...extended,maxLength:50});
      row.profiles[rules].extended500k={compile:extendedW.ok,errors:extendedW.errors,
        ...(extendedW.ok?{solo:solo(extendedW,extended)}:{})};
    }
    if(rules==='94x'&&w.ok&&row.profiles[rules].solo.every(s=>s.alive))eligible.push({id:x.id,w});
  }
  row.battleStatus=eligible.some(e=>e.id===x.id)?'eligible for exploratory screen':'skipped: compile or full-cycle solo failure';
  report.screen.push(row);save();console.log(x.id+': '+row.battleStatus);
}
const plain=buildRecipe({...recipeDefaults,OPENING:0,RELOCATE:0,PHASE:0},{rules:'94x',length:50});
const lifeboatSource=fs.readFileSync(path.join(root,'examples/experimental-94x/lifeboat/lifeboat.red'),'utf8');
const lifeboat=compile(lifeboatSource,'redcode',{...settings,maxLength:50});
if(!lifeboat.ok)throw new Error('Lifeboat control failed compilation');
for(const c of [{id:'plain-DAT',w:plain.w,source:plain.source},{id:'Lifeboat-default',w:lifeboat,source:lifeboatSource}]) {
  const checks=solo(c.w,settings);
  if(checks.some(s=>!s.alive))throw new Error('Control fails solo: '+c.id);
  eligible.push(c);
  report.screen.push({id:c.id,control:true,sourceHash:hash(c.source),profiles:{'94x':{compile:true,instructions:c.w.instructions.length,solo:checks}},battleStatus:'eligible for exploratory screen'});
}
const pool=createPool(4);
try {
  report.results=[];
  for(const {id,w} of eligible) {
    const runs=[];
    for(const seed of seeds) {
      runs.push({seed,...await evaluate(pool,w,field,{settings,rounds,seed,diagnose:true})});
      report.battleRounds+=field.length*rounds;
    }
    const score=runs.reduce((n,r)=>n+r.score,0)/runs.length;
    report.results.push({id,score,runs});save();console.log(id+': '+score.toFixed(3));
  }
} finally {pool.close();save();}
console.log(JSON.stringify({out,battleRounds:report.battleRounds,results:report.results.map(({id,score})=>({id,score}))},null,2));
