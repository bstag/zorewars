import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {buildTree,link,recipes,leaves,treeSettings,configureStoneImp,stoneImpLayout,mutate,COUPLED_MUTATIONS,describeBlock,observeTree,verifyPhases} from '../tools/algebra/index.js';
import {compile,mulberry32,VM} from '../src/engine/index.js';import {codeHash,assertSameState} from '../tools/comparison/paired.js';
import {treeCommandOptions} from '../cli/tree-evolution.js';
import {evolveTrees} from '../tools/algebra/evolve.js';import {createPool,libraryOpponents} from '../tools/hill.js';
const settings=treeSettings('94nop',100),base=()=>recipes['fanboot-stone-imp-example'].tree('94nop'),read=p=>fs.readFileSync(new URL('./fixtures/'+p,import.meta.url),'utf8');
test('supported pump and three ordinary recipes reproduce public example images',()=>{
 assert.ok(leaves['compact-imp-pump']);assert.equal(describeBlock('compact-imp-pump').draft,false);assert.equal(describeBlock('compact-imp-pump').status,'supported');
 for(const [name,file]of [['fanboot-stone-imp-example','stone-imp-example.red'],['fanboot-stone-imp-preseeded','stone-imp-preseeded.red'],['fanboot-stone-imp-seed-only','stone-imp-seed-only.red']]){const tree=recipes[name].tree('94nop'),b=buildTree(tree,{rules:'94nop',length:100,verification:'full'});assert.equal(b.total,69);assert.equal(codeHash(b.w,8000),codeHash(compile(read(file),'redcode',settings),8000));assert.equal(b.verification.observations.length,6);assert.deepEqual(Object.values(stoneImpLayout(tree,settings)).slice(0,3),[3418,2455,2523]);}
 const proc=spawnSync(process.execPath,['--input-type=module','-e','import {leaves} from "./tools/algebra/index.js";if(!leaves["compact-imp-pump"])process.exit(1)'],{encoding:'utf8',env:{...process.env,ALGEBRA_DRAFTS:'_compact-pump.js'}});assert.equal(proc.status,0,proc.stderr);
 const local=buildTree(recipes['fanboot-stone-imp-local-template'].tree('94nop'),{rules:'94nop',length:100,verification:'full'});assert.equal(local.total,70);assert.equal(codeHash(local.w,8000),codeHash(compile(read('stone-imp-local-template.red'),'redcode',settings),8000));
});
test('joint configuration compensates image layout, pump movement and lead without mutating input',()=>{
 const original=base(),copy=structuredClone(original),p=configureStoneImp(original,settings,{seedMode:1,path:2,pumpShift:-4,scan:{QFAC:247}});assert.deepEqual(original,copy);assert.deepEqual(p.preserved,{stone:true,pump:false,seed:true});assert.equal(p.after.pump,2451);assert.equal(p.after.seed,2523);assert.equal(p.after.lead,68);assert.equal(p.after.stone,3418);assert.equal(p.after.points,7);assert.equal(p.after.stoneWorkers,4);
 const q=configureStoneImp(base(),settings,{seedMode:1,path:2});const b=buildTree(q.tree,{rules:'94nop',length:100,verification:'full'});assert.equal(b.verification.observations[0].observation.blocks.find(x=>x.role==='imp-pump').phases['imp-running'].cycle,87);
 const shared=configureStoneImp(q.tree,settings,{path:0});assert.equal(shared.after.instructions,69);assert.equal(shared.after.wait,0);assert.deepEqual(shared.preserved,{stone:true,pump:true,seed:true});
});
test('explicit seed movement and lead choices are distinct, including core wrap',()=>{
 const a=configureStoneImp(base(),settings,{pumpShift:-4,seedShift:4});assert.equal(a.after.lead,72);assert.equal(a.after.seed,2527);
 const b=configureStoneImp(base(),settings,{pumpShift:-4,lead:64});assert.equal(b.after.seed,2519);
 const c=configureStoneImp(base(),settings,{seedMode:1,exact:1,pumpShift:-2600,seedShift:-2600});assert.equal(c.after.pump,7855);assert.equal(c.after.seed,7923);assert.equal(c.after.lead,64);
});
test('bad options, incompatible targets and quiet purpose failures remain rejected',()=>{
 for(const options of [{lead:64,seedShift:0},{pumpShift:100},{unknown:1},{wait:1},{seedMode:6},{path:3},{scan:{TYPO:1}},{burst:{STEP:0}},{pumpShift:0.1},{scan:[]}])assert.throws(()=>configureStoneImp(base(),settings,options),JSON.stringify(options));
 assert.throws(()=>configureStoneImp(base(),{...settings,topology:'torus'},{}),/ring/);
 assert.throws(()=>configureStoneImp(base(),{...settings,maxLength:50},{}),/budget/);
 assert.throws(()=>buildTree(configureStoneImp(base(),settings,{path:2,seedMode:0}).tree,{rules:'94nop',length:100,verification:'full'}),/only 5 compatible/);
});
test('opt-in coupled mutations are deterministic, preserve the seed, and report intent',()=>{
 for(const op of COUPLED_MUTATIONS){const a=mutate(base(),settings,mulberry32(14),60,[op]),b=mutate(base(),settings,mulberry32(14),60,[op]);assert.ok(a,op);assert.deepEqual(a,b);assert.equal(a.configuration.after.seed,2523);assert.equal(a.configuration.after.points,7);assert.equal(a.configuration.after.stoneWorkers,4);assert.ok(a.configuration.scope.includes('separate'));}
 assert.equal(mutate({id:'stone'},settings,mulberry32(1),3,['tune-placement']),null);
});
test('ordinary CLI recipe/configure paths build before saving and preserve legacy activation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zw-stone-options-'));try{const source=path.join(dir,'recipe.red'),tree=path.join(dir,'recipe.json'),opts=path.join(dir,'options.json');
  const run=argv=>spawnSync(process.execPath,['scripts/algebra.js',...argv],{encoding:'utf8',env:{...process.env,ALGEBRA_DRAFTS:''}});
  const p=run(['recipe','fanboot-stone-imp-preseeded','--out',source,'--tree-out',tree]);assert.equal(p.status,0,p.stderr);assert.ok(fs.existsSync(tree));assert.equal(codeHash(compile(fs.readFileSync(source,'utf8'),'redcode',settings),8000),codeHash(compile(read('stone-imp-preseeded.red'),'redcode',settings),8000));
  fs.writeFileSync(opts,JSON.stringify({seedMode:1,path:2}));const out=path.join(dir,'configured.red'),t=path.join(dir,'configured.json');const q=run(['configure',tree,'--options',opts,'--out',out,'--tree-out',t,'--json']);assert.equal(q.status,0,q.stderr);const result=JSON.parse(q.stdout);assert.deepEqual(result.configuration.preserved,{stone:true,pump:true,seed:true});assert.equal(result.verification.profile,'full');
  fs.writeFileSync(opts,JSON.stringify({seedMode:0,path:2}));const bad=run(['configure',tree,'--options',opts,'--out',path.join(dir,'bad.red')]);assert.notEqual(bad.status,0);assert.ok(!fs.existsSync(path.join(dir,'bad.red')));
  assert.notEqual(run(['recipe','fanboot-stone-imp-preseeded','--rules','94x']).status,0);
  const h={usage(message){throw Error(message);}},deps={treeSettings,recipes};assert.deepEqual(treeCommandOptions({'tree-ops':'tune-placement, seed-mode',start:tree},h,deps).ops,['tune-placement','seed-mode']);assert.deepEqual(treeCommandOptions({tune:true,start:tree},h,deps).ops,['tune']);assert.throws(()=>treeCommandOptions({tune:true,'tree-ops':'seed-mode',start:tree},h,deps),/Choose/);assert.throws(()=>treeCommandOptions({'tree-ops':'unknown',start:tree},h,deps),/unknown/);assert.throws(()=>treeCommandOptions({'tree-ops':'seed-mode'},h,deps),/nonempty/);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('zw-stone-options-'));fs.rmSync(dir,{recursive:true,force:true});}
});
test('coupled placement tuning stays in the supplied family and preserves seed geometry',async()=>{
 const pool=createPool(2);try{const field=libraryOpponents(settings).filter(x=>['Dwarf','Seeker'].includes(x.name));assert.equal(field.length,2);const r=await evolveTrees({pool,field,starts:[recipes['fanboot-stone-imp-preseeded'].tree('94nop')],generations:1,batch:2,rounds:2,race:0,seed:12,ops:['tune-placement'],crossRate:1,randomRate:1});assert.equal(r.verification,'full');assert.ok(r.archive.length);for(const entry of r.archive){const at=stoneImpLayout(entry.tree,settings);assert.equal(at.seed,2523);assert.equal(at.points,7);assert.equal(at.stoneWorkers,4);assert.equal(at.seedMode,1);assert.equal(entry.tree.kids[0].P.QFAC,247);assert.ok(entry.source);}}finally{pool.close();}
});
test('named local-source control distinguishes active head-damage propagation with full-state parity',()=>{
 for(const [name,expected]of [['fanboot-stone-imp-example',true],['fanboot-stone-imp-preseeded',false],['fanboot-stone-imp-local-template',true]]){const tree=recipes[name].tree('94nop'),b={...link(tree,settings),settings};b.w=compile(b.source,'redcode',settings);const template=b.w.instructions[b.labels.b5pImp],fault={cycle:100,address:2523,instruction:{...template,b:1142},owner:-1},result=observeTree(b,{positions:[0],injections:[fault]}),plain=new VM(settings);plain.load([b.w],{positions:[0]});while(plain.cycle<100)plain.step();plain.poke(2523,fault.instruction,-1);plain.run();assertSameState(result.vm,plain);assert.equal(verifyPhases(result.observation).ok,expected);const p=result.observation.blocks.find(x=>x.role==='imp-pump');if(expected){assert.equal(p.work['other-carpet-copies']?.count??0,0);assert.ok(p.compatibleImpProcesses>=7);}else{assert.ok(p.work['other-carpet-copies'].count>0);assert.equal(p.compatibleImpProcesses,0);}}
});
