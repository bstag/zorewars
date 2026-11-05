import test from 'node:test';import assert from 'node:assert/strict';import {summarizeMatchedFactorial} from '../tools/comparison/factorial.js';
const definitions=[];for(let b=0;b<2;b++)for(let s=0;s<2;s++)for(let r=0;r<2;r++)definitions.push({id:`${b}${s}${r}`,vector:[b,s,r]});
const totals={'000':10,'100':11,'010':12,'001':13,'110':15,'101':14,'011':16,'111':20};
const field=()=>({rounds:10,results:definitions.map(d=>{const n=totals[d.id],w=Math.floor(n/3),t=n%3;return {id:d.id,rows:[0,1].map(index=>({index,name:'opponent'+index,w,t,l:10-w-t}))};})});
test('matched factorial distinguishes total nonadditivity from the pure three-way contrast',()=>{
 const r=summarizeMatchedFactorial(field(),definitions,[2,2,2]);assert.equal(r.complete,true);assert.equal(r.baseline,1);assert.equal(r.cells.find(c=>c.id==='111').score,2);assert.ok(Math.abs(r.triples[0].totalNonadditivity.delta-.4)<1e-12);assert.ok(Math.abs(r.triples[0].threeWayInteraction.delta-.1)<1e-12);assert.equal(r.pairs.length,3);
});
test('unmeasured cells stay missing rather than silently contributing zero',()=>{
 const f=field();f.results=f.results.filter(r=>r.id!=='110');const r=summarizeMatchedFactorial(f,definitions,[2,2,2]);assert.equal(r.complete,false);assert.equal(r.cells.find(c=>c.id==='110').score,null);assert.equal(r.triples[0].threeWayInteraction.complete,false);assert.deepEqual(r.triples[0].threeWayInteraction.missing,['110']);
});
test('invalid identities, duplicate cells and mismatched plans are rejected',()=>{
 const f=field();f.results[1].rows[0].name='different';assert.throws(()=>summarizeMatchedFactorial(f,definitions,[2,2,2]),/order/);assert.throws(()=>summarizeMatchedFactorial(field(),definitions.concat(definitions[0]),[2,2,2]),/duplicate/);const bad=field();bad.results[0].rows[0].l=99;assert.throws(()=>summarizeMatchedFactorial(bad,definitions,[2,2,2]),/W\/L\/T/);
});
