// Reproduce review of cached article snippets. Public originals/derivatives stay ignored.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile,VM,RULESETS} from '../src/engine/index.js';
import {hash} from '../tools/blocks/inventory.js';
import {createPool,libraryOpponents,evaluate} from '../tools/hill.js';
import {buildRecipe,recipeDefaults} from '../tools/blocks/recipes.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const cache=path.join(root,'imported/history/monowire');
const args=process.argv.slice(2);
if(args.length&&(args.length!==2||args[0]!=='--out'))throw new Error('Usage: node scripts/review-monowire.js [--out fresh-directory]');
const out=path.resolve(args[1]??path.join(root,'evolved/monowire-review-20261028'));
if(fs.existsSync(out))throw new Error('Output exists: '+out);
const htmlBytes=fs.readFileSync(path.join(cache,'monowire.htm')),html=htmlBytes.toString('utf8');
const pageUrl='https://corewar.co.uk/mizcu/monowire.htm';
const snippets=[...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map((m,i)=>({
  id:i+1,htmlStartLine:html.slice(0,m.index).split(/\r?\n/).length,
  htmlEndLine:html.slice(0,m.index+m[0].length).split(/\r?\n/).length,
  source:m[1].replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&')}));
if(snippets.length!==9||!snippets[8].source.includes(';name Monowire'))throw new Error('Article structure changed; review extraction');
const original=snippets[8].source;
const originalW=compile(original,'redcode',RULESETS['94nop']);
if(!originalW.ok||originalW.instructions.length!==80||originalW.start!==69)throw new Error('Unexpected original layout');
const landing=originalW.instructions.length-1-1100;
const compact=original.replace(/^for 12$/m,'for 6').replace(/^dst dat #1, -1100\+9$/m,`dst dat #1, up${landing}+9`)
  .replace(';name Monowire',';name Monowire 50 (local decoy reduction)');
if(compact===original||!compact.includes('for 6')||!compact.includes(`up${landing}+9`))throw new Error('Could not construct explicit compact derivative');
const body=original.slice(0,original.indexOf('\nfor 12')).replace(';name Monowire',';name Monowire body (local extraction)')+'\nend up\n';
const cases=[{id:'original-80',source:original,boot:true},{id:'compact-50',source:compact,boot:true},{id:'body-9',source:body,boot:false}];
fs.mkdirSync(out,{recursive:true});
for(const x of snippets)fs.writeFileSync(path.join(cache,`snippet-${String(x.id).padStart(2,'0')}.red`),x.source);
for(const x of cases)fs.writeFileSync(path.join(cache,x.id+'.red'),x.source);
const report={schemaVersion:1,pageUrl,pageHash:hash(htmlBytes),reviewedOn:'2026-10-28',
  codeDate:'Not supplied by article; review date is not publication date',
  methodology:'Unchanged article snippets, final source and two labeled local derivatives. Compact50 reduces 60 decoy cells to30 and adjusts dst symbolically to preserve original payload landing. Body9 removes boot and decoy together. No optimization or promotion.',
  limitations:'Small previously used library panel, two placement seeds, four rounds per opponent. Solo survival and one exact startup copy do not verify scan coverage, first-hit handoff, clear phases or competitive generality. Historical scores are not reproduced.',
  snippets:snippets.map(x=>({id:x.id,htmlStartLine:x.htmlStartLine,htmlEndLine:x.htmlEndLine,sha256:hash(x.source),cache:`imported/history/monowire/snippet-${String(x.id).padStart(2,'0')}.red`,
    assembly:Object.fromEntries(['94nop','94x'].map(r=>{const w=compile(x.source,'redcode',RULESETS[r]);return[r,{ok:w.ok,instructions:w.instructions.length,errors:w.errors.slice(0,4)}];}))})),
  variants:cases.map(x=>({id:x.id,sourceHash:hash(x.source),cache:`imported/history/monowire/${x.id}.red`,boot:x.boot})),
  bootLandingRelativeToOriginalBody:landing,seeds:[20261030,20262030],rounds:4,backend:'CPU',profiles:{},battleRounds:0};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const code=w=>JSON.stringify(w.instructions.map(({line,...x})=>x));
function inspect(w,settings,boot) {
  return [0,settings.coreSize-7].map(base=>{
    const vm=new VM(settings);vm.load([w],{positions:[base]});
    const result={base};
    if(boot) {
      const target=((base+landing)%settings.coreSize+settings.coreSize)%settings.coreSize;
      while(!vm.done&&vm.cycle<30&&!vm.processes(0).includes(target))vm.step();
      const norm=n=>((n%settings.coreSize)+settings.coreSize)%settings.coreSize;
      const expected=w.instructions.slice(0,9).map(({line,...x})=>({...x,a:norm(x.a),b:norm(x.b)}));
      const actual=expected.map((_,i)=>{const {line,...x}=vm.peek(target+i);return x;});
      result.boot={target,entryReached:vm.processes(0).includes(target),exactCopy:JSON.stringify(expected)===JSON.stringify(actual),cycles:vm.cycle};
      if(!result.boot.entryReached||!result.boot.exactCopy)throw new Error('Boot contract failed');
    }
    vm.run();
    return {...result,alive:vm.warriors[0].alive,cycles:vm.cycle,peakProcesses:vm.warriors[0].peak,endingProcesses:vm.processes(0).length};
  });
}
const pool=createPool(4);
try {
  for(const rules of ['94nop','94x']) {
    const settings=RULESETS[rules];
    const originalCompiled=compile(original,'redcode',settings),compactCompiled=compile(compact,'redcode',{...settings,maxLength:50});
    if(!compactCompiled.ok||compactCompiled.instructions.length!==50||code({instructions:originalCompiled.instructions.slice(0,9)})!==code({instructions:compactCompiled.instructions.slice(0,9)}))throw new Error('Compact derivative changed payload');
    const field=libraryOpponents(settings).filter(x=>['dwarf.red','seeker.red','silk.red','vampire.red'].includes(x.file));
    if(field.length!==4)throw new Error('Missing comparison opponent');
    const p=report.profiles[rules]={settings,opponents:field.map(x=>({name:x.name,file:x.file,codeHash:hash(JSON.stringify(x.w)),solo:inspect(x.w,settings,false)})),screen:[],results:[]};
    if(p.opponents.some(x=>x.solo.some(s=>!s.alive)))throw new Error('Comparison opponent fails solo');
    const plain=buildRecipe({...recipeDefaults,OPENING:0,RELOCATE:0,PHASE:0},{rules,length:50});
    const entries=[...cases,{id:'plain-DAT',source:plain.source,boot:false}];
    if(rules==='94x')entries.push({id:'Lifeboat-default',source:fs.readFileSync(path.join(root,'examples/experimental-94x/lifeboat/lifeboat.red'),'utf8'),boot:false});
    for(const entry of entries) {
      const w=compile(entry.source,'redcode',{...settings,maxLength:entry.id==='original-80'?100:50});
      if(!w.ok)throw new Error('Review candidate failed compilation: '+entry.id);
      const solo=inspect(w,settings,entry.boot);
      const eligible=solo.every(s=>s.alive);
      p.screen.push({id:entry.id,instructions:w.instructions.length,sourceHash:hash(entry.source),solo,battleEligible:eligible});save();
      if(!eligible) {console.log(rules+' '+entry.id+': skipped after solo failure');continue;}
      const runs=[];
      for(const seed of report.seeds) {
        runs.push({seed,...await evaluate(pool,w,field,{settings,rounds:report.rounds,seed,diagnose:true})});
        report.battleRounds+=field.length*report.rounds;
      }
      const score=runs.reduce((sum,r)=>sum+r.score,0)/runs.length;
      p.results.push({id:entry.id,score,runs});save();console.log(rules+' '+entry.id+': '+score.toFixed(3));
    }
  }
} finally {pool.close();save();}
console.log(JSON.stringify({out,battleRounds:report.battleRounds}));
