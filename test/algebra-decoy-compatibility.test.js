import test from 'node:test';
import assert from 'node:assert/strict';
import {leaves,link,treeSettings} from '../tools/algebra/index.js';
import zero from '../tools/algebra/blocks/_zero-padding.js';
import friendly from '../tools/algebra/blocks/_friendly-decoys.js';
import pump,{compatibleImp} from '../tools/algebra/blocks/_compact-pump.js';
import {compile,VM} from '../src/engine/index.js';
leaves[zero.id]=zero;leaves[friendly.id]=friendly;leaves[pump.id]=pump;
const s=treeSettings('94nop',100),key=i=>['op','mod','aMode','a','bMode','b'].map(k=>typeof i[k]==='number'?((i[k]%8000)+8000)%8000:i[k]);
function built(safe){
 const main={id:'seq',kids:[{id:'opening-qscan-mul',P:{QFAC:349,GAP:138,UNITS:6,SHARE:0}},{id:'probe-burst2',P:{COUNT:17,STEP:6,OFFSET:0,GAP:82,BOMB:0}},{id:'fanboot',P:{N:4,K:1,SPLIT:1,HOPA:3363,HOPB:2400},kids:[{id:'armadillo-switch',P:{STEP:3510,HOP:56}},{id:pump.id,P:{N:7,LEAD:64,IMM:1,RETIRE:1}}]}]};
 const t={id:'image',kids:[main,{id:zero.id,P:{COUNT:3}},safe?{id:friendly.id,P:{COUNT:6,TYPE:0}}:{id:'decoys',P:{DECOYS:6,DECOY:0}}]},b=link(t,s),w=compile(b.source,'redcode',s);assert.ok(w.ok);return {...b,w,t};
}
test('the decoy comparison changes only its B fields and leaves the rounded pump tail empty',()=>{
 const a=built(false),b=built(true);assert.equal(a.total,77);assert.equal(b.total,77);
 assert.deepEqual(a.w.instructions.slice(0,71).map(key),b.w.instructions.slice(0,71).map(key));
 for(let i=71;i<77;i++){assert.deepEqual({...a.w.instructions[i],b:2},b.w.instructions[i]);assert.equal(a.w.instructions[i].b,1);}
 const vm=new VM(s);vm.load([b.w],{positions:[0]});while(vm.processes(0)[0]!==2463)vm.step();
 for(let i=5;i<8;i++)assert.deepEqual(key(vm.peek(2463+i)),key({op:'DAT',mod:'F',aMode:'$',a:0,bMode:'$',b:0}));
});
test('unequal-field decoys avoid the own-clear zero branch and retain the imp component',()=>{
 for(const safe of [false,true])for(const pos of [0,7993]){
  const b=built(safe),vm=new VM(s);vm.load([b.w],{positions:[pos]});const f=b.root.kids[0].kids[2],p=f.kids[1],template=b.w.instructions[b.labels[p.ns+'pImp']],a=f.kids[0],tick=vm.norm(pos+b.labels[a.ns+'asCdjn']+f.P.HOPA);let checked=false;
  while(!vm.done){const q=vm.warriors[0].queue,pc=q.buf[q.head],i=vm.peek(pc);
   let check=false;if(!checked&&pc===tick&&i.op==='DJN'&&i.mod==='F'&&i.bMode==='>'){const ptr=vm.norm(pc+i.b),target=vm.norm(ptr+vm.b[ptr]);check=target===vm.norm(pos+71);if(check)assert.deepEqual([vm.peek(target).a,vm.peek(target).b],[1,safe?2:1]);}
   vm.step();if(check){checked=true;assert.deepEqual([vm.peek(vm.norm(pos+71)).a,vm.peek(vm.norm(pos+71)).b],[0,safe?1:0]);}
  }
  assert.ok(checked&&vm.warriors[0].alive);const imps=vm.processes(0).filter(pc=>compatibleImp(vm.peek(pc),template,8000)).length;
  if(safe)assert.ok(imps>=7);else assert.equal(imps,0);
 }
});
