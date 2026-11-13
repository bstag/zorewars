import test from 'node:test';
import assert from 'node:assert/strict';
import {leaves,link,buildTree,treeSettings} from '../tools/algebra/index.js';
import dual from '../tools/algebra/blocks/_double-clear-stone.js';
import compact,{compatibleImp} from '../tools/algebra/blocks/_compact-pump.js';
import {compile,VM} from '../src/engine/index.js';
leaves[dual.id]=dual;leaves[compact.id]=compact;
const s=treeSettings('94nop',100),fields=i=>['op','mod','aMode','a','bMode','b'].map(k=>typeof i[k]==='number'?((i[k]%8000)+8000)%8000:i[k]);
function tree(P={}){
 const t={id:'seq',kids:[{id:'opening-qscan-mul',P:{QFAC:349,GAP:138,UNITS:6,SHARE:0}},{id:'probe-burst2',P:{COUNT:17,STEP:6,OFFSET:0,GAP:82,BOMB:0}},{id:'fanboot',P:{N:4,K:1,SPLIT:1,HOPA:3363,HOPB:2400},kids:[{id:dual.id,P:{STEP:3510,HOP:57,WRITERS:2,FAULT:0,...P}},{id:compact.id,P:{N:7,LEAD:64,IMM:1,RETIRE:1}}]}]};
 const b=link(t,s),[a,p]=b.root.kids[2].kids;t.kids[2].P.HOPA=3418-b.labels[a.ns+'asInc'];t.kids[2].P.HOPB=2463-b.labels[p.ns+'pFeed'];return t;
}
test('single-writer mode reproduces the original complete warrior instructions',()=>{
 const t=tree({WRITERS:1,HOP:56}),original=structuredClone(t);original.kids[2].kids[0]={id:'armadillo-switch',P:{STEP:3510,HOP:56}};
 const code=x=>{const b=link(x,s),w=compile(b.source,'redcode',s);assert.ok(w.ok);return {w,b};},a=code(t),b=code(original);
 assert.equal(a.b.total,68);assert.deepEqual(a.w.instructions.map(fields),b.w.instructions.map(fields));assert.equal(a.w.start,b.w.start);
});
test('both individual-writer stun scenarios pass, with no scenario-dependent emitted code',()=>{
 const a=buildTree(tree({FAULT:0}),{rules:'94nop',length:100}),b=buildTree(tree({FAULT:1}),{rules:'94nop',length:100});
 assert.equal(a.total,70);assert.ok(a.verification.ok&&b.verification.ok);assert.equal(a.source,b.source);
});
test('the other writer sustains DAT clearing after either SPL hit through full normal and wraparound rounds',()=>{
 const t=tree(),b=link(t,s),w=compile(b.source,'redcode',s),[a,p]=b.root.kids[2].kids,template=w.instructions[b.labels[p.ns+'pImp']];
 for(const fault of ['asCmov','dcSecond'])for(const pos of [0,7993]){
  const vm=new VM(s);vm.load([w],{positions:[pos]});const at=l=>vm.norm(pos+b.labels[a.ns+l]+t.kids[2].P.HOPA),other=fault==='asCmov'?'dcSecond':'asCmov',expected=w.instructions[b.labels[a.ns+other]];let writes=0,last=null;
  while(!vm.done){
   if(vm.cycle===6000){assert.equal(vm.peek(at('asLoop')).op,'SPL');vm.poke(at(fault),{op:'SPL',mod:'B',aMode:'#',a:1,bMode:'#',b:1});}
   const q=vm.warriors[0].queue,pc=q.buf[q.head],ins=vm.peek(pc);
   if(vm.cycle>=6000&&pc===at(other)&&JSON.stringify(fields(ins))===JSON.stringify(fields(expected))){
    const gate=vm.norm(pc+ins.b),target=vm.norm(gate+vm.b[gate]);assert.ok(vm.norm(target-at('asInc'))>=9);assert.equal(vm.peek(at('asBomb')).op,'DAT');writes++;last=vm.cycle;
   }
   vm.step();
  }
  assert.ok(vm.warriors[0].alive&&writes>1000&&last>79000);assert.ok(vm.processes(0).filter(pc=>compatibleImp(vm.peek(pc),template,8000)).length>=7);
 }
});
test('a lethal first-writer overwrite is a documented limitation, not general damage immunity',()=>{
 const t=tree(),b=link(t,s),w=compile(b.source,'redcode',s),a=b.root.kids[2].kids[0],vm=new VM(s);vm.load([w],{positions:[0]});const at=l=>b.labels[a.ns+l]+t.kids[2].P.HOPA;let last=null;
 while(!vm.done){if(vm.cycle===6000)vm.poke(at('asCmov'),{op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0});const q=vm.warriors[0].queue,pc=q.buf[q.head];if(pc===at('dcSecond')&&vm.peek(pc).op==='MOV')last=vm.cycle;vm.step();}
 assert.ok(last!==null&&last<10000);assert.ok(vm.warriors[0].alive);
});
