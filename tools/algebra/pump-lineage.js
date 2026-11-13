import {blockInstances} from './layout.js';
import {compactPumpCellCompatible} from './observation-roles.js';
import {compatibleImp} from './blocks/_compact-pump.js';

// Mirror FIFO tags, without wrapping or changing VM queue operations. A tag is
// assigned on the first intact pump entry and inherited by actual successors.
// It records process descent, not ownership of copied instructions.
export function createPumpLineageObservation(built,vm,{warrior=0}={}){
 if(vm.geo)throw Error('Pump lineage currently supports ring rounds');
 const base=vm.warriors[warrior].position,core=vm.size,norm=x=>vm.norm(x),capacity=vm.settings?.maxProcesses??built.settings.maxProcesses;
 const tags=new Int32Array(capacity).fill(-1);let head=0,size=vm.warriors[warrior].queue.size,pending=null;
 const engines=blockInstances(built.root,built.labels,built.spans,built.settings).filter(x=>x.node.id==='compact-imp-pump').map(x=>{
  const entry=norm(base+x.shift+built.labels[x.node.ns+'pFeed']),template=built.w.instructions[built.labels[x.node.ns+'pImp']];
  return {namespace:x.node.ns,entry,seed:norm(entry+4+x.node.P.LEAD),N:x.node.P.N,template,firstEntry:null,launches:0,readyLaunches:0,arithmeticDeviations:0,firstArithmeticDeviation:null,firstImpExecution:null,impExecutions:0,launchSamples:[],inheritedAdmissions:0};
 });
 if(!engines.length)throw Error('No compact pump instances');
 const intact=e=>Array.from({length:4},(_,i)=>compactPumpCellCompatible(vm.peek(norm(e.entry+i)),built.w.instructions[built.labels[e.namespace+'pFeed']+i],i,core)).every(Boolean);
 return {
  before(){if(pending)throw Error('Unfinished lineage step');if(vm.turn!==warrior)return;
   const q=vm.warriors[warrior].queue;if(q.size!==size)throw Error('Lineage queue size mismatch');const pc=q.buf[q.head],instruction=vm.peek(pc);let tag=tags[head];
   if(tag<0){const index=engines.findIndex(e=>e.entry===pc&&intact(e));if(index>=0){tag=index;engines[index].firstEntry??=vm.cycle;engines[index].inheritedAdmissions++;}}
   if(tag>=0){const e=engines[tag];if(pc===norm(e.entry+3)&&intact(e)){
    const target=norm(pc+instruction.a),want=norm(e.seed+e.launches*(e.template.b+1));if(target!==want){e.arithmeticDeviations++;e.firstArithmeticDeviation??={cycle:vm.cycle,target,want};}
    const ready=compatibleImp(vm.peek(target),e.template,core);e.launches++;if(ready)e.readyLaunches++;if(e.launchSamples.length<4)e.launchSamples.push({cycle:vm.cycle,target,ready});
   }
   if(norm(pc-e.entry)>=5&&compatibleImp(instruction,e.template,core)){e.firstImpExecution??=vm.cycle;e.impExecutions++;}}
   pending={tag,size,step:vm.steps+1};
  },
  after(){if(!pending)return;if(vm.steps!==pending.step)throw Error('Lineage observation needs exactly one step');const q=vm.warriors[warrior].queue,successors=q.size-(pending.size-1);if(![0,1,2].includes(successors))throw Error('Unexpected queue successor count');
   head=(head+1)%capacity;size--;for(let i=0;i<successors;i++){tags[(head+size)%capacity]=pending.tag;size++;}pending=null;
  },
  snapshot(){if(pending)throw Error('Unfinished lineage step');const pcs=vm.processes(warrior);if(pcs.length!==size)throw Error('Lineage ending queue mismatch');const ending=engines.map(()=>({processes:0,compatibleImps:0}));let unassigned=0;
   for(let i=0;i<size;i++){const tag=tags[(head+i)%capacity];if(tag<0){unassigned++;continue;}ending[tag].processes++;if(compatibleImp(vm.peek(pcs[i]),engines[tag].template,core))ending[tag].compatibleImps++;}
   return {scope:'FIFO process descent since first intact compact-pump entry. Children inherit tags; no attribution from instruction ownership or template shape alone.',engines:engines.map((e,i)=>({...e,...ending[i]})),unassignedProcesses:unassigned,totalProcesses:size};
  },
  finish(){return this.snapshot();}
 };
}
