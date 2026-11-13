import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VM,compile} from '../src/engine/index.js';import {treeSettings} from '../tools/algebra/index.js';import {assertSameState} from '../tools/comparison/paired.js';
import {createFamilyPhaseObservation,familyPhaseSpecs,sourceInstructionIndex} from '../tools/comparison/family-phases.js';
const settings=treeSettings('94nop',100),source=fs.readFileSync(new URL('./fixtures/stone-imp-example.red',import.meta.url),'utf8'),w=compile(source,'redcode',settings);
test('family adapter reproduces current quiet phases and complete state, including wrapping',()=>{
 for(const position of [0,7993]){const vm=new VM(settings);vm.load([w],{positions:[position]});const o=createFamilyPhaseObservation(vm,{source,w,spec:familyPhaseSpecs.current});while(!vm.done){o.before();vm.step();o.after();}const r=o.finish(),plain=new VM(settings);plain.load([w],{positions:[position]});plain.run();assertSameState(vm,plain);
  assert.equal(r.firstCompatibleImp.cycle,149);assert.equal(r.work['stone-bomb-writes'].count,1029);assert.equal(r.work['healthy-clear-writes'].count,35581);assert.equal(r.work['healthy-clear-writes'].firstCycle,4464);assert.equal(r.endingCompatibleImps,12);assert.equal(r.firstStoneSignatureFault,null);assert.ok(r.firstHealthyStone);assert.ok(r.firstHealthyPump);assert.equal(r.work['opening-attack-writes'],undefined);for(const k of ['resolve','touch'])assert.equal(Object.hasOwn(vm,k),false);
 }
});
test('missing or incompatible original labels fail before observation hooks are installed',()=>{
 assert.throws(()=>sourceInstructionIndex(source,w,'notPresent'),/Missing instruction label/);const vm=new VM(settings);vm.load([w],{positions:[0]});assert.throws(()=>createFamilyPhaseObservation(vm,{source,w,spec:{...familyPhaseSpecs.current,impLabel:'b4asInc'}}),/does not match/);assert.equal(Object.hasOwn(vm,'resolve'),false);
});
