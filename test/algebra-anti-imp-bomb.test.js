import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile,VM} from '../src/engine/index.js';
import {buildTree,leaves,treeSettings} from '../tools/algebra/index.js';
import pump from '../tools/algebra/blocks/_compact-pump.js';
import {codeHash} from '../tools/comparison/paired.js';
leaves[pump.id]={...pump,file:'_compact-pump.js'};
const settings=treeSettings('94nop',100),source=fs.readFileSync(new URL('./fixtures/stone-imp-example.red',import.meta.url),'utf8'),tree=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url)));

test('default bomb preserves the retained image; anti-2667 changes only DAT A',()=>{
 const a=buildTree(tree(),{rules:'94nop',length:100}),t=tree();t.kids[2].kids[0].P.ANTISTEP=2667;
 const b=buildTree(t,{rules:'94nop',length:100});
 assert.equal(codeHash(a.w,8000),codeHash(compile(source,'redcode',settings),8000));
 const differences=b.w.instructions.flatMap((i,k)=>JSON.stringify(i)===JSON.stringify(a.w.instructions[k])?[]:[k]);
 assert.deepEqual(differences,[b.labels.b4asBomb]);const i=differences[0];
 assert.deepEqual({...b.w.instructions[i],a:1},a.w.instructions[i]);assert.equal(b.w.instructions[i].a,2667);
});

test('executed anti-imp DAT decrements the remote B field even on a friendly imp, including wrap',()=>{
 for(const base of [0,7993])for(const distance of [2667,5333,1143]){
  const w=compile(`DAT.F <${distance},57`,'redcode',settings),vm=new VM(settings);vm.load([w],{positions:[base]});
  const target=(base+distance)%8000;vm.poke(target,{op:'MOV',mod:'I',aMode:'#',a:0,bMode:'$',b:1143},0);
  vm.step();assert.equal(vm.peek(target).b,1142);assert.equal(vm.peek(target).a,0);assert.equal(vm.warriors[0].alive,false);
 }
});

test('anti-2667 retains intact launch, natural handoff and seven-point insurance in every full scenario',()=>{
 const t=tree();t.kids[2].kids[0].P.ANTISTEP=2667;const b=buildTree(t,{rules:'94nop',length:100,verification:'full'});
 assert.equal(b.total,69);assert.equal(b.verification.observations.length,6);
 for(const r of b.verification.observations){assert.equal(r.phaseVerification.ok,true);const p=r.observation.blocks.find(x=>x.role==='imp-pump'),s=r.observation.blocks.find(x=>x.role==='stone-clear');assert.equal(p.compatibleImpProcesses,12);assert.equal(p.work['launch-attempts'].count,34);assert.ok(s.handoffObserved);assert.ok(s.healthyClearProcesses>0);}
});
