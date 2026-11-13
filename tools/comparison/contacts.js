// Observation only: preserve native operand order, register snapshots and writes.
// A contact, a later use, and a strategic consequence are separate evidence.
const FIELDS=['op','mod','aMode','a','bMode','b'];
const active=Symbol('comparisonContacts');
export const instructionKey=i=>FIELDS.map(f=>i[f]);
export const sameInstruction=(a,b)=>FIELDS.every(f=>a[f]===b[f]);
const numerical=(mod,side)=>mod==='F'||mod==='X'||mod==='I'?['a','b']:mod==='A'?['a']:mod==='B'?['b']:mod==='AB'?(side===0?['a']:['b']):['b'].map(f=>side===0?f:'a');
function operandFields(i,side){
 if(['MOV','ADD','SUB','MUL','DIV','MOD','SEQ','SNE','SLT'].includes(i.op)){
  if(i.op==='MOV'&&side===1)return [];
  if(i.mod==='I'&&['MOV','SEQ','SNE'].includes(i.op))return FIELDS;
  return numerical(i.mod,side);
 }
 if(side===1&&['DJN','JMZ','JMN'].includes(i.op))return ['A','BA'].includes(i.mod)?['a']:['F','X','I'].includes(i.mod)?['a','b']:['b'];
 return [];
}
export function createContactObservation(vm,{earlyLimit=32,usedLimit=128,windowCycles=1000,recentSteps=4096}={}){
 if(vm.geo||vm.warriors.length!==2||vm.settings.pSpace)throw Error('Contact observation supports two-warrior ring rounds without P-space');
 for(const [k,v]of Object.entries({earlyLimit,usedLimit,windowCycles,recentSteps}))if(!Number.isSafeInteger(v)||v<1)throw Error(`Invalid ${k}`);
 if(vm[active])throw Error('This VM already has contact observation');
 const token={},original={},owned={};for(const k of ['resolve','applyPostIncrement','touch']){original[k]=vm[k];owned[k]=Object.hasOwn(vm,k);}
 const shadow=Array.from({length:vm.size},(_,i)=>vm.peek(i)),origins=Object.fromEntries(FIELDS.map(f=>[f,Array(vm.size).fill(null)])),lastExec=[new Float64Array(vm.size).fill(-Infinity),new Float64Array(vm.size).fill(-Infinity)],footprints=Array.from({length:vm.size},()=>0);
 for(const w of vm.warriors)for(let i=0;i<w.original.length;i++)footprints[vm.norm(w.position+i)]|=1<<w.index;
 let event=null,finished=false,disposed=false,nextId=0;const early=[],used=[],windows=[[],[]],totals=[{},{}],counts={touches:0,valueChangingWrites:0,enemyOwnedTouches:0,opponentEncounters:0,executedChangedCells:0,valueReads:0,newDatKills:0};
 const bump=(actor,key,cycle,n=1)=>{totals[actor][key]=(totals[actor][key]??0)+n;const at=Math.floor(cycle/windowCycles),r=windows[actor][at]??={start:at*windowCycles,end:(at+1)*windowCycles};r[key]=(r[key]??0)+n;};
 const retain=c=>{if(!c.retained&&used.length<usedLimit){c.retained=true;used.push(c);}};
 function encounter(address,fields,kind,detail={}){if(!event)return;const found=new Map();for(const f of fields){const c=origins[f][address];if(c&&c.actor!==event.actor){if(!found.has(c.id))found.set(c.id,{c,fields:[]});found.get(c.id).fields.push(f);}}
  for(const {c,fields:usedFields}of found.values()){
   const evidence={step:event.step,cycle:event.cycle,actor:event.actor,pc:event.pc,instruction:event.instruction,kind,fields:usedFields,...detail};
   if(!c.firstEncounter){c.firstEncounter=evidence;counts.opponentEncounters++;bump(c.actor,'writesLaterEncountered',event.cycle);}
   if(kind==='executed'&&!c.firstExecution){c.firstExecution=evidence;counts.executedChangedCells++;}
   if(kind!=='executed'&&!c.firstValueRead){c.firstValueRead=evidence;counts.valueReads++;}
   retain(c);
  }
 }
 vm[active]=token;
 const touch=function(address,actor){const before=shadow[address],after=this.peek(address),previousOwner=this.owner[address],changed=FIELDS.filter(f=>before[f]!==after[f]);original.touch.call(this,address,actor);shadow[address]=after;
  if(!event)return;counts.touches++;bump(actor,'touches',event.cycle);if(previousOwner>=0&&previousOwner!==actor){counts.enemyOwnedTouches++;bump(actor,'enemyOwnedTouches',event.cycle);}
  if(!changed.length){event.writes.push({address,changedFields:[],previousOwner,phase:event.phase});return;}
  counts.valueChangingWrites++;bump(actor,'valueChangingWrites',event.cycle);const victim=1-actor,c={id:nextId++,step:event.step,cycle:event.cycle,actor,pc:event.pc,instruction:event.instruction,address,before,after,previousOwner,phase:event.phase,changedFields:changed,loadedOpponent:!!(footprints[address]&(1<<victim)),everExecutedByOpponent:Number.isFinite(lastExec[victim][address]),recentlyExecutedByOpponent:event.step-lastExec[victim][address]<=recentSteps,firstEncounter:null,firstExecution:null,firstValueRead:null};
  for(const f of changed)origins[f][address]=c;
  event.writes.push(c);if((previousOwner===victim||c.loadedOpponent||c.everExecutedByOpponent)&&early.length<earlyLimit){c.retained=true;early.push(c);}
 };
 const resolve=function(mode,field,pc,actor){const side=event?.operands.length??0,p=this.norm(pc+field);if(event){event.phase=side?'b-resolution':'a-resolution';if(mode>=2)encounter(p,[([2,4,6].includes(mode)?'a':'b')],'pointer-read',{operand:side,pointerMode:mode});}
  const address=original.resolve.call(this,mode,field,pc,actor);if(event){const snapshot=this.peek(address);event.operands.push({address,snapshot});encounter(address,operandFields(event.instruction,side),'operand-value-read',{operand:side});}return address;};
 const post=function(actor){if(event)event.phase=event.operands.length===1?'a-postincrement':'b-postincrement';original.applyPostIncrement.call(this,actor);if(event)event.phase='instruction-body';};
 vm.touch=touch;vm.resolve=resolve;vm.applyPostIncrement=post;
 function dispose(){if(disposed)return;disposed=true;if(vm[active]===token){for(const [k,wrapper]of [['touch',touch],['resolve',resolve],['applyPostIncrement',post]])if(vm[k]===wrapper){if(owned[k])vm[k]=original[k];else delete vm[k];}delete vm[active];}}
 return {
  before(){if(event||finished||disposed||vm.done)throw Error('Invalid contact observation step order');const actor=vm.turn,q=vm.warriors[actor].queue,pc=q.buf[q.head];event={actor,pc,instruction:vm.peek(pc),cycle:vm.cycle,step:vm.steps+1,phase:'instruction-register',operands:[],writes:[],queueBefore:q.size,ownerBefore:vm.owner[pc],opOrigin:origins.op[pc]};encounter(pc,FIELDS,'executed');lastExec[actor][pc]=event.step;return event;},
  after(result){if(!event||vm.steps!==event.step||finished||disposed)throw Error('Contact observation requires one step');const e=event;bump(e.actor,'steps',e.cycle);if(e.instruction.op==='MOV')bump(e.actor,'movSteps',e.cycle);if(['SEQ','SNE','SLT'].includes(e.instruction.op))bump(e.actor,'comparisonSteps',e.cycle);if(e.instruction.op==='SPL'){bump(e.actor,'splitAttempts',e.cycle);if(vm.warriors[e.actor].queue.size>e.queueBefore)bump(e.actor,'splitAdmitted',e.cycle);}if(result?.killed){bump(e.actor,'deaths',e.cycle);if(e.instruction.op==='DAT'&&e.opOrigin&&e.opOrigin.actor!==e.actor&&e.opOrigin.after.op==='DAT'&&e.opOrigin.before.op!=='DAT'){e.opOrigin.newDatKill??={step:e.step,cycle:e.cycle,pc:e.pc,actor:e.actor};counts.newDatKills++;retain(e.opOrigin);}}
   if(e.ownerBefore>=0&&e.ownerBefore!==e.actor)bump(e.actor,'foreignOwnerSteps',e.cycle);
   for(const c of e.writes)if(c.changedFields.length)c.afterStep=vm.peek(c.address);
   event=null;return {actor:e.actor,pc:e.pc,cycle:e.cycle,step:e.step,instruction:e.instruction,operands:e.operands,writes:e.writes.map(c=>({address:c.address,changedFields:c.changedFields,after:c.after??null,phase:c.phase})),killed:!!result?.killed};
  },
  finish(){if(event||finished||disposed)throw Error('Cannot finish active contact observation');finished=true;try{const contacts=[...new Map([...early,...used].map(c=>[c.id,c])).values()].sort((a,b)=>a.step-b.step);for(const c of contacts)delete c.retained;return {schema:'memory-contacts-v1',counts,contacts,activity:{windowCycles,windows,totals},retention:{earlyLimit,usedLimit,retained:contacts.length,firstDirectContacts:early.length,firstUsedContacts:used.length,capped:early.length===earlyLimit||used.length===usedLimit},scope:'Writes, subsequent register/value/pointer use and actor activity. These do not by themselves establish strategic damage or process ancestry.'};}finally{dispose();}},dispose
 };
}
