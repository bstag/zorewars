// Read-only execution observation. The resolver is called exactly once, in
// the VM's normal order; register snapshots precede postincrement side effects.
import {compile,VM} from '../../src/engine/index.js';
import {leaves} from './leaves.js';
import {blockInstances} from './layout.js';
const activeObserver=Symbol('algebraObservation');
const same=(a,b,core,ignore=[])=>['op','mod','aMode','bMode','a','b'].every(k=>ignore.includes(k)||(['a','b'].includes(k)?((a[k]-b[k])%core+core)%core===0:a[k]===b[k]));

export function createObservation(built,vm,{warrior=0}={}){
 if(!built.w?.ok||vm.size!==built.settings.coreSize||!Number.isSafeInteger(warrior)||!vm.warriors[warrior])throw Error('Observer requires a compiled tree and its loaded warrior');
 if(vm[activeObserver])throw Error('This VM already has an algebra observer');
 const {root,labels,spans,settings,w}=built,base=vm.warriors[warrior].position,core=settings.coreSize;
 const add=(a,b)=>vm.geo?vm.geo.add(a,b):vm.norm(a+b),rel=(a,b)=>vm.geo?vm.geo.sub(a,b):vm.norm(a-b);
 let event=null,finished=false,disposed=false;const token={},hadOwnResolve=Object.hasOwn(vm,'resolve'),originalResolve=vm.resolve,records=[],monitors=[];
 const provenance=address=>({owner:vm.owner[address],writerPc:vm.writerPc[address],writeCycle:vm.writeCycle[address],writeStep:vm.lastWrite[address],writerInstruction:event&&vm.lastWrite[address]===event.step?{...event.instruction}:null});
 for(const instance of blockInstances(root,labels,spans,settings).filter(x=>leaves[x.node.id].kind!=='data')){
  const {node,shift}=instance,def=leaves[node.id],home=add(base,shift),span=spans[node.ns],at=(label,k=0)=>{const p=labels[node.ns+label];if(p===undefined)throw Error(`${node.id}: unknown observation label ${label}`);return add(home,p+k);};
  const record={id:node.id,namespace:node.ns,shift,parameters:{...node.P},phaseContract:structuredClone(def.phaseContract??null),role:def.observationRole??null,optional:!!instance.optional,mayStop:!!instance.mayStop,entry:at(def.entry),span:{start:add(home,span.start),size:span.size},enteredAt:null,phases:{},work:{},firstFault:null};
  const targets=new Map(),own=e=>e.actor===warrior,work=(name,detail={})=>{const r=record.work[name]??={count:0,firstCycle:event.cycle,lastCycle:event.cycle};r.count++;r.lastCycle=event.cycle;if(detail.target!==undefined){r.firstTarget??=detail.target;r.lastTarget=detail.target;if(!targets.has(name))targets.set(name,new Set());targets.get(name).add(detail.target);r.uniqueTargets=targets.get(name).size;}};
  const api={core,settings:structuredClone(settings),P:{...node.P},warrior,at,own,norm:x=>vm.norm(x),rel,entered:()=>record.enteredAt!==null,original:(label,k=0)=>({...w.instructions[labels[node.ns+label]+k]}),originalAt:address=>{const i=w.instructions[rel(address,home)];return i?{...i}:null;},peek:address=>vm.peek(address),provenance,inLoadedImage:address=>rel(address,base)<built.total,
   same:(a,b,ignore=[])=>same(a,b,core,ignore),matches:(e,label,ignore=[])=>own(e)&&e.pc===at(label)&&same(e.instruction,w.instructions[labels[node.ns+label]],core,ignore),
   inSelf:address=>rel(address,record.span.start)<span.size,processes:()=>vm.processes(warrior),
   wrote:(e,address)=>vm.lastWrite[address]===e.step&&vm.owner[address]===e.actor&&vm.writerPc[address]===e.pc,
   work,phase:(name,detail={})=>{record.phases[name]??={cycle:event.cycle,...detail};},
   fault:(kind,address,detail={})=>{record.firstFault??={kind,address,cycle:event.cycle,...provenance(address),instruction:vm.peek(address),...detail};},
   firstFault:()=>record.firstFault,workCount:name=>record.work[name]?.count??0};
  const hooks=def.observe?.(api)??{};records.push(record);monitors.push({record,hooks});
 }
 vm[activeObserver]=token;
 vm.resolve=function(...args){const address=originalResolve.apply(this,args);if(event)event.operands.push({address,snapshot:this.peek(address),...provenance(address)});return address;};
 const dispose=()=>{if(disposed)return;disposed=true;if(vm[activeObserver]===token){if(hadOwnResolve)vm.resolve=originalResolve;else delete vm.resolve;delete vm[activeObserver];}};
 return {
  before(){if(finished||disposed||event||vm.done)throw Error('Invalid observation step order');const actor=vm.turn,q=vm.warriors[actor].queue,pc=q.buf[q.head];event={actor,pc,cycle:vm.cycle,step:vm.steps+1,instruction:vm.peek(pc),operands:[]};
   for(const m of monitors){if(actor===warrior&&pc===m.record.entry)m.record.enteredAt??=event.cycle;m.hooks.before?.(event);}return event;
  },
  after(){if(!event||finished||disposed||vm.steps!==event.step)throw Error('Observation requires before/step/after');for(const m of monitors)m.hooks.after?.(event);event=null;},
  finish(){if(event||finished||disposed)throw Error('Cannot finish an active/completed observation');finished=true;try{for(const m of monitors)Object.assign(m.record,m.hooks.finish?.()??{});
    return {schema:'algebra-work-v1',scope:vm.warriors.length===1?'solo':'battle',coreSize:core,cycleLimit:settings.maxCycles,cycles:vm.cycle,steps:vm.steps,fullHorizon:vm.cycle>=settings.maxCycles,warrior,base,winner:vm.winner,alive:vm.warriors[warrior].alive,processes:vm.warriors[warrior].queue.size,
     coverage:{observed:records.filter(r=>r.role).map(r=>r.namespace),unobserved:records.filter(r=>!r.role).map(r=>({id:r.id,namespace:r.namespace})),phaseContracts:records.filter(r=>leaves[r.id].verifyObservation).map(r=>r.namespace)},blocks:records};
   }finally{dispose();}},dispose
 };
}

export function verifyPhases(report){
 if(report.scope!=='solo')throw Error('Battle observations are diagnostic, not solo verification');
 const issues=[];if(!report.fullHorizon)issues.push(`full horizon not reached (${report.cycles}/${report.cycleLimit})`);if(!report.alive)issues.push('warrior did not survive');
 const verified=[],skipped=[];for(const block of report.blocks){if(block.enteredAt===null){if(!block.optional)issues.push(`${block.id} ${block.namespace}: required block was never entered`);else skipped.push({namespace:block.namespace,reason:'optional block not entered'});continue;}if(block.mayStop){skipped.push({namespace:block.namespace,reason:'parent permits stopping'});continue;}const def=leaves[block.id];if(!def){issues.push(`unknown block ${block.id}; register its definition before phase verification`);continue;}const check=def.verifyObservation;if(check){verified.push(block.namespace);for(const issue of check(block,report)??[])issues.push(`${block.id} ${block.namespace}: ${issue}`);}}
 return {ok:issues.length===0,scope:'full solo horizon and declared phase contracts',verified,skipped,unobserved:report.coverage.unobserved,issues};
}

// Controlled injections are host-side test inputs, never Redcode changes.
// A battle report is observation only; it is never a promise to beat an enemy.
export function observeTree(built,{opponent=null,positions,firstTurn=0,cycles=built.settings.maxCycles,injections=[]}={}){
 if(!built.w?.ok)throw Error('Observation requires a compiled tree');
 if(!Number.isSafeInteger(cycles)||cycles<1||cycles>built.settings.maxCycles)throw Error('Invalid observation horizon');
 const enemy=typeof opponent==='string'?compile(opponent,'redcode',built.settings):opponent;if(enemy&&!enemy.ok)throw Error('Observation opponent does not compile');
 const players=enemy?[built.w,enemy]:[built.w],placement=positions??(enemy?[0,Math.floor(built.settings.coreSize/2)]:[0]);
 if(placement.length!==players.length||placement.some(p=>!Number.isSafeInteger(p)||p<0||p>=built.settings.coreSize)||!Number.isSafeInteger(firstTurn)||firstTurn<0||firstTurn>=players.length)throw Error('Invalid observation positions or first mover');
 const vm=new VM(built.settings);vm.load(players,{positions:placement,firstTurn});
 const pending=injections.map(x=>({...x})).sort((a,b)=>a.cycle-b.cycle);for(const x of pending)if(!Number.isSafeInteger(x.cycle)||x.cycle<0||x.cycle>=cycles||!Number.isSafeInteger(x.address)||x.address<0||x.address>=built.settings.coreSize||!x.instruction)throw Error('Invalid observation injection');
 const observer=createObservation(built,vm);let index=0;
 try{while(!vm.done&&vm.cycle<cycles){while(index<pending.length&&pending[index].cycle<=vm.cycle){const x=pending[index++];vm.poke(x.address,x.instruction,x.owner??-1);}observer.before();vm.step();observer.after();}
  const observation=observer.finish();observation.injections=pending;return {vm,observation};
 }finally{observer.dispose();}
}
