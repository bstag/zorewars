import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VM,compile} from '../src/engine/index.js';import {leaves,link,buildTree,treeSettings,withSeparateLauncherPath,linkedCompactPumpSeeds} from '../tools/algebra/index.js';import compact from '../tools/algebra/blocks/_compact-pump.js';import {codeHash} from '../tools/comparison/paired.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};const settings=treeSettings('94nop',100),base=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url)));
test('separate paths preserve runtime geometry and deliver four stone entrants and one pump entrant',()=>{
 for(const proposal of [{path:1,seed:0},{path:2,seed:1}]){const original=base(),snapshot=structuredClone(original),t=withSeparateLauncherPath(original,settings,proposal),b=buildTree(t,{rules:'94nop',length:100,verification:'full'});assert.deepEqual(original,snapshot);assert.equal(b.total,72);assert.deepEqual(linkedCompactPumpSeeds(b).map(p=>[p.entry,p.seed]),[[2455,2523]]);assert.equal(b.labels.b4asInc+b.root.kids[2].P.HOPA,3418);assert.equal(b.root.kids[2].fan.M[1],proposal.seed===1?4:5);
  const vm=new VM(settings);vm.load([b.w],{positions:[0]});let stone=0,pump=0;while(!vm.done&&vm.cycle<200){const q=vm.warriors[0].queue,pc=q.buf[q.head];if(pc===b.labels.b3va&&vm.peek(pc).op==='JMP')stone++;if(pc===b.labels.b3vb&&vm.peek(pc).op==='JMP')pump++;vm.step();}assert.equal(stone,4);assert.equal(pump,1);
  const p=b.verification.observations[0].observation.blocks.find(r=>r.role==='imp-pump');assert.equal(p.phases['imp-running'].cycle,proposal.seed===1?87:131);assert.ok(p.compatibleImpProcesses>=7);
 }
});
test('separate-path phase failures stay rejected; one bootstrap visit can change coordination',()=>{
 assert.throws(()=>buildTree(withSeparateLauncherPath(base(),settings,{path:2,seed:0}),{rules:'94nop',length:100,verification:'full'}),/only 5 compatible/);
 const b=buildTree(withSeparateLauncherPath(base(),settings,{path:2,seed:0,wait:1}),{rules:'94nop',length:100,verification:'full'});assert.equal(b.verification.observations[0].observation.blocks.find(r=>r.role==='imp-pump').phases['imp-running'].cycle,132);
});
test('default shared boot remains identical; separate routes reject unsupported policies and shifted frames',()=>{
 const source=fs.readFileSync(new URL('./fixtures/stone-imp-example.red',import.meta.url),'utf8'),b=buildTree(base(),{rules:'94nop',length:100});assert.equal(codeHash(b.w,8000),codeHash(compile(source,'redcode',settings),8000));
 const t=withSeparateLauncherPath(base(),settings,{path:1});t.kids[2].P.SPLIT=0;assert.throws(()=>buildTree(t,{rules:'94nop',length:100}),/separate PATH requires/);
 const good=withSeparateLauncherPath(base(),settings,{path:1});assert.throws(()=>buildTree({id:'boot',P:{HOP:2000},kids:[good]},{rules:'94nop',length:100}),/unshifted linked frame/);
});
