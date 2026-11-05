import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeFactorialReplication} from '../tools/comparison/factorial-replication.js';
const options={critical:2.570581835636305,minimumPositive:5};
const records=()=>Array.from({length:6},(_,i)=>({seedBase:1000+i,rounds:10,complete:true,results:Object.entries({baseline:3,'scan-only':4,'seed-only':4,candidate:4}).map(([id,w])=>({id,rows:[{index:0,name:'opponent',w,l:10-w,t:0}]}))}));
test('matched factorial replication detects subadditivity despite a positive combined gain',()=>{
 const x=summarizeFactorialReplication(records(),options);assert.ok(x.primary.supportsRepeatableGain);assert.ok(Math.abs(x.primary.meanPairedPoints-0.3)<1e-12);assert.ok(Math.abs(x.interaction.meanPairedPoints+0.3)<1e-12);assert.ok(x.interaction.seedMean95[1]<0);assert.equal(x.components.addingSeed.meanPairedPoints,0);assert.equal(x.newFieldRounds,240);
});
test('component replication refuses missing, duplicate and misaligned arms',()=>{
 const r=records();r[0].results.pop();assert.throws(()=>summarizeFactorialReplication(r,options));
 const s=records();s[0].results[2].id='baseline';assert.throws(()=>summarizeFactorialReplication(s,options));
 const t=records();t[2].results[2].rows[0].name='other';assert.throws(()=>summarizeFactorialReplication(t,options));
});

test('factorial replication keeps the absolute interaction when the reference earns zero', () => {
  const input = records();
  for (const record of input) {
    record.results[0].rows[0] = { index: 0, name: 'opponent', w: 0, t: 0, l: 10 };
  }
  const result = summarizeFactorialReplication(input, options);
  assert.equal(result.primary.gainPct, null);
  assert.equal(result.interaction.relativePct, null);
  assert.deepEqual(result.interaction.seedMean95RelativePct, [null, null]);
  assert.ok(Math.abs(result.interaction.meanPairedPoints + 1.2) < 1e-12);
});
