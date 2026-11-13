import test from 'node:test';
import assert from 'node:assert/strict';
import {leaves,link,buildTree,treeSettings} from '../tools/algebra/index.js';
import reserve from '../tools/algebra/blocks/_stone-reserve.js';
import compact from '../tools/algebra/blocks/_compact-pump.js';
import {compile,VM} from '../src/engine/index.js';
leaves[reserve.id]=reserve;leaves[compact.id]=compact;
const s=treeSettings('94nop',100);
function tree(){
 const t={id:'seq',kids:[{id:'opening-qscan-mul',P:{QFAC:349,GAP:138,UNITS:4,SHARE:0}},{id:'probe-burst2',P:{COUNT:17,STEP:6,OFFSET:0,GAP:82,BOMB:0}},{id:'fanboot',P:{N:4,K:1,SPLIT:1,HOPA:3300,HOPB:4000},kids:[{id:reserve.id,P:{STEP:3510,HOP:56,RESERVE:5601,PUMPDIST:645}},{id:compact.id,P:{N:3,LEAD:64,IMM:1,RETIRE:1}}]}]};
 const b=link(t,s),[a,p]=b.root.kids[2].kids;t.kids[2].P.HOPA=3418-b.labels[a.ns+'asInc'];t.kids[2].P.HOPB=4063-b.labels[p.ns+'pFeed'];return t;
}
test('remote reserve retains the original stone and passes its early damage contract',()=>{
 const b=buildTree(tree(),{rules:'94nop',length:100}),a=b.root.kids[2].kids[0];assert.equal(b.total,98);assert.ok(b.verification.ok);
 const original=link({id:'armadillo-switch',P:{STEP:3510,HOP:56}},s),w=compile(original.source,'redcode',s);
 const fields=i=>['op','mod','aMode','a','bMode','b'].map(k=>i[k]);
 assert.deepEqual(b.w.instructions.slice(b.labels[a.ns+'asInc'],b.labels[a.ns+'asInc']+8).map(fields),w.instructions.map(fields));
});
test('an early damaged clear causes a remote handoff, while a late hit exposes the reserve lifetime limit',()=>{
 const t=tree(),b=link(t,s),w=compile(b.source,'redcode',s),a=b.root.kids[2].kids[0];
 for(const pos of [0,7993])for(const hit of [1000,6000]){
  const vm=new VM(s);vm.load([w],{positions:[pos]});const at=l=>vm.norm(pos+b.labels[a.ns+l]+t.kids[2].P.HOPA),r=l=>vm.norm(at(l)+5601);let first=null,writes=0,stoppedStone=false,stoppedPump=false;
  while(!vm.done){
   if(vm.cycle===hit)vm.poke(at('asCmov'),{op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0});
   const q=vm.warriors[0].queue,pc=q.buf[q.head];
   if(pc===r('rKill')&&vm.peek(pc).op==='MOV'){first??=vm.cycle;writes++;}
   vm.step();
   if(vm.writerPc[at('asInc')]===r('rStopA')&&vm.peek(at('asInc')).op==='DAT')stoppedStone=true;
   if(vm.writerPc[vm.norm(4063+pos)]===r('rStopPump'))stoppedPump=true;
  }
  assert.ok(vm.warriors[0].alive);
  if(hit===1000){assert.ok(first>hit&&first<3000);assert.ok(writes>1000);assert.ok(stoppedStone&&stoppedPump);}else{assert.equal(first,null);assert.equal(writes,0);}
 }
});
test('the reserve rejects a fan supplying the wrong number of entry processes',()=>{
 const t=tree();t.kids[2].P.N=8;assert.throws(()=>buildTree(t,{rules:'94nop',length:100}),/three entry processes/);
});
test('the reserve rejects a handoff aimed at the wrong imp feeder',()=>{
 const t=tree();t.kids[2].kids[0].P.PUMPDIST=646;assert.throws(()=>buildTree(t,{rules:'94nop',length:100}),/PUMPDIST/);
});
