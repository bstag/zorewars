// Read-only observation of an exact DAT template, including its operand side
// effect. Ownership here is the last writer, never complete process ancestry.
export function createDatBombObservation(vm,{bomb,warrior=0,ownStride,limit=12}){
 if(vm.geo||bomb.op!=='DAT'||bomb.aMode!=='<'||bomb.bMode!=='$'||!Number.isInteger(ownStride)||!Number.isInteger(limit)||limit<0)throw Error('Expected a ring DAT with B-predecrement A and direct B, an imp stride and a nonnegative retention limit');
 const same=(a,b)=>['op','mod','aMode','bMode'].every(k=>a[k]===b[k])&&['a','b'].every(k=>vm.norm(a[k])===vm.norm(b[k]));
 const imp=i=>i.op==='MOV'&&i.mod==='I'&&i.bMode==='$'&&(i.aMode==='#'||i.aMode==='$'&&i.a===0);
 let pending=null;const counts={executions:0,byActor:{},targetOwners:{},ownCompatibleImpStrideHits:0,enemyImpLikeStrideHits:0},examples=[];
 return {
  before(){if(pending)throw Error('Unfinished DAT observation');const actor=vm.turn,q=vm.warriors[actor].queue,pc=q.buf[q.head],instruction=vm.peek(pc);
   if(vm.owner[pc]!==warrior||!same(instruction,bomb))return;
   const target=vm.norm(pc+instruction.a),before=vm.peek(target),targetOwner=vm.owner[target];
   pending={step:vm.steps+1,cycle:vm.cycle,actor,pc,target,targetOwner,before,ownCompatibleImp:targetOwner===warrior&&imp(before)&&before.b===vm.norm(ownStride),enemyImpLike:targetOwner>=0&&targetOwner!==warrior&&imp(before),writerPc:vm.writerPc[pc]};
  },
  after(){if(!pending)return;if(vm.steps!==pending.step)throw Error('DAT observation requires exactly one VM step');const e=pending;pending=null;e.after=vm.peek(e.target);
   if(e.after.b!==vm.norm(e.before.b-1))throw Error('DAT operand did not produce the expected remote decrement');
   counts.executions++;counts.byActor[e.actor]=(counts.byActor[e.actor]??0)+1;counts.targetOwners[e.targetOwner]=(counts.targetOwners[e.targetOwner]??0)+1;
   if(e.ownCompatibleImp)counts.ownCompatibleImpStrideHits++;if(e.enemyImpLike)counts.enemyImpLikeStrideHits++;
   if(examples.length<limit&&(e.ownCompatibleImp||e.enemyImpLike))examples.push(e);
  },
  finish(){if(pending)throw Error('Unfinished DAT observation');return {counts,examples,retentionLimit:limit,scope:'Exact unchanged bomb signature with our last-writer ownership. Remote B decrement observed directly. Compatible imp cells are not process ancestry; a stride hit does not establish a later kill or a cause of the round outcome.'};}
 };
}
