import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VM,compile} from '../src/engine/index.js';
import {buildTree,leaves,treeSettings} from '../tools/algebra/index.js';
import compact from '../tools/algebra/blocks/_compact-pump.js';
import {compactPumpCellCompatible} from '../tools/algebra/observation-roles.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};
const settings=treeSettings('94nop',100);
test('immediate SPL numeric changes preserve actual process scheduling',()=>{
 const queues=[];
 for(const source of ['SPL.B #0, $0','SPL.B #-1, $1234','SPL.B #7999, $-333']){const w=compile(source,'redcode',settings);assert.ok(w.ok);const vm=new VM(settings);vm.load([w],{positions:[7999]});const r=vm.step();assert.equal(r.killed,false);queues.push(vm.processes(0));}
 assert.deepEqual(queues,[[0,7999],[0,7999],[0,7999]]);
});
test('pump semantics ignore harmless feeder literals while preserving addressing modes and live arithmetic',()=>{
 const original={op:'SPL',mod:'B',aMode:'#',a:0,bMode:'$',b:0};
 assert.equal(compactPumpCellCompatible({...original,a:7999,b:19},original,0,8000),true);
 for(const change of [{op:'DAT'},{aMode:'$'},{bMode:'<'}])assert.equal(compactPumpCellCompatible({...original,...change},original,0,8000),false);
 const sideEffect={...original,bMode:'<'};assert.equal(compactPumpCellCompatible({...sideEffect,a:1},sideEffect,0,8000),false);
 const step={op:'ADD',mod:'A',aMode:'#',a:1144,bMode:'$',b:1};assert.equal(compactPumpCellCompatible({...step,a:1143},step,2,8000),false);
});
test('the reclaimed plus16 assembly meets full purpose with actual launches',()=>{
 const tree=JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url)));tree.kids[2].P.HOPA+=16;tree.kids[2].kids[0].P.STREAM=1;
 const b=buildTree(tree,{rules:'94nop',length:100,verification:'full'});assert.equal(b.total,69);assert.equal(b.verification.ok,true);assert.equal(b.verification.observations.length,6);
 for(const scenario of b.verification.observations){const pump=scenario.observation.blocks.find(b=>b.role==='imp-pump');assert.ok(pump.work['launch-attempts'].count>=14);assert.ok(pump.compatibleImpProcesses>=7);assert.notEqual(pump.firstFault?.cycle,64);assert.equal(scenario.phaseVerification.ok,true);}
});
