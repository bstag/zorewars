import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReplication} from '../tools/comparison/replication.js';
const options={critical:2.570581835636305,minimumPositive:5};
const row=(w,index=0)=>({index,name:'opponent'+index,w,l:6-w,t:4});
const records=values=>values.map((w,i)=>({complete:true,rounds:10,seedBase:1000+i,results:[{id:'baseline',rows:[row(3),row(3,1)]},{id:'candidate',rows:[row(w),row(w,1)]}]}));
test('replication uses seed differences and the declared complete field size',()=>{
 const s=summarizeReplication(records([4,4,4,4,4,4]),options);assert.ok(Math.abs(s.meanPairedPoints-0.3)<1e-12);assert.ok(Math.abs(s.seedMean95[0]-0.3)<1e-12);assert.equal(s.totalFieldRounds,240);assert.equal(s.positiveSeeds,6);assert.equal(s.supportsRepeatableGain,true);assert.equal(s.degreesOfFreedom,5);
});
test('five winning seeds alone do not establish a repeatable gain',()=>{
 const s=summarizeReplication(records([4,4,4,4,4,0]),options);assert.equal(s.positiveSeeds,5);assert.ok(s.meanPairedPoints>0);assert.ok(s.seedMean95[0]<0);assert.equal(s.supportsRepeatableGain,false);
});
test('replication rejects incomplete, overlapping or mismatched seed records',()=>{
 const mutate=fn=>{const r=records([4,4,4,4,4,4]);fn(r);return r;};
 assert.throws(()=>summarizeReplication(mutate(r=>r[0].complete=false),options));
 assert.throws(()=>summarizeReplication(mutate(r=>r[1].seedBase=r[0].seedBase),options));
 assert.throws(()=>summarizeReplication(mutate(r=>r[0].results[1].rows[0].name='wrong'),options));
 assert.throws(()=>summarizeReplication(mutate(r=>r[0].results[1].rows[0].w=11),options));
});

test('zero-point baselines retain absolute gains and report unavailable percentages', () => {
  const input = records([4, 4, 4, 4, 4, 4]);
  for (const record of input) {
    record.results[0].rows = record.results[0].rows.map(row => ({ ...row, w: 0, t: 0, l: 10 }));
  }
  const result = summarizeReplication(input, options);
  assert.equal(result.gainPct, null);
  assert.ok(result.seeds.every(seed => seed.gainPct === null));
  assert.deepEqual(result.seedMean95RelativePct, [null, null]);
  assert.ok(result.seedMean95.every(value => value > 0));
  assert.equal(result.supportsRepeatableGain, true);
});

test('replication rejects a field with zero rounds', () => {
  const input = records([4, 4, 4, 4, 4, 4]);
  input[0].rounds = 0;
  for (const result of input[0].results) {
    result.rows = result.rows.map(row => ({ ...row, w: 0, t: 0, l: 0 }));
  }
  assert.throws(() => summarizeReplication(input, options), /positive round count/);
});
