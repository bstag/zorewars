import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leaves,link,buildTree,treeSettings,observeTree,verifyPhases,describeBlock,createObservation} from '../tools/algebra/index.js';
import compact from '../tools/algebra/blocks/_compact-pump.js';
import {compile,VM} from '../src/engine/index.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};
const settings=treeSettings('94nop',100),tree=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url))),source=fs.readFileSync(new URL('./fixtures/stone-imp-example.red',import.meta.url),'utf8');
function fixture(){const b={...link(tree(),settings,{name:'Tree'}),settings};b.w=compile(b.source,'redcode',settings);assert.ok(b.w.ok);return b;}
const stone=r=>r.blocks.find(x=>x.role==='stone-clear'),pump=r=>r.blocks.find(x=>x.role==='imp-pump'),zero={op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0};

test('full verification checks every scenario to the actual cycle limit and preserves source',()=>{
 const quick=buildTree(tree(),{rules:'94nop',length:100,name:'Tree'}),full=buildTree(tree(),{rules:'94nop',length:100,name:'Tree',verification:'full'});
 assert.equal(quick.source,source);assert.equal(full.source,source);assert.equal(quick.verification.horizon,20000);assert.equal(full.verification.horizon,80000);assert.equal(full.verification.observations.length,6);
 for(const r of full.verification.observations){assert.equal(r.cycles,80000);assert.ok(r.phaseVerification.ok);assert.equal(r.observation.coverage.observed.length,4);assert.equal(r.phaseVerification.verified.length,2);}
 assert.equal(full.verification.observations.find(r=>r.scenario==='opening-qscan-mul: planted target').observation.blocks.find(b=>b.role==='probe-burst').work['bomb-writes'].count,34);
 const r=full.verification.observations[0].observation,s=stone(r),p=pump(r);
 assert.equal(r.blocks.find(x=>x.role==='quickscan').uniqueProbeAddresses,24);assert.equal(r.blocks.find(x=>x.role==='probe-burst').work['bomb-writes'],undefined);
 assert.equal(s.enteredAt,38);assert.equal(s.phases.handoff.cycle,4258);assert.equal(s.work['clear-writes'].firstCycle,4464);assert.equal(s.work['clear-writes'].count,35581);assert.equal(s.work['clear-writes'].lastCycle,79998);assert.ok(s.healthyClearProcesses>0);
 assert.equal(s.work['clear-writes'].uniqueTargets,7923);
 assert.equal(p.phases['imp-running'].cycle,149);assert.equal(p.phases.retired.cycle,3937);assert.equal(p.compatibleImpProcesses,12);assert.equal(p.firstFault.writerPc,3420);assert.equal(p.firstTemplateChange.instruction.b,1143);assert.equal(p.firstStrideDamage.instruction.b,1142);
});

test('observation is execution-neutral in solo wraps and a real battle',()=>{
 const b=fixture(),enemy=compile(fs.readFileSync(new URL('../warriors/stunner.red',import.meta.url),'utf8'),'redcode',settings);assert.ok(enemy.ok);
 for(const [pos,opponent]of [[0,null],[7993,null],[0,enemy],[7993,enemy]]){
  const positions=opponent?[pos,(pos+4000)%8000]:[pos],plain=new VM(settings);plain.load(opponent?[b.w,opponent]:[b.w],{positions});plain.run();
  const {vm,observation}=observeTree(b,{opponent,positions});
  for(const field of ['op','mod','aMode','bMode','a','b','owner','writerPc','writeCycle','lastWrite','lastExec'])assert.deepEqual(vm[field],plain[field],field);
  for(let i=0;i<vm.warriors.length;i++)assert.deepEqual(vm.processes(i),plain.processes(i));
  for(const field of ['cycle','steps','budget','winner','done','turn'])assert.equal(vm[field],plain[field],field);
  assert.equal(Object.hasOwn(vm,'resolve'),false);assert.ok(observation.blocks.length===4);
  if(opponent)assert.throws(()=>verifyPhases(observation),/diagnostic/);
 }
});

test('late loss of clear fails full purpose although imp insurance keeps the warrior alive',()=>{
 const b=fixture(),address=b.labels.b4asCmov+tree().kids[2].P.HOPA;
 const {observation:r}=observeTree(b,{injections:[{cycle:25000,address,instruction:zero}]});
 assert.ok(r.alive);assert.ok(pump(r).compatibleImpProcesses>=7);assert.ok(stone(r).work['clear-writes'].lastCycle<=25000);assert.equal(stone(r).healthyClearProcesses,0);
 const v=verifyPhases(r);assert.equal(v.ok,false);assert.ok(v.issues.some(x=>x.includes('no healthy clear process')));
});

test('full builder catches a late composite failure outside the quick gate horizon',()=>{
 const original=leaves['armadillo-switch'],id='phase-test-late-clear';
 leaves[id]={...original,id,watch:api=>{const hooks=original.watch(api);let injected=false;return {...hooks,after:token=>{hooks.after?.(token);if(!injected&&api.vm.cycle>=25000){api.vm.poke(api.at('asCmov'),zero);injected=true;}}};}};
 try{const t=tree();t.kids[2].kids[0].id=id;assert.ok(buildTree(t,{rules:'94nop',length:100}).verification.ok);assert.throws(()=>buildTree(t,{rules:'94nop',length:100,verification:'full'}),/no healthy clear process/);}finally{delete leaves[id];}
});

test('actual indirect clear targets reveal self writes even when its pointer is outside the block',()=>{
 const b=fixture(),home=b.labels.b4asInc+tree().kids[2].P.HOPA,gate=home-6;
 const {observation:r}=observeTree(b,{injections:[{cycle:25000,address:gate,instruction:{...zero,b:7}}]});
 assert.ok(stone(r).work['self-clear-writes'].count>0);const target=stone(r).work['self-clear-writes'].firstTarget;assert.ok(target>=home&&target<home+8);assert.ok(verifyPhases(r).issues.some(x=>x.includes('own active block')));
});

test('verification rejects partial horizons and exposes unsupported phase coverage',()=>{
 const b=fixture(),r=observeTree(b,{cycles:1000}).observation;assert.equal(verifyPhases(r).ok,false);assert.ok(verifyPhases(r).issues.some(x=>x.includes('full horizon')));
 const id='phase-test-unobserved';leaves[id]={id,kind:'body',exit:'never',processes:1,writes:'none',dialects:'94',entry:'loop',params:{},defaults:{},purpose:'Test unobserved role',emit:c=>c.ins('loop','JMP','B',c.L('loop'))};
 try{const small={...link({id},settings),settings};small.w=compile(small.source,'redcode',settings);const report=observeTree(small).observation;assert.equal(report.coverage.unobserved.length,1);assert.deepEqual(verifyPhases(report).verified,[]);}finally{delete leaves[id];}
 assert.throws(()=>buildTree(tree(),{rules:'94nop',length:100,verification:'unknown'}),/quick or full/);
 assert.throws(()=>observeTree(b,{positions:[NaN]}),/positions/);assert.throws(()=>observeTree(b,{firstTurn:1}),/first mover/);
});

test('observation lifecycle requires exactly one VM step and restores the resolver on disposal',()=>{
 const b=fixture(),vm=new VM(settings);vm.load([b.w]);const original=vm.resolve,o=createObservation(b,vm);assert.throws(()=>createObservation(b,vm),/already/);o.before();assert.throws(()=>o.after(),/before\/step\/after/);vm.step();o.after();o.dispose();assert.equal(vm.resolve,original);
 const next=createObservation(b,vm);o.dispose();assert.notEqual(vm.resolve,original);next.dispose();assert.equal(vm.resolve,original);assert.throws(()=>o.before(),/step order/);
});

test('block knowledge exposes parameter purpose without changing emitted Redcode',()=>{
 const b=fixture(),p=describeBlock(compact.id),s=describeBlock('armadillo-switch');assert.match(p.knowledge.parameterRoles.LEAD,/spatial/);assert.match(p.knowledge.parameterRoles.RETIRE,/verification/);assert.equal(p.draft,false);assert.equal(s.phaseContract.minimumClearWrites,100);assert.equal(fixture().source,b.source);assert.throws(()=>describeBlock('no-such-block'),/Unknown/);
 s.phaseContract.minimumClearWrites=0;assert.equal(describeBlock('armadillo-switch').phaseContract.minimumClearWrites,100);
});
