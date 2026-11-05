import test from 'node:test';import assert from 'node:assert/strict';
import {placeEntrant,summarizePlacements} from '../tools/comparison/placement.js';
const row=(index,w,l,t)=>({index,w,l,t});
test('placement adds each opponent’s new matchup points before ranking',()=>{
 const r=placeEntrant([10,8,6],[row(0,2,0,0),row(1,0,2,0),row(2,0,0,2)],2);assert.equal(r.points,8);assert.deepEqual(r.updatedArchive,[10,14,8]);assert.deepEqual(r.placement,{rank:3,rankEnd:4,of:4});
});
test('ties span every tied entrant position and complete wins/losses rank correctly',()=>{
 assert.deepEqual(placeEntrant([4,4,4],[0,1,2].map(i=>row(i,0,0,2)),2).placement,{rank:1,rankEnd:4,of:4});
 assert.equal(placeEntrant([4,4,4],[0,1,2].map(i=>row(i,2,0,0)),2).placement.rank,1);
 assert.equal(placeEntrant([4,4,4],[0,1,2].map(i=>row(i,0,2,0)),2).placement.rank,4);
});
test('summaries use tie midpoints and an even-plan median',()=>{
 const rows=[{placement:{rank:1,rankEnd:2}},{placement:{rank:3,rankEnd:3}}];assert.deepEqual(summarizePlacements(rows),{median:2.25,best:1,worst:3,mean:2.25,plans:2});
 assert.throws(()=>placeEntrant([4],[row(0,1,0,0)],2));assert.throws(()=>placeEntrant([4],[row(1,2,0,0)],2));
});
