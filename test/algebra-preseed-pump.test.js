import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {compile,VM} from '../src/engine/index.js';import {leaves,link,buildTree,treeSettings,withSeededCompactPump,linkedCompactPumpSeeds,observeTree} from '../tools/algebra/index.js';
import compact from '../tools/algebra/blocks/_compact-pump.js';import {codeHash,assertSameState} from '../tools/comparison/paired.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};const settings=treeSettings('94nop',100),base=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url))),source=fs.readFileSync(new URL('./fixtures/stone-imp-example.red',import.meta.url),'utf8');
const build=mode=>buildTree(withSeededCompactPump(base(),settings,mode),{rules:'94nop',length:100,verification:'full'});
test('preseed modes preserve deployed geometry, seven points, four workers and exact probe addresses',()=>{
 const original=base(),snapshot=structuredClone(original),a=build(0);assert.equal(codeHash(a.w,8000),codeHash(compile(source,'redcode',settings),8000));
 for(const mode of [1,2,3]){const t=withSeededCompactPump(original,settings,mode),b=buildTree(t,{rules:'94nop',length:100,verification:'full'});assert.deepEqual(original,snapshot);assert.equal(t.kids[2].P.N,4);assert.equal(t.kids[2].P.MOREA,1);assert.equal(t.kids[2].kids[1].P.N,7);assert.equal(t.kids[2].kids[1].P.LEAD,64);assert.deepEqual(linkedCompactPumpSeeds(b).map(p=>[p.entry,p.seed]),[[2455,2523]]);assert.equal(b.labels.b4asInc+b.root.kids[2].P.HOPA,3418);assert.equal(b.total,mode===1?69:70);assert.equal(b.root.kids[2].fan.M[1],mode===1?4:8);
  const r=b.verification.observations[0].observation;assert.deepEqual(r.blocks[0].probeAddresses,a.verification.observations[0].observation.blocks[0].probeAddresses);assert.ok(b.verification.observations.every(x=>x.phaseVerification.ok));
 }
});
test('four-cell pump launches from the correct head and seeded source; observation preserves complete state',()=>{
 const b=build(1);assert.equal(b.spans.b5.size,4);assert.ok(b.labels.b5pImp<b.spans.b5.start);for(const base of [0,7993]){const {vm,observation}=observeTree(b,{positions:[base]}),p=observation.blocks.find(r=>r.role==='imp-pump');assert.equal(p.firstSeedWrite.cycle,15);assert.equal(p.work['launch-attempts'].count,34);assert.equal(p.phases['imp-running'].cycle,146);assert.equal(p.compatibleImpProcesses,12);const plain=new VM(settings);plain.load([b.w],{positions:[base]});plain.run();assertSameState(vm,plain);}
});
test('exposed seed damage is recorded and propagates through external reading; local control keeps copying its template',()=>{
 const bad={op:'MOV',mod:'I',aMode:'#',a:0,bMode:'$',b:1142};
 const external=observeTree(build(1),{injections:[{cycle:100,address:2523,instruction:bad}]}).observation.blocks.find(r=>r.role==='imp-pump'),local=observeTree(build(3),{injections:[{cycle:100,address:2523,instruction:bad}]}).observation.blocks.find(r=>r.role==='imp-pump');
 assert.equal(external.firstSeedStrideDamage.cycle,100);assert.ok(external.work['other-carpet-copies'].count>0);assert.ok(external.compatibleImpProcesses<7);assert.equal(local.firstSeedStrideDamage.cycle,100);assert.ok(local.compatibleImpProcesses>=7);assert.equal(local.work['other-carpet-copies'],undefined);
});
test('standalone seeded fanboot keeps the template outside the four-cell copy',()=>{
 const t=withSeededCompactPump(base(),settings,1).kids[2];
 const b=buildTree(t,{rules:'94nop',length:50,verification:'full'});
 const pump=b.root.kids[1].ns;
 assert.equal(b.total,23);
 assert.equal(b.root.fan.M[1],4);
 assert.ok(b.labels[pump+'pImp']<b.spans[pump].start);
 assert.ok(b.verification.observations.every(x=>x.phaseVerification.ok));
});
test('separate seed mode rejects a missing seeding parent, nested frames and seed/copy collisions',()=>{
 assert.throws(()=>buildTree({id:'compact-imp-pump',P:{N:7,LEAD:64,IMM:1,SEED:1}},{rules:'94nop',length:100}),/direct fanboot parent/);
 const t=withSeededCompactPump(base(),settings,1);
 assert.throws(()=>buildTree({id:'boot',P:{HOP:2000},kids:[t]},{rules:'94nop',length:100}),/unshifted frame/);
 const collision=withSeededCompactPump(base(),settings,1);collision.kids[2].P.EXACT=1;collision.kids[2].kids[1].P.LEAD=0;collision.kids[2].P.HOPB=3418-4-link(collision,settings).labels.b5pFeed;assert.throws(()=>buildTree(collision,{rules:'94nop',length:100}),/seed overlaps/);
});
