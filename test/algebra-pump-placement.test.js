import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {link,leaves,treeSettings,shiftCompactPumpKeepingSeed,linkedCompactPumpSeed} from '../tools/algebra/index.js';
import compact from '../tools/algebra/blocks/_compact-pump.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};const settings=treeSettings('94nop',100),fixture=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/stone-imp-example.tree.json',import.meta.url)));
test('paired pump shifts preserve the relinked seed and leave the input tree intact',()=>{
 const original=fixture(),snapshot=structuredClone(original),before={...link(original,settings),settings},seed=linkedCompactPumpSeed(before);
 for(const shift of [-32,-16,-8,-4,-2,-1,0,1,2,4,8,16,32])for(const stoneShift of [0,16]){const t=shiftCompactPumpKeepingSeed(original,shift,{stoneShift}),b={...link(t,settings),settings};assert.equal(b.total,before.total);assert.equal(linkedCompactPumpSeed(b),seed);const restored=shiftCompactPumpKeepingSeed(t,-shift,{stoneShift:-stoneShift});assert.deepEqual(restored,original);}
 assert.deepEqual(original,snapshot);
});
test('relinking detects a source-layout change despite the parameter sum invariant',()=>{
 const original=fixture(),a={...link(original,settings),settings},t=shiftCompactPumpKeepingSeed(original,8);t.kids[0].P.UNITS=5;const b={...link(t,settings),settings};assert.notEqual(linkedCompactPumpSeed(b),linkedCompactPumpSeed(a));
});
test('invalid or ambiguous placement requests are refused',()=>{
 assert.throws(()=>shiftCompactPumpKeepingSeed(fixture(),1000),/lead/);assert.throws(()=>shiftCompactPumpKeepingSeed(fixture(),0.5),/integers/);assert.throws(()=>shiftCompactPumpKeepingSeed({id:'imp'},1),/exactly one/);
});
