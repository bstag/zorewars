import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VM,compile} from '../src/engine/index.js';
import {leaves,link,treeSettings,buildTree,withIndependentImpEngines,linkedCompactPumpSeeds} from '../tools/algebra/index.js';
import pump from '../tools/algebra/blocks/_compact-pump.js';import {createPumpLineageObservation} from '../tools/comparison/pump-lineage.js';import {assertSameState} from '../tools/comparison/paired.js';
leaves[pump.id]={...pump,file:'_compact-pump.js'};const settings=treeSettings('94nop',100),base=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url)));
function built(proposal,s=settings){const t=withIndependentImpEngines(base(),s,proposal),b={...link(t,s),settings:s};b.w=compile(b.source,'redcode',s);assert.ok(b.w.ok);return b;}
function run(b,base=0){const vm=new VM(b.settings);vm.load([b.w],{positions:[base]});const o=createPumpLineageObservation(b,vm);while(!vm.done){o.before();vm.step();o.after();}const r=o.finish(),plain=new VM(b.settings);plain.load([b.w],{positions:[base]});plain.run();assertSameState(vm,plain);return r;}
test('three-member boot preserves original seed, copies and enters both independent pumps',()=>{
 const t=base(),snapshot=structuredClone(t),dual=withIndependentImpEngines(t,settings,{secondEntry:6055,firstPoints:3,secondPoints:3});assert.deepEqual(t,snapshot);
 const b=buildTree(dual,{rules:'94nop',length:100,verification:'full'});assert.equal(b.total,77);assert.equal(b.verification.observations.length,7);assert.deepEqual(linkedCompactPumpSeeds(b).map(p=>[p.entry,p.seed]),[[2455,2523],[6055,6123]]);
 for(const r of b.verification.observations)assert.equal(r.phaseVerification.ok,true);
 const r=run(b,7993);assert.equal(r.engines.length,2);assert.ok(r.engines.every(e=>e.launches>=6&&e.compatibleImps>=3&&e.firstImpExecution!==null));
});
test('FIFO tags distinguish same-template descendants instead of crediting the shared pool twice',()=>{
 const r=run(built({secondEntry:6055}));assert.deepEqual(r.engines.map(e=>e.compatibleImps),[2,8]);assert.equal(r.engines.reduce((n,e)=>n+e.compatibleImps,0),10);assert.ok(r.engines[0].launches>=14);assert.ok(r.engines[0].compatibleImps<7);
 assert.throws(()=>buildTree(withIndependentImpEngines(base(),settings,{secondEntry:6055}),{rules:'94nop',length:100,verification:'full'}),/Independent pump lineage.*2\/7/);
});
test('lineage mirroring preserves state with a saturated small process table',()=>{
 const b=built({secondEntry:6055,firstPoints:3,secondPoints:3},{...settings,maxProcesses:64});const r=run(b);assert.ok(r.totalProcesses<=64);assert.equal(r.engines.reduce((n,e)=>n+e.processes,0)+r.unassignedProcesses,r.totalProcesses);
});
test('damaged launch arithmetic is observed rather than aborting a battle diagnostic',()=>{
 const b=built({secondEntry:6055,firstPoints:3,secondPoints:3}),vm=new VM(settings);vm.load([b.w],{positions:[0]});const o=createPumpLineageObservation(b,vm);let hit=false;
 while(!vm.done){const q=vm.warriors[0].queue,pc=q.buf[q.head];if(!hit&&pc===2458){vm.poke(pc,{...vm.peek(pc),a:vm.norm(vm.peek(pc).a-1)},-1);hit=true;}o.before();vm.step();o.after();}
 const r=o.finish();assert.ok(hit);assert.ok(r.engines[0].arithmeticDeviations>0);assert.ok(r.engines[0].firstArithmeticDeviation);
});
test('three-member exact checks reject overlap, wrapping into the original, unsupported fan size and shifted frames',()=>{
 const t=withIndependentImpEngines(base(),settings,{secondEntry:2455});assert.throws(()=>buildTree(t,{rules:'94nop',length:100}),/copies land on each other/);
 const w=withIndependentImpEngines(base(),settings,{secondEntry:7998});assert.throws(()=>buildTree(w,{rules:'94nop',length:100}),/lands on the original/);
 assert.throws(()=>buildTree(withIndependentImpEngines(base(),settings,{secondEntry:6055,stoneWorkers:5}),{rules:'94nop',length:100}),/N must be/);
 const good=withIndependentImpEngines(base(),settings,{secondEntry:6055});assert.throws(()=>buildTree({id:'boot',P:{HOP:2000},kids:[good]},{rules:'94nop',length:100}),/unshifted linked frame/);
 good.kids[2].P.SPLIT=0;assert.throws(()=>buildTree(good,{rules:'94nop',length:100}),/fixed SPLIT1/);
 const tail=withIndependentImpEngines(base(),settings,{secondEntry:2460});assert.throws(()=>buildTree(tail,{rules:'94nop',length:100}),/copies land on each other/);
 const ring=withIndependentImpEngines(base(),settings,{secondEntry:6055});assert.throws(()=>buildTree(ring,{rules:'88',length:100}),/needs ICWS'94/);assert.throws(()=>buildTree(ring,{rules:'94nop',length:100,torus:'100x80'}),/ring-only/);
});
