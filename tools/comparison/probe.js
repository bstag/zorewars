import assert from 'node:assert/strict';
import {VM} from '../../src/engine/index.js';
import {createObservation} from '../algebra/observe.js';
import {assertSameState,validateScope} from './paired.js';
import {sameInstruction} from './contacts.js';

// Select from the saved candidate pool, never by the intervention's outcome.
export function selectWriterContacts(contacts,{pc,instruction,limit=3,kind='pointer-read'}){
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('Invalid contact limit');
 return contacts.filter(c=>c.actor===0&&c.pc===pc&&sameInstruction(c.instruction,instruction)&&c.firstValueRead?.kind===kind)
  .sort((a,b)=>a.firstValueRead.step-b.firstValueRead.step||a.step-b.step||a.id-b.id).slice(0,limit);
}

function observed(vm,built){
 const role=built?createObservation(built,vm):null,had=Object.hasOwn(vm,'resolve'),resolve=vm.resolve;let event,closed=false;
 vm.resolve=function(...args){const address=resolve.apply(this,args);event.operands.push({address,instruction:this.peek(address)});return address;};
 return {
  step(){if(vm.done)return null;role?.before();const actor=vm.turn,q=vm.warriors[actor].queue,pc=q.buf[q.head];event={step:vm.steps+1,cycle:vm.cycle,actor,pc,instruction:vm.peek(pc),operands:[],owner:vm.owner[pc]};const result=vm.step();event.killed=!!result.killed;event.queueSize=vm.warriors[actor].queue.size;role?.after();return event;},
  close(finish=false){if(closed)return null;closed=true;if(had)vm.resolve=resolve;else delete vm.resolve;return finish?role?.finish()??null:role?.dispose();}
 };
}
const activity=()=>[{steps:0,mov:0,comparisons:0,deaths:0,foreignSteps:0},{steps:0,mov:0,comparisons:0,deaths:0,foreignSteps:0}];
function count(t,e){if(!e)return;const r=t[e.actor];r.steps++;if(e.instruction.op==='MOV')r.mov++;if(['SEQ','SNE','SLT'].includes(e.instruction.op))r.comparisons++;if(e.killed)r.deaths++;if(e.owner>=0&&e.owner!==e.actor)r.foreignSteps++;}

// Restore a subset after the writing instruction. Do not alter scheduling,
// provenance, other fields, or already resolved effects in that instruction.
export function probeWrite(subject,enemy,settings,plan,contact,{fields=contact.changedFields,noOp=false,built=null}={}){
 validateScope(settings,[subject,enemy]);
 if(!fields.length||fields.some(f=>!contact.changedFields.includes(f)))throw Error('Probe fields must be a nonempty subset of changed fields');
 if(!contact.afterStep||fields.some(f=>contact.after[f]!==contact.afterStep[f]))return {applied:false,reason:'Selected fields were changed again inside the writing instruction'};
 const machines={},hooks={},totals={reference:activity(),intervention:activity()},afterUse={reference:activity(),intervention:activity()},divergence={firstInstruction:null,firstAddresses:null,firstControl:null,firstEnemy:null,firstSubject:null},useStep=contact.firstValueRead?.step??contact.firstExecution?.step??null;
 let applied=false,restored=null,useContext={};
 try{
  for(const side of ['reference','intervention']){const vm=machines[side]=new VM(settings);vm.load([subject,enemy],{positions:plan.positions,firstTurn:plan.firstTurn});hooks[side]=observed(vm,built);}
  while(!machines.reference.done||!machines.intervention.done){const events={};
   for(const side of ['reference','intervention']){
    const vm=machines[side],e=events[side]=hooks[side].step();count(totals[side],e);if(e&&useStep&&e.step>=useStep)count(afterUse[side],e);if(e?.step===useStep)useContext[side]=e;
    if(side==='intervention'&&e?.step===contact.step){assert.equal(e.actor,contact.actor);assert.equal(e.pc,contact.pc);assert.ok(sameInstruction(e.instruction,contact.instruction),'Writer instruction fingerprint');assert.ok(sameInstruction(vm.peek(contact.address),contact.afterStep),'Post-write fingerprint');restored={...vm.peek(contact.address)};if(!noOp)for(const f of fields)restored[f]=contact.before[f];vm.poke(contact.address,restored,vm.owner[contact.address]);applied=true;}
   }
   const a=events.reference,b=events.intervention,pair={reference:a,intervention:b};
   if(a&&b){const instruction=!sameInstruction(a.instruction,b.instruction),addresses=a.operands.some((o,i)=>o.address!==b.operands[i].address),control=a.actor!==b.actor||a.pc!==b.pc||a.killed!==b.killed||a.queueSize!==b.queueSize;
    if(instruction&&!divergence.firstInstruction)divergence.firstInstruction=pair;if(addresses&&!divergence.firstAddresses)divergence.firstAddresses=pair;if(control&&!divergence.firstControl)divergence.firstControl=pair;
    // Operand snapshots are recorded as evidence, not automatically called a semantic read.
    const changed=instruction||addresses||control||a.operands.some((o,i)=>!sameInstruction(o.instruction,b.operands[i].instruction));
    if(changed&&a.actor===b.actor){const key=a.actor===1?'firstEnemy':'firstSubject';divergence[key]??=pair;}
   }else if(a||b)divergence.firstControl??=pair;
  }
  const roles={};for(const side of ['reference','intervention'])roles[side]=hooks[side].close(true);
  const plain=new VM(settings);plain.load([subject,enemy],{positions:plan.positions,firstTurn:plan.firstTurn});plain.run();assertSameState(machines.reference,plain);if(noOp)assertSameState(machines.intervention,plain);
  return {applied,noOp,fields,address:contact.address,step:contact.step,restored,useStep,useContext,divergence,referenceParity:true,noOpParity:noOp?true:null,versions:Object.fromEntries(Object.entries(machines).map(([side,vm])=>[side,{winner:vm.winner,cycles:vm.cycle,activity:totals[side],activityFromOriginalUseStep:afterUse[side],roles:roles[side],ending:vm.warriors.map(w=>({alive:w.alive,processes:w.queue.size,deaths:w.deaths,foreignSteps:w.foreignSteps}))}]))};
 }finally{for(const h of Object.values(hooks))h.close();}
}
