import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTree,link,gate,treeSettings} from '../tools/algebra/index.js';
import {compile,VM} from '../src/engine/index.js';

const paired=(P={})=>({id:'fanboot',P:{N:2,K:1,SPLIT:1,HOPA:2000,HOPB:5000},kids:[
  {id:'armadillo-switch'},
  {id:'imp-feeder',P:{N:3,K:4,WAIT:8,...P}},
]});

test('retirement changes the checked contract without changing emitted code',()=>{
  const settings=treeSettings('94nop',100);
  assert.equal(link(paired(),settings).source,link(paired({RETIRE:1}),settings).source);
});

test('an explicitly retiring feeder keeps its deployed imps after a partner clears its launcher',()=>{
  assert.throws(()=>buildTree(paired(),{rules:'94nop',length:100}),/did not refill its spiral/);
  const b=buildTree(paired({RETIRE:1}),{rules:'94nop',length:100});
  assert.equal(b.verification.ok,true);
  const vm=new VM(b.settings);vm.load([b.w],{positions:[0]});vm.run();
  const key=s=>Object.keys(b.labels).find(k=>k.endsWith(s));
  const feeder=vm.norm(b.labels[key('fLoop')]+5000);
  const template=b.w.instructions[b.labels[key('vImp')]];
  const imps=vm.processes(0).filter(pc=>{
    const i=vm.peek(pc);return i.op==='MOV'&&i.mod==='I'&&i.bMode==='$'&&i.b===template.b;
  });
  assert.equal(vm.cycle,80000);
  assert.equal(vm.warriors[0].alive,true);
  assert.equal(vm.peek(feeder).op,'DAT');
  assert.ok(vm.writerPc[feeder]>=0,'launcher was actually overwritten');
  assert.ok(imps.length>=3,'a three-point imp component survives');
});

test('retirement permission does not excuse a launcher that never feeds',()=>{
  const tree=paired({RETIRE:1,N:9});tree.P.HOPA=2465;tree.P.HOPB=1628;
  assert.throws(()=>buildTree(tree,{rules:'94nop',length:100}),/never fed its spiral/);
});

test('retirement permission requires surviving imp descendants',()=>{
  assert.throws(()=>buildTree(paired({RETIRE:1,K:2}),{rules:'94nop',length:100}),/retired.*imps/i);
});

test('a stopped feeder cannot claim retirement without a partner overwriting it',()=>{
  const settings=treeSettings('94nop',100),tree=paired({RETIRE:1});
  // This bomber's two target cells do not touch the remote feeder.
  tree.kids[0]={id:'stone',P:{TSTEP:4000}};
  const b=link(tree,settings);
  const prefix=Object.keys(b.labels).find(k=>k.endsWith('fLoop')).slice(0,-5);
  let source=b.source.replace(new RegExp(`^ JMP\\.B ${prefix}fLoop, 0$`,'m'),` DJN.A ${prefix}fLoop, ${prefix}fCnt`);
  source=source.replace(new RegExp(`^(${prefix}fCnt DAT\\.F) #0,`,'m'),'$1 #10,');
  assert.notEqual(source,b.source,'the feeder really stops after ten passes');
  const w=compile(source,'redcode',settings);assert.equal(w.ok,true);
  assert.throws(()=>gate({...b,source,w,settings,tree}),/did not refill its spiral|did not survive alone/);
});
