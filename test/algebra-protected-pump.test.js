import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VM,compile} from '../src/engine/index.js';import {recipes,treeSettings,configureStoneImp,buildTree,link,observeTree,verifyPhases,withIndependentImpEngines} from '../tools/algebra/index.js';import {codeHash,assertSameState} from '../tools/comparison/paired.js';
const settings=treeSettings('94nop',100),base=()=>recipes['fanboot-stone-imp-preseeded'].tree('94nop');
function image(mode=4,sourceOffset=512){const p=configureStoneImp(base(),settings,{seedMode:mode,sourceOffset});const b={...link(p.tree,settings),settings};b.w=compile(b.source,'redcode',settings);assert.ok(b.w.ok);return b;}
function fault(b,address,kind='stride',cycle=100,load=0){const instruction=kind==='dat'?{op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0}:{op:'MOV',mod:'I',aMode:'#',a:0,bMode:'$',b:1142},target=(address+load)%8000,observed=observeTree(b,{positions:[load],injections:[{cycle,address:target,instruction,owner:-1}]}),plain=new VM(settings);plain.load([b.w],{positions:[load]});while(plain.cycle<cycle)plain.step();plain.poke(target,instruction,-1);plain.run();assertSameState(observed.vm,plain);return {p:observed.observation.blocks.find(r=>r.role==='imp-pump'),purpose:verifyPhases(observed.observation)};}
test('private bank and matched cost control keep four live cells and fixed deployment with full purpose',()=>{
 for(const seedMode of [4,5]){const proposal=configureStoneImp(base(),settings,{seedMode,sourceOffset:512}),b=buildTree(proposal.tree,{rules:'94nop',length:100,verification:'full'});assert.equal(proposal.after.sourceBank,2967);assert.equal(b.total,70);assert.equal(b.spans.b5.size,4);assert.equal(b.root.kids[2].fan.M[1],4);assert.deepEqual(proposal.preserved,{stone:true,pump:true,seed:true});const p=b.verification.observations[0].observation.blocks.find(x=>x.role==='imp-pump');assert.equal(p.firstSeedWrite.cycle,15);assert.equal(p.firstSourceWrite.cycle,16);assert.equal(p.firstSourceWrite.address,2967);assert.equal(p.phases['imp-running'].cycle,147);assert.equal(p.compatibleImpProcesses,12);assert.equal(p.firstStrideDamage&&p.firstStrideDamage.cycle<16,false);}
 const a=image(4).w.instructions,b=image(5).w.instructions,diffs=a.flatMap((x,i)=>JSON.stringify(x)===JSON.stringify(b[i])?[]:[i]);assert.deepEqual(diffs,[image(4).labels.b5pCarpet]);
});
test('head stride damage stops propagating, but private source damage still propagates; observer is neutral',()=>{
 for(const load of [0,7993]){const a=fault(image(4),2523,'stride',100,load),b=fault(image(5),2523,'stride',100,load);assert.equal(a.p.work['other-carpet-copies']?.count??0,0);assert.equal(a.p.compatibleImpProcesses,12);assert.equal(a.purpose.ok,true);assert.equal(b.p.work['other-carpet-copies'].count,34);assert.equal(b.p.compatibleImpProcesses,0);assert.equal(b.purpose.ok,false);}
 const damaged=fault(image(4),2967);assert.ok(damaged.p.work['other-carpet-copies'].count>0);assert.equal(damaged.p.firstStrideDamage.cycle,100);assert.equal(damaged.purpose.ok,false);
 const dat=fault(image(4),2523,'dat');assert.equal(dat.p.work['other-carpet-copies']?.count??0,0);
});
test('source placement is checked against the image, copied code, head/carpet and launch geometry',()=>{
 for(const sourceOffset of [8000,8068,963,5545])assert.throws(()=>configureStoneImp(base(),settings,{seedMode:4,sourceOffset}),/SOURCE|overlap/);
 const tree=configureStoneImp(base(),settings,{seedMode:4,sourceOffset:512}).tree;
 const standalone=buildTree(tree.kids[2],{rules:'94nop',length:50});
 assert.equal(standalone.root.fan.M[1],4);
 assert.throws(()=>buildTree({id:'boot',P:{HOP:2000},kids:[tree]},{rules:'94nop',length:100}),/unshifted/);
 const colliding=withIndependentImpEngines(tree,settings,{secondEntry:2899});assert.throws(()=>buildTree(colliding,{rules:'94nop',length:100}),/initializers overlap/);
});
test('existing current and contender instruction images remain unchanged',()=>{
 for(const [name,file]of [['fanboot-stone-imp-example','stone-imp-example.red'],['fanboot-stone-imp-preseeded','stone-imp-preseeded.red']]){const b=buildTree(recipes[name].tree('94nop'),{rules:'94nop',length:100,verification:'full'}),w=compile(fs.readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8'),'redcode',settings);assert.equal(codeHash(b.w,8000),codeHash(w,8000));}
});
