import test from 'node:test';import assert from 'node:assert/strict';
import {VM,compile} from '../src/engine/index.js';import {treeSettings} from '../tools/algebra/index.js';
import {createDatBombObservation} from '../tools/comparison/dat-bomb.js';import {assertSameState} from '../tools/comparison/paired.js';
const settings=treeSettings('94nop',100);
test('DAT observation records a friendly stride hit and preserves complete VM state',()=>{
 const w=compile('DAT.F <2667,57','redcode',settings),vms=[new VM(settings),new VM(settings)];
 for(const vm of vms){vm.load([w],{positions:[7993]});vm.poke(2660,{op:'MOV',mod:'I',aMode:'#',a:0,bMode:'$',b:1143},0);}
 const o=createDatBombObservation(vms[0],{bomb:w.instructions[0],ownStride:1143});o.before();vms[0].step();o.after();const r=o.finish();vms[1].step();assertSameState(...vms);
 assert.equal(r.counts.executions,1);assert.equal(r.counts.ownCompatibleImpStrideHits,1);assert.equal(r.examples[0].after.b,1142);
});
test('signature and last-writer ownership exclude unrelated DAT instructions',()=>{
 const w=compile('DAT.F <2667,57','redcode',settings),vm=new VM(settings);vm.load([w],{positions:[0]});vm.poke(0,w.instructions[0],-1);
 const o=createDatBombObservation(vm,{bomb:w.instructions[0],ownStride:1143});o.before();vm.step();o.after();assert.equal(o.finish().counts.executions,0);
});
