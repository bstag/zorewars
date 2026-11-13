import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {compile,VM} from '../src/engine/index.js';
import {treeSettings} from '../tools/algebra/index.js';
import {createContactObservation} from '../tools/comparison/contacts.js';
import {assertSameState,tracePair,rollbackWrite,selectOpponents,summarizeField,validateScope,excludeIdenticalSubjectRows} from '../tools/comparison/paired.js';
const settings={...treeSettings('94nop',100),coreSize:64,maxCycles:80,maxProcesses:16,minDistance:2};
const program=s=>{const w=compile(s,'redcode',settings);assert.ok(w.ok,JSON.stringify(w.errors));return w;};
const plan={positions:[0,20],firstTurn:0};
test('self-identical exclusions preserve original opponent indices and paired common rows',()=>{
 const a=program('JMP 0'),b=program('MOV.I 0,1'),c=program('DAT 0'),opponents=[a,b,c].map((w,i)=>({id:String(i),w})),rows=opponents.map((_,index)=>({index,delta:index}));
 const r=excludeIdenticalSubjectRows(rows,opponents,{baseline:a,candidate:b},64);assert.deepEqual(r.excluded.map(x=>x.index),[0,1]);assert.deepEqual(r.rows,[rows[2]]);assert.equal(rows.length,3);
});
function observe(a,b,{steps=Infinity,settings:s=settings}={}){const vm=new VM(s);vm.load([program(a),program(b)],plan);const o=createContactObservation(vm);for(let i=0;i<steps&&!vm.done;i++){o.before();o.after(vm.step());}return {vm,report:o.finish()};}
test('contact observation preserves full VM state including operand side effects',()=>{
 for(const a of ['MOV.I }0, >0\nJMP -1','ADD.F <1, >1\nJMP -1','SPL #0\nMOV.I 0,1']){const b='SPL #0\nMOV.I 0,1',r=observe(a,b),plain=new VM(settings);plain.load([program(a),program(b)],plan);plain.run();assertSameState(r.vm,plain);for(const f of ['resolve','touch','applyPostIncrement'])assert.equal(Object.hasOwn(r.vm,f),false);}
});
test('pointer use and single-write rollback are separately reproducible',()=>{
 const a=program('DJN.B 0,21'),b=program('JMP.B @1,0\nDAT.F 0,2\nDAT.F 0,0\nJMP.B -3,0');
 const r=tracePair(a,a,b,settings,plan),v=r.versions.baseline,c=v.contacts.contacts.find(c=>c.actor===0&&c.firstValueRead?.kind==='pointer-read');assert.ok(c);assert.equal(c.address,21);assert.equal(c.before.b,2);assert.equal(c.after.b,1);assert.equal(v.winner,0);const control=rollbackWrite(a,b,settings,plan,c);assert.equal(control.applied,true);assert.notEqual(control.winner,v.winner);
});
test('unused SPL B target is not recorded as a value read; process cap is respected',()=>{
 const r=observe('MOV.AB #5,21\nJMP 0','SPL.B #0,1\nJMP 0',{steps:2,settings:{...settings,maxProcesses:1}});assert.equal(r.report.contacts[0].firstValueRead,null);assert.equal(r.report.activity.totals[1].splitAttempts,1);assert.equal(r.report.activity.totals[1].splitAdmitted??0,0);
});
test('changed empty cells are tracked when later executed and new DAT kills are distinguished',()=>{
 const r=observe('MOV.I 2,22\nJMP 0\nDAT.F #3,#4','JMP 2\nJMP 0\nJMP -2');const c=r.report.contacts.find(c=>c.address===22&&c.actor===0);assert.equal(c.previousOwner,1);assert.ok(c.firstExecution);assert.equal(r.report.counts.newDatKills,1);
 const empty=observe('MOV.I 1,22\nJMP 0','JMP 2');assert.ok(empty.report.contacts.some(c=>c.previousOwner===-1&&c.firstExecution));
});
test('lifecycle guards and disposal do not detach a later observer',()=>{
 const vm=new VM(settings);vm.load([program('JMP 0'),program('JMP 0')],plan);const o=createContactObservation(vm);assert.throws(()=>createContactObservation(vm),/already/);o.before();assert.throws(()=>o.after(),/one step/);o.after(vm.step());o.dispose();const newer=createContactObservation(vm);o.dispose();assert.throws(()=>createContactObservation(vm),/already/);newer.dispose();
});
test('selection is deterministic and malformed field identity is rejected',()=>{
 const rows=[{index:0,delta:1},{index:1,delta:-1},{index:2,delta:0},{index:3,delta:1}];assert.deepEqual(selectOpponents(rows,{gains:1,regressions:1,controls:1}).map(r=>r.index),[0,1,2]);assert.throws(()=>summarizeField([{seed:1,rounds:1,baseline:[{name:'wrong',w:1,l:0,t:0}],candidate:[]}],[{w:{name:'right'}}]),/identity/);assert.throws(()=>validateScope({...settings,pSpace:true}),/P-space/);
});
test('CLI freezes independent replay inputs and rejects stale output before overwriting them',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zorewars-compare-'));
 try{fs.writeFileSync(path.join(dir,'a.red'),';name A\nJMP 0');fs.writeFileSync(path.join(dir,'b.red'),';name B\nJMP 0');fs.writeFileSync(path.join(dir,'opponents.json'),JSON.stringify([{id:'loop',name:'loop',w:program('JMP 0')} ]));const config={settings,baseline:{source:'a.red'},candidate:{source:'b.red'},opponents:{snapshot:'opponents.json'},evaluation:{threads:1,rounds:2,seeds:[13]},selection:{gains:1,regressions:1,controls:1},rollbackPerVersion:0};const configPath=path.join(dir,'config.json'),out=path.join(dir,'out'),out2=path.join(dir,'replayed');fs.writeFileSync(configPath,JSON.stringify(config));const run=(c,o)=>execFileSync(process.execPath,['scripts/compare-warriors.js',c,'--out',o],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe'});run(configPath,out);const original=fs.readFileSync(path.join(out,'inputs/baseline.red'),'utf8');fs.writeFileSync(path.join(dir,'a.red'),';name changed\nJMP 0');assert.throws(()=>run(configPath,out));assert.equal(fs.readFileSync(path.join(out,'inputs/baseline.red'),'utf8'),original);for(const p of ['a.red','b.red','opponents.json'])fs.unlinkSync(path.join(dir,p));run(path.join(out,'replay.config.json'),out2);const a=JSON.parse(fs.readFileSync(path.join(out,'report.json'))),b=JSON.parse(fs.readFileSync(path.join(out2,'report.json')));assert.deepEqual(a.field,b.field);assert.deepEqual(a.cases.map(c=>c.trace),b.cases.map(c=>c.trace));assert.equal(a.cases[0].trace.versions.baseline.fullStateParity,true);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('zorewars-compare-'));fs.rmSync(dir,{recursive:true,force:true});}
});
