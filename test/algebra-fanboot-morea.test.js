import test from 'node:test';
import assert from 'node:assert/strict';
import {leaves,link,treeMismatches,treeSettings} from '../tools/algebra/index.js';
import {compile,VM} from '../src/engine/index.js';
const settings=treeSettings('94nop',100);
// Single-entry self loops isolate the launch routing from growing bodies.
leaves['test-boot-loop']={id:'test-boot-loop',kind:'body',exit:'never',processes:1,writes:'none',dialects:'94',entry:'loop',emit:c=>c.ins('loop','JMP','B',c.L('loop'))};
const tree=(N,MOREA)=>({id:'fanboot',P:{N,SPLIT:1,MOREA,HOPA:2000,HOPB:5000},kids:[{id:'test-boot-loop'},{id:'test-boot-loop'}]});
test('fanboot MOREA adds exactly one first-body worker and preserves copied code at wrap',()=>{
 for(const N of [2,3,4,6,8,12,16])for(const MOREA of [0,1])for(const pos of [0,7993]){
  const b=link(tree(N,MOREA),settings),w=compile(b.source,'redcode',settings);assert.ok(w.ok);
  const vm=new VM(settings);vm.load([w],{positions:[pos]});vm.run(500);
  const a=vm.norm(pos+b.labels[b.root.kids[0].ns+'loop']+2000),p=vm.norm(pos+b.labels[b.root.kids[1].ns+'loop']+5000),pcs=vm.processes(0);
  assert.equal(pcs.filter(x=>x===a).length,N-1+MOREA);assert.equal(pcs.filter(x=>x===p).length,1);assert.equal(pcs.length,N+MOREA);
  for(const at of [a,p]){assert.equal(vm.peek(at).op,'JMP');assert.equal(vm.peek(at).a,0);}
 }
});
test('fanboot MOREA is opt-in and refuses a non-split boot',()=>{
 const t=tree(4,0),a=link(t,settings);delete t.P.MOREA;assert.equal(link(t,settings).source,a.source);
 t.P.SPLIT=0;t.P.MOREA=1;assert.ok(treeMismatches(t,settings).some(x=>x.includes('MOREA requires')));
});
