import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pushOff} from '../src/engine/pushoff.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/pushoff-before-cache.json',import.meta.url),'utf8'));
test('push-off arithmetic and tie-breaking match the uncached golden results for every reading',()=>{
 const {scores,results,names,cases}=fixture;
 for(const {options,expected} of cases) assert.deepEqual(pushOff(scores,names,{...options,results}),expected,JSON.stringify(options));
});
test('ranking caches stay local to each invocation and include changed scores',()=>{
 const {scores,results,names,cases}=fixture;
 for(const {options,expected} of cases) {
  const changed=scores.map(row=>row.map(value=>value+0.125));
  pushOff(changed,names,{...options,results});
  assert.deepEqual(pushOff(scores,names,{...options,results}),expected);
 }
});
test('zero spread, complete ties and empty fields retain elimination order',()=>{
 const r={w:0,l:0,t:10,rounds:10};
 const results=Array.from({length:3},()=>Array.from({length:3},()=>({...r})));
 for(const metric of ['sd','eq6','euclid']) for(const field of ['original','current']) {
  const ranked=pushOff([[0,1,1],[1,0,1],[1,1,0]],['a','b','c'],{results,self:true,metric,field});
  assert.deepEqual(ranked.map(x=>x.index),[2,1,0]); assert.ok(ranked.every(x=>x.div===0 && x.score===0));
 }
 assert.deepEqual(pushOff([],[]),[]);
 assert.deepEqual(pushOff([[0]],['only']),[{rank:1,index:0,name:'only',avg:0,div:0,score:0}]);
});

test('flat differences preserve missing cells across every ranking reading',()=>{
 for(const {options,expected} of fixture.sparseCases) assert.deepEqual(pushOff(fixture.scores,fixture.names,{...options,results:fixture.sparseResults}),expected,JSON.stringify(options));
});
test('large fields retain exact ties when the optional difference table is capped',()=>{
 const n=180,names=Array.from({length:n},(_,i)=>String(i));
 const scores=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:1));
 const r={w:0,l:0,t:20,rounds:20},results=Array.from({length:n},()=>Array(n).fill(r));
 const ranked=pushOff(scores,names,{results,features:'wlt',metric:'eq6',self:true,field:'original'});
 assert.deepEqual(ranked.map(x=>x.index),Array.from({length:n},(_,i)=>n-i-1));
 assert.ok(ranked.every(x=>x.avg===1 && x.div===0 && x.score===0));
});
