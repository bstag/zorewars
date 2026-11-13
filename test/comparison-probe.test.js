import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/engine/index.js';
import {treeSettings,link} from '../tools/algebra/index.js';
import {tracePair} from '../tools/comparison/paired.js';
import {probeWrite,selectWriterContacts} from '../tools/comparison/probe.js';
const settings={...treeSettings('94nop',100),coreSize:64,maxCycles:80,maxProcesses:16,minDistance:2};
const program=s=>{const w=compile(s,'redcode',settings);assert.ok(w.ok);return w;};
const plan={positions:[0,20],firstTurn:0};
function fixture(){const a=program('DJN.B 0,21'),b=program('JMP.B @1,0\nDAT.F 0,2\nDAT.F 0,0\nJMP.B -3,0'),r=tracePair(a,a,b,settings,plan),c=r.versions.baseline.contacts.contacts.find(c=>c.actor===0&&c.firstValueRead?.kind==='pointer-read');return {a,b,c};}
test('targeted restoration changes a consumed pointer and exposes control divergence',()=>{
 const {a,b,c}=fixture(),p=probeWrite(a,b,settings,plan,c,{fields:['b']});assert.equal(p.applied,true);assert.equal(p.referenceParity,true);assert.equal(p.versions.reference.winner,0);assert.notEqual(p.versions.intervention.winner,0);assert.equal(p.useContext.reference.actor,1);assert.equal(p.useContext.reference.operands[0].address,22);assert.equal(p.useContext.intervention.operands[0].address,23);assert.ok(p.divergence.firstAddresses);assert.ok(p.divergence.firstControl);
});
test('no-op probe preserves complete state and rejects unrelated fields or stale fingerprints',()=>{
 const {a,b,c}=fixture(),p=probeWrite(a,b,settings,plan,c,{noOp:true});assert.equal(p.noOpParity,true);assert.equal(p.divergence.firstControl,null);assert.deepEqual(p.versions.reference,p.versions.intervention);assert.throws(()=>probeWrite(a,b,settings,plan,c,{fields:['a']}),/subset/);assert.throws(()=>probeWrite(a,b,settings,plan,{...c,pc:1}),/equal/);
});
test('contact choice uses declared writer and consumption order, not outcome',()=>{
 const {c}=fixture(),records=[{...c,id:2,firstValueRead:{...c.firstValueRead,step:90}},{...c,id:1,firstValueRead:{...c.firstValueRead,step:20}},{...c,id:0,actor:1}];assert.deepEqual(selectWriterContacts(records,{pc:c.pc,instruction:c.instruction,limit:2}).map(c=>c.id),[1,2]);assert.equal(selectWriterContacts(records,{pc:c.pc+1,instruction:c.instruction}).length,0);
});
test('no-op trace composes with algebra observation',()=>{
 const b={...link({id:'imp'},settings),settings};b.w=compile(b.source,'redcode',settings);const enemy=program('MOV.I 0,1'),r=tracePair(b.w,b.w,enemy,settings,plan),c=r.versions.baseline.contacts.contacts.find(c=>c.actor===0);assert.ok(c);const p=probeWrite(b.w,enemy,settings,plan,c,{built:b,noOp:true});assert.equal(p.noOpParity,true);assert.deepEqual(p.versions.reference.roles,p.versions.intervention.roles);
});
