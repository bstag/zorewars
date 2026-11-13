import test from 'node:test';import assert from 'node:assert/strict';
import {VM,compile} from '../src/engine/index.js';import {link,treeSettings,buildTree} from '../tools/algebra/index.js';
const settings=treeSettings('94nop',100),norm=n=>((n%8000)+8000)%8000;
test('signed burst direction and either lane side hit exact targets or reject the entire unsafe hull',()=>{
 for(const P of [{COUNT:17,STEP:6,SIDE:-1,GAP:82,OFFSET:0,BOMB:0},{COUNT:16,STEP:-7,SIDE:1,GAP:87,OFFSET:0,BOMB:0},{COUNT:10,STEP:-7,SIDE:-1,GAP:87,OFFSET:19,BOMB:0}]){
  const tree={id:'seq',kids:[{id:'opening-qscan-mul',P:{UNITS:6,QFAC:349,GAP:138,SHARE:0}},{id:'probe-burst2',P},{id:'mod-stone'}]},b=link(tree,settings),w=compile(b.source,'redcode',settings);assert.ok(w.ok);w.start=b.labels.b2burst;
  for(const base of [0,7993])for(const offset of [0,b.total-1,b.total,b.total+1,b.total+40,b.total+81,b.total+200,-1,-40,-80,-106,-192,-250,3333]){
   const vm=new VM(settings);vm.load([w],{positions:[base]});const probe=norm(base+b.labels.b1probe),found=norm(base+offset),ptr=norm(base+b.labels.b2ptr),loop=norm(base+b.labels.b2loop),stop=norm(base+b.labels.b3loop),hits=[];vm.poke(probe,{...vm.peek(probe),b:norm(found-probe)},0);
   for(let step=0;!vm.done&&step<1000;step++){const q=vm.warriors[0].queue,pc=q.buf[q.head];if(pc===stop)break;if(pc===loop)hits.push(norm(ptr+vm.peek(ptr).b));if(pc===ptr){const a=norm(ptr+vm.peek(ptr).b);hits.push(norm(a+vm.peek(a).a));}vm.step();}
   const run=(P.COUNT-1)*P.STEP,lo=-P.OFFSET+Math.min(0,run)+Math.min(0,P.SIDE*P.GAP),hi=-P.OFFSET+Math.max(0,run)+Math.max(0,P.SIDE*P.GAP);let unsafe=norm(found-probe)===b.total;for(let d=lo;d<=hi;d++)if(norm(found+d-base)<b.total)unsafe=true;
   const wanted=unsafe?[]:Array.from({length:P.COUNT},(_,k)=>[norm(found-P.OFFSET+k*P.STEP),norm(found-P.OFFSET+k*P.STEP+P.SIDE*P.GAP)]).flat();assert.deepEqual(hits.sort((a,b)=>a-b),wanted.sort((a,b)=>a-b),JSON.stringify({P,base,offset}));
  }
 }
});
test('zero direction and aliased reverse lanes are rejected before execution',()=>{
 const t=P=>({id:'seq',kids:[{id:'opening-qscan-mul'},{id:'probe-burst2',P},{id:'mod-stone'}]});assert.throws(()=>buildTree(t({STEP:0}),{rules:'94nop',length:100}),/STEP must be nonzero/);assert.throws(()=>buildTree(t({SIDE:0}),{rules:'94nop',length:100}),/SIDE must/);assert.throws(()=>buildTree(t({STEP:-7,GAP:14}),{rules:'94nop',length:100}),/same cells/);
});
