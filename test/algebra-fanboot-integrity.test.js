import test from 'node:test';
import assert from 'node:assert/strict';
import {link,treeSettings,treeMismatches} from '../tools/algebra/index.js';
import {compile,VM} from '../src/engine/index.js';

const settings=treeSettings('94nop',100);
function fixture(CHECK=0,BYPASS=0){
  const tree={id:'seq',kids:[{id:'opening-none'},{id:'fanboot',P:{N:4,SPLIT:1,HOPA:3360,HOPB:5600,CHECK,BYPASS,C0:1,C1:2,C2:3},kids:[{id:'armadillo-switch'},{id:'vector-spiral',P:{N:3,K:4}}]}]};
  const b=link(tree,settings),w=compile(b.source,'redcode',settings);assert.ok(w.ok,JSON.stringify(w.errors));
  const fan=b.root.kids[1],stone=fan.kids[0];return {...b,w,tree,fan,stone};
}
function run(b,{fault,base=0,until=80000,faultAt='start'}={}){
  const vm=new VM(settings);vm.load([b.w],{positions:[base]});const at=l=>vm.norm(base+b.labels[l]);
  let injected=false,rejects=0,writes=0,lastClear=null,copied=null;const unique=new Set();
  while(!vm.done&&vm.cycle<until){
    const q=vm.warriors[0].queue,pc=q.buf[q.head];
    if(fault&&!injected&&pc===at(b.fan.ns+faultAt)){fault(vm,at,b);injected=true;}
    if(pc===at(b.fan.ns+'reject'))rejects++;
    const i=vm.peek(pc);
    if(copied===null&&pc===vm.norm(at(b.stone.ns+'asInc')+3360))copied={...vm.peek(vm.norm(at(b.stone.ns+'asAmov')+3360))};
    if(pc===at(b.stone.ns+'asCmov')&&i.op==='MOV'&&i.bMode==='>'){
      const gate=vm.norm(pc+i.b);unique.add(vm.norm(gate+vm.b[gate]));writes++;lastClear=vm.cycle;
    }
    vm.step();
  }
  return {vm,rejects,writes,unique,lastClear,copied};
}
const zero=(vm,at,b)=>vm.poke(at(b.stone.ns+'asAmov'),{op:'SPL',mod:'B',aMode:'#',a:0,bMode:'#',b:0});

test('fanboot integrity: disabled option preserves code and enabled checks pass intact bodies',()=>{
  const plain=fixture(),disabled=fixture(0,1);
  assert.deepEqual(plain.w.instructions,disabled.w.instructions);
  for(const mode of [1,2,3]){
    const b=fixture(mode);assert.equal(b.total-plain.total,mode===3?6:9);
    const r=run(b);assert.equal(r.rejects,0);assert.ok(r.vm.warriors[0].alive);
    assert.equal(b.w.instructions[b.labels[b.fan.ns+'start']].op,mode===3?'JMZ':'MOV');
  }
});

test('fanboot integrity: a damaged sampled instruction starts a persistent clear at wrapping positions',()=>{
  for(const mode of [1,2,3])for(const base of [0,7993]){
    const b=fixture(mode),r=run(b,{fault:zero,base});
    assert.equal(r.rejects,1);assert.ok(r.vm.warriors[0].alive);
    assert.ok(r.writes>1000);assert.ok(r.unique.size>7500);assert.ok(r.lastClear>79000);
    assert.equal(r.vm.peek(r.vm.norm(base+b.labels[b.stone.ns+'asCmov'])).op,'MOV');
    assert.ok([...r.unique].some(pc=>r.vm.norm(pc-base)<b.spans[b.fan.ns].start),'the abandoned image is erased');
  }
});

test('fanboot integrity: bypass retains the test cost but copies the damaged instruction',()=>{
  for(const mode of [1,2,3]){
    const b=fixture(mode,1),r=run(b,{fault:zero,until:400});
    assert.equal(r.copied?.op,'SPL');assert.equal(r.copied?.a,0);
    assert.equal(r.writes,0);
  }
});

test('numeric checksum catches nonzero field changes that the zero sanity check misses',()=>{
  const fault=(vm,at,b)=>{const c=at(b.stone.ns+'asAmov');vm.poke(c,{...vm.peek(c),a:1234});};
  for(const mode of [1,2])assert.equal(run(fixture(mode),{fault}).rejects,1);
  assert.equal(run(fixture(3),{fault,until:400}).rejects,0);
});

test('numeric sums explicitly miss opcode-only changes and cancelling numeric changes',()=>{
  const opcodeOnly=(vm,at,b)=>{const c=at(b.stone.ns+'asAmov');vm.poke(c,{...vm.peek(c),op:'DAT'});};
  const cancel=(vm,at,b)=>{for(const [l,d]of [['asAmov',1],['asBmov',-1]]){const c=at(b.stone.ns+l);vm.poke(c,{...vm.peek(c),a:vm.peek(c).a+d});}};
  for(const mode of [1,2])for(const fault of [opcodeOnly,cancel])assert.equal(run(fixture(mode),{fault,until:400}).rejects,0);
});

test('a hit after validation can still be copied: the check is a snapshot, not continuous protection',()=>{
  for(const mode of [1,2,3]){
    const r=run(fixture(mode),{fault:zero,faultAt:'fanStart',until:400});
    assert.equal(r.copied?.op,'SPL');assert.equal(r.copied?.a,0);assert.equal(r.writes,0);
  }
});

test('fanboot integrity refuses unsupported members, missing accumulators and out-of-range samples',()=>{
  const b=fixture(2);b.tree.kids[1].P.C2=199;
  assert.ok(link(b.tree,settings).misfits.some(x=>x.includes('outside')));
  const withoutProbe=structuredClone(b.tree.kids[1]);withoutProbe.P.C2=3;
  assert.ok(treeMismatches(withoutProbe,settings).some(x=>x.includes('probe')));
  withoutProbe.kids[0]={id:'mod-stone'};
  assert.ok(treeMismatches(withoutProbe,settings).some(x=>x.includes('cold-clear')));
});
