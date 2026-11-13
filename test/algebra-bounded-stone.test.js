import test from 'node:test';
import assert from 'node:assert/strict';
import {leaves,buildTree,link,treeSettings} from '../tools/algebra/index.js';
import bounded from '../tools/algebra/blocks/_bounded-stone.js';
import {compile,VM} from '../src/engine/index.js';
leaves[bounded.id]=bounded;
const s=treeSettings('94nop',100);
test('bounded counter hands off into a fed clear and survives full normal and wraparound rounds',()=>{
 for(const {COUNT,KEEPSTREAM} of [{COUNT:96,KEEPSTREAM:0},{COUNT:224,KEEPSTREAM:0},{COUNT:160,KEEPSTREAM:1}]){
  const b=buildTree({id:bounded.id,P:{COUNT,KEEPSTREAM}},{rules:'94nop',length:100});assert.equal(b.total,9+KEEPSTREAM);assert.ok(b.verification.ok);
  for(const pos of [0,7993]){
   const vm=new VM(s);vm.load([b.w],{positions:[pos]});const at=l=>vm.norm(pos+b.labels[b.root.ns+l]),clock=at(KEEPSTREAM?'bsClock':'asLoop');let expiry=null,latch=null,lastClear=null,writes=0;
   while(!vm.done){const q=vm.warriors[0].queue,pc=q.buf[q.head],i=vm.peek(pc);
    if(pc===clock&&i.op==='DJN'&&i.b===1)expiry??=vm.cycle;
    if(pc===at('bsLatch'))latch??=vm.cycle;
    if(pc===at('asCmov')&&i.op==='MOV'){writes++;lastClear=vm.cycle;const gate=vm.norm(pc+i.b),target=vm.norm(gate+vm.b[gate]);assert.ok(vm.norm(target-pos)>=b.total);}
    vm.step();
   }
   assert.ok(expiry!==null&&latch>expiry);assert.ok(vm.warriors[0].alive&&writes>1000&&lastClear>79000);assert.equal(vm.peek(clock).op,'SPL');
  }
 }
});
test('a corrupted initial counter is rejected rather than silently admitted',()=>{
 const id='incorrect-bounded-counter';leaves[id]={...bounded,id,emit:ctx=>bounded.emit({...ctx,ins:(l,o,m,a,b)=>ctx.ins(l,o,m,a,l==='asLoop'?'#1':b)})};
 try{assert.throws(()=>buildTree({id,P:{COUNT:96}},{rules:'94nop',length:100}),/invalid counter/);}finally{delete leaves[id];}
});
test('changing the bound changes only the counter encoding',()=>{
 const code=COUNT=>compile(link({id:bounded.id,P:{COUNT}},s).source,'redcode',s).instructions.map(({line,...i})=>i),a=code(96),b=code(224),changed=a.map((x,i)=>JSON.stringify(x)===JSON.stringify(b[i])?null:i).filter(x=>x!==null);
 assert.deepEqual(changed,[4]);assert.equal(a[4].op,'DJN');assert.equal(a[4].bMode,'#');
});
