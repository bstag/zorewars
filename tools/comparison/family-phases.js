// Explicit source adapters for the frozen stone/imp family. Read-only hooks;
// observed code/pointer work is not a claim about the cause of a round win.
export function sourceInstructionIndex(source,w,label){
 const line=source.split(/\r?\n/).findIndex(s=>new RegExp('^\\s*'+label+'(?:[:\\s])','i').test(s))+1;
 const index=w.instructions.findIndex(i=>i.line===line);if(!line||index<0)throw Error('Missing instruction label '+label);return index;
}
export const familyPhaseSpecs={
 current:{stoneLabel:'b4asInc',stoneHome:3418,pumpLabel:'b5pFeed',pumpHome:2455,impLabel:'b5pImp',bootLabel:'b3start',seedHome:2523,decodeLabels:['b1dec1','b1dec0'],attackLabels:['b2loop','b2ptr']},
 tolypeutes:{stoneLabel:'sInc',stoneHome:7109,pumpBeforeImp:4,pumpHome:6881,impLabel:'imp',bootLabel:'wGo',seedFromBootOffset:0,decodeLabels:['dec'],attackLabels:['qptr']},
 armadillo:{stoneLabel:'inc',stoneHome:719,pumpLabel:'pump',pumpHome:6913,impLabel:'imp',bootLabel:'boot',seedFromBootOffset:1,decodeLabels:['qDec','qSkip'],attackLabels:['qLoop','qPtr']}
};
const fields=['op','mod','aMode','bMode','a','b'],active=Symbol('familyPhaseObservation');
export function createFamilyPhaseObservation(vm,{source,w,spec,warrior=0}){
 if(vm.geo||vm[active])throw Error('Family phases require an unobserved ring VM');
 const original={resolve:vm.resolve,touch:vm.touch},owned={resolve:Object.hasOwn(vm,'resolve'),touch:Object.hasOwn(vm,'touch')},base=vm.warriors[warrior].position,core=vm.size,norm=x=>vm.norm(x),index=l=>sourceInstructionIndex(source,w,l),stoneSource=index(spec.stoneLabel),impSource=index(spec.impLabel),pumpSource=spec.pumpLabel?index(spec.pumpLabel):impSource-spec.pumpBeforeImp,boot=norm(base+index(spec.bootLabel)),stone=norm(base+spec.stoneHome),pump=norm(base+spec.pumpHome),decode=new Set(spec.decodeLabels.map(l=>norm(base+index(l)))),attacks=new Set(spec.attackLabels.map(l=>norm(base+index(l)))),template=w.instructions[impSource];
 const same=(a,b,ignore=[])=>fields.every(k=>ignore.includes(k)||(k==='a'||k==='b'?norm(a[k])===norm(b[k]):a[k]===b[k]));
 if(w.instructions[stoneSource].op!=='SPL'||w.instructions[stoneSource+5].op!=='MOV'||w.instructions[stoneSource+7].op!=='DAT'||w.instructions[pumpSource].op!=='SPL'||template.op!=='MOV'||template.aMode!=='#'||template.bMode!=='$')throw Error('Source does not match the declared eight-cell stone / immediate direct-imp adapter');
 const imp=i=>i.op==='MOV'&&i.mod==='I'&&i.aMode==='#'&&i.bMode==='$'&&norm(i.b)===norm(template.b),critical=new Map(),shadow=new Map();
 for(const [kind,start,offset,size]of [['stone',stone,stoneSource,8],['pump',pump,pumpSource,4],['source-stone',norm(base+stoneSource),stoneSource,8],['source-pump',norm(base+pumpSource),pumpSource,4]])for(let k=0;k<size;k++){const address=norm(start+k);if(!critical.has(address))critical.set(address,[]);critical.get(address).push({kind,index:k,original:w.instructions[offset+k]});shadow.set(address,vm.peek(address));}
 const seedInstruction=spec.seedFromBootOffset===undefined?null:index(spec.bootLabel)+spec.seedFromBootOffset;
 if(seedInstruction!==null&&(w.instructions[seedInstruction].op!=='MOV'||w.instructions[seedInstruction].bMode!=='$'||norm(seedInstruction+w.instructions[seedInstruction].a)!==impSource))throw Error('Declared initial seed MOV does not read the imp template');
 const seed=norm(base+(seedInstruction===null?spec.seedHome:seedInstruction+w.instructions[seedInstruction].b));
 for(const [kind,address]of [['source-imp',norm(base+impSource)],['seed',seed]]){if(!critical.has(address))critical.set(address,[]);critical.get(address).push({kind,index:0,original:template});shadow.set(address,vm.peek(address));}
 let event=null,finished=false,disposed=false,handoff=false;const enemyExec=new Float64Array(core).fill(-Infinity),work={},frames=[200,1000,4000,8000,80000].map(end=>({end,counts:{}})),timeline=[],report={firstBootReached:null,firstHealthyBoot:null,firstStoneReached:null,firstHealthyStone:null,firstPumpReached:null,firstHealthyPump:null,firstCompatibleImp:null,firstResponse:null,naturalHandoff:null,firstEnemyRuntimeChange:null,firstEnemySourceChange:null,firstStoneSignatureFault:null,firstPumpSignatureFault:null,openingTargets:[],criticalChanges:[],work,frames};
 const point=(name,e)=>{report[name]??={cycle:e.cycle,pc:e.pc};};
 const count=(name,e,target)=>{const r=work[name]??={count:0,firstCycle:e.cycle,lastCycle:e.cycle};r.count++;r.lastCycle=e.cycle;for(const f of frames)if(e.cycle<f.end)f.counts[name]=(f.counts[name]??0)+1;if(target!==undefined){r.firstTarget??=target;r.lastTarget=target;}};
 const trace=(kind,e,detail={})=>{if(timeline.length<32)timeline.push({kind,cycle:e.cycle,pc:e.pc,...detail});};
 const resolve=function(...args){const address=original.resolve.apply(this,args);if(event)event.operands.push({address,snapshot:this.peek(address)});return address;};
 const touch=function(address,actor){const before=shadow.get(address),after=before?this.peek(address):null,previousOwner=this.owner[address];original.touch.call(this,address,actor);if(before){shadow.set(address,after);const changed=fields.filter(f=>before[f]!==after[f]);if(event&&changed.length)event.critical.push({address,before,after,previousOwner,changedFields:changed,cells:critical.get(address)});}if(event)event.writes.push(address);};
 vm[active]=true;vm.resolve=resolve;vm.touch=touch;
 function dispose(){if(disposed)return;disposed=true;for(const k of ['resolve','touch']){if(owned[k])vm[k]=original[k];else delete vm[k];}delete vm[active];}
 return {
  before(){if(event||finished||disposed||vm.done)throw Error('Invalid family phase step order');const actor=vm.turn,q=vm.warriors[actor].queue,pc=q.buf[q.head];event={actor,pc,cycle:vm.cycle,step:vm.steps+1,instruction:vm.peek(pc),operands:[],writes:[],critical:[]};},
  after(){if(!event||vm.steps!==event.step)throw Error('Family phases need exactly one step');const e=event;event=null;
   if(e.actor!==warrior)enemyExec[e.pc]=e.cycle;
   if(e.actor===warrior){
    const i=e.instruction,relative=norm(e.pc-base),preBoot=report.firstHealthyBoot===null,destination=e.operands[1]?.address,wrote=destination!==undefined&&e.writes.includes(destination),moving=i.op==='MOV'&&i.mod==='I'&&wrote;
    if(e.pc===boot){point('firstBootReached',e);if(same(i,w.instructions[index(spec.bootLabel)]))point('firstHealthyBoot',e);}
    if(preBoot){if(['SEQ','SNE','SLT'].includes(i.op))count('opening-comparisons',e);if(decode.has(e.pc)){point('firstResponse',e);count('response-instructions',e);}if(attacks.has(e.pc)&&moving){count('opening-attack-writes',e,destination);if(report.openingTargets.length<16)report.openingTargets.push({cycle:e.cycle,target:destination,before:e.operands[1].snapshot,payload:e.operands[0].snapshot,insideLoadedEnemy:vm.warriors.some((other,k)=>k!==warrior&&norm(destination-other.position)<other.original.length),recentEnemyExecution:e.cycle-enemyExec[destination]<=1000});}}
    if(e.pc===stone){point('firstStoneReached',e);if(same(i,w.instructions[stoneSource],['a','b']))point('firstHealthyStone',e);}
    if(e.pc===pump){point('firstPumpReached',e);if(same(i,w.instructions[pumpSource],['a','b']))point('firstHealthyPump',e);}
    if(norm(e.pc-pump)<4){count('pump-region-instructions',e);if(e.pc===norm(pump+3))count('launch-control-instructions',e);}
    if(imp(i)){point('firstCompatibleImp',e);count('compatible-imp-executions',e);}
    if(e.pc===norm(pump+1)||e.pc===norm(pump+2)){if(moving&&imp(e.operands[0].snapshot))count('compatible-pump-copies',e,destination);}
    if(e.pc===norm(stone+1)&&moving&&same(i,w.instructions[stoneSource+1],['a','b'])){count('stone-trail-writes',e,destination);if(destination===norm(stone+4)&&e.operands[0].address===stone&&e.operands[0].snapshot.op==='SPL'){handoff=true;point('naturalHandoff',e);}}
    if(e.pc===norm(stone+2)&&moving&&same(i,w.instructions[stoneSource+2])&&same(e.operands[0].snapshot,w.instructions[stoneSource+7]))count('stone-bomb-writes',e,destination);
    if(e.pc===norm(stone+5)&&moving&&same(i,w.instructions[stoneSource+5],['b'])&&same(e.operands[0].snapshot,w.instructions[stoneSource+7])&&same(vm.peek(norm(stone+6)),w.instructions[stoneSource+6],['b']))count('healthy-clear-writes',e,destination);
    if(relative<w.instructions.length)count('original-image-instructions',e);
   }
   for(const c of e.critical){for(const cell of c.cells){const detail={cycle:e.cycle,pc:e.pc,actor:e.actor,address:c.address,kind:cell.kind,index:cell.index,changedFields:c.changedFields,instruction:c.after};if(report.criticalChanges.length<32)report.criticalChanges.push(detail);
    if(e.actor!==warrior){if(cell.kind.startsWith('source-'))report.firstEnemySourceChange??=detail;else report.firstEnemyRuntimeChange??=detail;}
    if(cell.kind==='stone'){const k=cell.index,ignore=[0,1,4].includes(k)?['a','b']:[5,6].includes(k)?['b']:[],expected=k===4&&handoff?w.instructions[stoneSource]:cell.original;if(!same(c.after,expected,ignore)){report.firstStoneSignatureFault??=detail;trace('stone-signature-change',e,{address:c.address,index:k});}}
    if(cell.kind==='pump'){const ignore=[0,3].includes(cell.index)?['a','b']:[];if(!same(c.after,cell.original,ignore)){report.firstPumpSignatureFault??=detail;trace('pump-signature-change',e,{address:c.address,index:cell.index});}}
   }}
  },
  finish(){if(event||finished||disposed)throw Error('Cannot finish active/completed family phases');finished=true;try{const pcs=vm.processes(warrior),lastAttack=Math.max(-1,...['opening-attack-writes','stone-trail-writes','stone-bomb-writes','healthy-clear-writes'].map(k=>work[k]?.lastCycle??-1));return {...report,timeline,cycles:vm.cycle,winner:vm.winner,endingCompatibleImps:pcs.filter(pc=>imp(vm.peek(pc))).length,endingProcesses:pcs.length,lastNormalAttackCycle:lastAttack<0?null:lastAttack,inactiveTail:lastAttack<0?vm.cycle:vm.cycle-lastAttack,lastDeath:vm.warriors[warrior].lastDeath,adapter:{...spec,sourceStoneIndex:stoneSource,sourcePumpIndex:pumpSource,template,sourceLength:w.instructions.length},scope:'Explicit frozen-source phase and instruction-compatible work signatures. Critical source/runtime writes are provenance, not isolated causes. Compatible imps and actor activity do not establish process ancestry or enemy useful work.'};}finally{dispose();}},dispose
 };
}
