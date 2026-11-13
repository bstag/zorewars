import test from 'node:test';
import assert from 'node:assert/strict';
import {leaves,buildTree,link,treeSettings} from '../tools/algebra/index.js';
import compact,{compatibleImp} from '../tools/algebra/blocks/_compact-pump.js';
import {compile,VM} from '../src/engine/index.js';
leaves[compact.id]={...compact,file:'_compact-pump.js'};
const settings=treeSettings('94nop',100);
function built(P={}){const b=link({id:compact.id,P},settings),w=compile(b.source,'redcode',settings);assert.ok(w.ok);return {...b,w,settings};}

test('compact pump is five cells and grows a working spiral in both source modes',()=>{
  for(const IMM of [0,1]){
    const b=buildTree({id:compact.id,P:{IMM}},{rules:'94nop',length:100});assert.equal(b.total,5);assert.ok(b.verification.ok);
    for(const pos of [0,7993]){
      const vm=new VM(settings);vm.load([b.w],{positions:[pos]});vm.run();
      const t=b.w.instructions[b.labels[b.root.ns+'pImp']];
      assert.ok(vm.warriors[0].alive);assert.ok(vm.processes(0).filter(pc=>compatibleImp(vm.peek(pc),t,8000)).length>=9);
    }
  }
});

test('the launch progression follows step-plus-one and a shifted seed stays alive',()=>{
  for(const LEAD of [0,12]){
    const b=built({LEAD,IMM:1}),vm=new VM(settings);vm.load([b.w],{positions:[0]});
    const p=b.root.ns,jump=b.labels[p+'pJump'],seed=b.labels[p+'pImp']+LEAD;let n=0;
    while(!vm.done&&vm.cycle<8000){const q=vm.warriors[0].queue,pc=q.buf[q.head];if(pc===jump){assert.equal(vm.norm(pc+vm.a[pc]),vm.norm(seed+n*2668));n++;}vm.step();}
    assert.ok(n>20);
  }
});

test('immediate source survives an A-field change that breaks a direct-source imp',()=>{
  for(const IMM of [0,1]){
    const b=built({IMM}),t=b.w.instructions[b.labels[b.root.ns+'pImp']];
    const vm=new VM(settings);vm.load([{...b.w,instructions:[{...t,a:1}],start:0}],{positions:[0]});vm.step();
    assert.equal(vm.peek(2667).op,IMM?'MOV':'DAT');
    assert.equal(compatibleImp({...t,a:1},t,8000),Boolean(IMM));
  }
});

test('the behavior watch rejects a wrong launch increment',()=>{
  const id='broken-compact-pump';
  leaves[id]={...compact,id,emit:ctx=>compact.emit({...ctx,ins:(label,op,mod,a,b)=>ctx.ins(label,op,mod,label==='pStep'?'#2669':a,b)})};
  try{assert.throws(()=>buildTree({id},{rules:'94nop',length:100}),/expected/);}finally{delete leaves[id];}
});

test('retirement never excuses absent launches or lost descendants',()=>{
  const b=built({RETIRE:1}),vm=new VM(settings);vm.load([b.w],{positions:[0]});
  const at=(l,k=0)=>b.labels[b.root.ns+l]+k,api={vm,P:{...compact.defaults,RETIRE:1},core:8000,settings,at,entry:()=>at('pFeed'),code:(l,k=0)=>b.w.instructions[at(l,k)],norm:x=>vm.norm(x),same:(a,c)=>['op','mod','aMode','bMode','a','b'].every(k=>a[k]===c[k]),inSelf:pc=>pc>=0&&pc<5,alone:false,scenario:'alone'};
  const watch=compact.watch(api);watch.before(at('pFeed'));assert.throws(()=>watch.final(),/only0|only 0/);
  while(!vm.done&&vm.cycle<2000){const q=vm.warriors[0].queue,pc=q.buf[q.head];watch.before(pc);vm.step();watch.after();}
  for(const pc of vm.processes(0))if(compatibleImp(vm.peek(pc),api.code('pImp'),8000))vm.poke(pc,{op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0});
  assert.throws(()=>watch.final(),/only 0 compatible/);
});

test('friendly retirement is optional and does not change code or require a stopped launcher to regenerate',()=>{
  const tree=RETIRE=>({id:'fanboot',P:{N:4,K:1,SPLIT:1,HOPA:3363,HOPB:800},kids:[{id:'armadillo-switch'},{id:compact.id,P:{N:3,LEAD:0,IMM:1,RETIRE}}]});
  assert.equal(link(tree(0),settings).source,link(tree(1),settings).source);
  assert.throws(()=>buildTree(tree(0),{rules:'94nop',length:100}),/stopped without permitted/);
  assert.ok(buildTree(tree(1),{rules:'94nop',length:100}).verification.ok);
});

test('retirement remembers the first damaging writer, before later self-copying loses provenance',()=>{
  for(const friendly of [true,false]){
    const b=built({RETIRE:1,IMM:1}),vm=new VM(settings);vm.load([b.w],{positions:[0]});
    const at=(l,k=0)=>b.labels[b.root.ns+l]+k,api={vm,P:{...compact.defaults,IMM:1,RETIRE:1},core:8000,settings,at,entry:()=>at('pFeed'),code:(l,k=0)=>b.w.instructions[at(l,k)],norm:x=>vm.norm(x),same:(a,c)=>['op','mod','aMode','bMode','a','b'].every(k=>a[k]===c[k]),inSelf:pc=>pc>=0&&pc<5,alone:false,scenario:'alone'};
    const watch=compact.watch(api);
    while(vm.cycle<300){watch.before(vm.processes(0)[0]);vm.step();watch.after();}
    const jump=at('pJump');
    vm.poke(jump,{op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0});vm.owner[jump]=friendly?0:1;vm.writerPc[jump]=1000;watch.after();
    // Later code may retag the same bad cell. This must neither erase a
    // proven friendly first fault nor launder an enemy fault into retirement.
    vm.owner[jump]=0;vm.writerPc[jump]=friendly?at('pCarpet'):1001;watch.after();
    if(friendly)assert.doesNotThrow(()=>watch.final());else assert.throws(()=>watch.final(),/stopped without permitted/);
  }
});
