import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leaves,link,buildTree,treeSettings,observeTree,verifyPhases,createObservation} from '../tools/algebra/index.js';
import {compile,VM} from '../src/engine/index.js';
import recovery from '../tools/algebra/blocks/_recovering-stone.js';
import pump from '../tools/algebra/blocks/_compact-pump.js';
leaves[recovery.id]={...recovery,file:'_recovering-stone.js'};
leaves[pump.id]={...pump,file:'_compact-pump.js'};
const settings=treeSettings('94nop',100),zero={op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0},stun={op:'SPL',mod:'B',aMode:'#',a:1,bMode:'#',b:1};
function raw(tree){const b={...link(tree,settings),settings};b.w=compile(b.source,'redcode',settings);assert.ok(b.w.ok);return b;}
const stone=o=>o.blocks.find(b=>b.id==='recovering-stone');

test('standalone recovery verifies the full horizon without a false trigger',()=>{
 const b=buildTree({id:'recovering-stone'},{rules:'94nop',length:100,verification:'full'});
 assert.equal(b.total,31);assert.ok(b.verification.observations.length>=3);
 for(const r of b.verification.observations){assert.equal(r.cycles,80000);assert.ok(r.phaseVerification.ok);const s=stone(r.observation);if(r.scenario==='alone')assert.equal(s.recoveryAttempts,0);else{assert.ok(s.recoveryAttempts>=s.recoverySpawns);assert.ok(s.recoverySpawns>0);assert.ok(s.work['post-repair-clear-writes'].count>=100);}}
});

test('actual DAT and SPL damage is repaired and re-entered, with continued healthy writes',()=>{
 const b=raw({id:'recovering-stone'}),address=b.labels.b0asCmov;
 for(const instruction of [zero,stun]){const {observation:o}=observeTree(b,{injections:[{cycle:6000,address,instruction}]}),s=stone(o);assert.ok(s.recoveryAttempts>0);assert.ok(s.firstRecoveryAttempt>=6000);assert.ok(s.work['post-repair-clear-writes'].count>100);assert.ok(s.work['post-repair-clear-writes'].lastCycle>79000);assert.equal(s.work['self-clear-writes'],undefined);assert.ok(s.healthyClearProcesses>0);assert.ok(verifyPhases(o).ok);}
});

test('disabled recovery has the same layout and cannot claim recovery re-entry',()=>{
 const a=raw({id:'recovering-stone'}),b=raw({id:'recovering-stone',P:{BYPASS:1}});assert.equal(a.total,b.total);assert.deepEqual(a.labels,b.labels);assert.notEqual(a.source,b.source);
 const {observation:o}=observeTree(b,{injections:[{cycle:6000,address:b.labels.b0asCmov,instruction:zero}]});assert.equal(stone(o).recoveryAttempts,0);assert.equal(stone(o).work['post-repair-clear-writes'],undefined);
});

test('a saturated SPL is a repair attempt, not an admitted fresh process',()=>{
 const b=raw({id:'recovering-stone'}),spawn=b.labels.b0rSpawn,vm=new VM(settings);
 // A controlled queue fixture starts at the emitted recovery SPL; no code
 // is changed. Fill the queue to test the actual VM process-limit branch.
 vm.load([{...b.w,start:spawn}],{positions:[0]});const q=vm.warriors[0].queue;while(q.size<settings.maxProcesses)q.push(spawn);
 const observer=createObservation(b,vm);observer.before();vm.step();observer.after();const s=stone(observer.finish());assert.equal(s.recoveryAttempts,1);assert.equal(s.recoverySpawns,0);assert.equal(q.size,settings.maxProcesses);
});

test('the current composition does not hide an imp-pump contract failure',()=>{
 const tree=JSON.parse(fs.readFileSync(new URL('fixtures/stone-imp-example.tree.json',import.meta.url),'utf8'));tree.kids[2].kids[0]={id:'recovering-stone'};const first=raw(tree);tree.kids[2].P.HOPA=3418-first.labels.b4asInc;tree.kids[2].P.HOPB=2455-first.labels.b5pFeed;
 const b=raw(tree);assert.equal(b.total,98);assert.throws(()=>buildTree(tree,{rules:'94nop',length:100,verification:'full'}),/compact-imp-pump/);
});

test('recovery observation preserves VM execution and restores resolver ownership',()=>{
 const b=raw({id:'recovering-stone'}),plain=new VM(settings);plain.load([b.w],{positions:[7993]});plain.run();const {vm}=observeTree(b,{positions:[7993]});
 for(const f of ['op','mod','aMode','bMode','a','b','owner','writerPc','lastWrite','writeCycle'])assert.deepEqual(vm[f],plain[f],f);assert.deepEqual(vm.processes(0),plain.processes(0));assert.equal(vm.cycle,plain.cycle);assert.equal(Object.hasOwn(vm,'resolve'),false);
});

test('fault controls do not alter code and unsupported lattice settings are rejected',()=>{
 const a=raw({id:'recovering-stone'}),b=raw({id:'recovering-stone',P:{FAULT:3,AT:25000,STUN:0}});assert.equal(a.source,b.source);assert.equal(a.w.instructions[a.labels.b0rRepair+5].a,49,'reset skips protected code instead of starting at zero');
 assert.throws(()=>buildTree({id:'recovering-stone',P:{STEP:3510}},{rules:'94nop',length:100}),/recovering-stone: STEP must|this draft requires/);
});
