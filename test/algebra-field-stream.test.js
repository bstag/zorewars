import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildTree,leaves} from '../tools/algebra/index.js';
import compact from '../tools/algebra/blocks/_compact-pump.js';
import fields from '../tools/algebra/blocks/_field-stream.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};
for(const b of fields)leaves[b.id]={...b,file:'_field-stream.js'};
const fixture=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url)));
function tree(id='armadillo-switch',stream=1){const t=fixture();function visit(n){if(n.id==='armadillo-switch'){n.id=id;n.P.STREAM=stream;}for(const k of n.kids??[])visit(k);}visit(t);return t;}
test('field-isolation drafts change only DJN modifier and meet full composite purpose',()=>{
 const baseline=buildTree(tree(),{rules:'94nop',length:100,verification:'full'});
 for(const field of ['A','B']){const b=buildTree(tree('field-stream-'+field.toLowerCase()),{rules:'94nop',length:100,verification:'full'});assert.equal(b.total,baseline.total);const diffs=b.w.instructions.flatMap((i,k)=>JSON.stringify(i)===JSON.stringify(baseline.w.instructions[k])?[]:[{a:baseline.w.instructions[k],b:i}]);assert.equal(diffs.length,1);assert.equal(diffs[0].a.op,'DJN');assert.equal(diffs[0].b.mod,field);assert.deepEqual({...diffs[0].b,mod:'F'},diffs[0].a);assert.equal(b.verification.ok,true);for(const r of b.verification.observations){assert.equal(r.cycles,80000);assert.equal(r.phaseVerification.ok,true);}}
});
test('field-isolation drafts reject the unrelated original folded stream',()=>{
 assert.throws(()=>buildTree(tree('field-stream-b',0),{rules:'94nop',length:100}),/requires STREAM1/);
});
