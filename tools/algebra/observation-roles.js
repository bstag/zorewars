// Role-specific adapters for the read-only observation interface. No VM writes,
// no registry imports, and no assumptions that every block promises a clear.
const moving=(api,e,label,ignore=[])=>api.matches(e,label,ignore)&&e.instruction.op==='MOV'&&e.instruction.mod==='I'&&e.operands.length===2&&api.wrote(e,e.operands[1].address);
const compatible=(i,t,core)=>i.op==='MOV'&&i.mod==='I'&&i.aMode===t.aMode&&i.bMode==='$'&&(i.b-t.b)%core===0&&(t.aMode==='#'||i.a%core===0);

// SPL with immediate A and side-effect-free immediate/direct B always splits
// at its own PC; neither numeric operand affects that operation. Keep modes
// structural, and keep the carpet and increment arithmetic strict.
export function compactPumpCellCompatible(actual,original,index,core){
 const ignored=index===3||index===0&&original.op==='SPL'&&original.aMode==='#'&&['#','$'].includes(original.bMode)?['a','b']:[];
 return ['op','mod','aMode','bMode','a','b'].every(f=>ignored.includes(f)||(['a','b'].includes(f)?(actual[f]-original[f])%core===0:actual[f]===original[f]));
}

export function observeArmadillo(api){
 let handoff=false;
 const critical=[['asInc',['a','b']],['asAmov',['a','b']],['asBmov',[]],['asAdd',[]],['asLoop',['a','b']],['asCmov',['b']],['asCdjn',['b']],['asBomb',[]]];
 const matchesCell=(label,ignore)=>api.same(api.peek(api.at(label)),api.original(label==='asLoop'&&handoff?'asInc':label),ignore);
 return {
  after(e){if(!api.entered())return;
   if(moving(api,e,'asAmov',['a','b'])){
    api.work('trail-writes',{target:e.operands[1].address});api.phase('bombing');
    if(e.operands[1].address===api.at('asLoop')&&e.operands[0].address===api.at('asInc')&&e.operands[0].snapshot.op==='SPL'){handoff=true;api.phase('handoff');}
   }
   if(moving(api,e,'asBmov')&&api.same(e.operands[0].snapshot,api.original('asBomb')))api.work('bomb-writes',{target:e.operands[1].address});
   if(moving(api,e,'asCmov',['b'])&&api.same(e.operands[0].snapshot,api.original('asBomb'))){const target=e.operands[1].address;
    if(api.inSelf(target)){api.work('self-clear-writes',{target});api.fault('self-clear-write',target);}else{api.work('clear-writes',{target});api.phase('clearing');}
   }
   for(const [label,ignore]of critical)if(!matchesCell(label,ignore)){api.fault('structural-change',api.at(label),{cell:label});break;}
  },
  finish(){const writer=matchesCell('asCmov',['b']),loop=matchesCell('asCdjn',['b']),bomb=matchesCell('asBomb',[]),pcs=api.processes();
   const running=writer&&loop&&bomb?pcs.filter(pc=>pc===api.at('asCmov')||pc===api.at('asCdjn')||(handoff&&pc===api.at('asLoop'))).length:0;
   return {handoffObserved:handoff,clearWriterIntact:writer,clearLoopIntact:loop,clearBombIntact:bomb,healthyClearProcesses:running};}
 };
}
export function verifyArmadillo(r){const issues=[],minimum=r.phaseContract?.minimumClearWrites??100;if(r.phaseContract?.requiresNaturalHandoff!==false&&!r.handoffObserved)issues.push('natural stone-to-clear handoff was not observed');if((r.work['clear-writes']?.count??0)<minimum)issues.push(`fewer than${minimum} healthy clear writes`);if(r.work['self-clear-writes']?.count)issues.push('clear wrote into its own active block');if(r.phaseContract?.requiresHealthyClearProcessAtEnd!==false&&!r.healthyClearProcesses)issues.push('no healthy clear process remains at the full horizon');return issues;}

export function observeCompactPump(api){
 const template=api.original('pImp'),headAt=api.norm(api.at('pFeed')+4+api.P.LEAD),bankAt=api.norm(api.at('pFeed')+api.P.SOURCE),external=[1,2,4,5].includes(api.P.SEED),privateSource=api.P.SEED===4,templateAt=privateSource?bankAt:external?headAt:api.at('pImp'),intact=()=>Array.from({length:4},(_,i)=>compactPumpCellCompatible(api.peek(api.at('pFeed',i)),api.original('pFeed',i),i,api.core)).every(Boolean);let firstTemplateChange=null,firstStrideDamage=null,firstSeedWrite=null,firstSeedStrideDamage=null,firstSourceWrite=null;
 return {
  before(e){if(!api.entered())return;
   if(api.matches(e,'pJump',['a','b'])&&intact()){api.work('launch-attempts');api.phase('launching');}
   if(api.own(e)&&!api.inSelf(e.pc)&&compatible(e.instruction,template,api.core)){api.work('compatible-imp-executions');api.phase('imp-running');}
  },
  after(e){
   if(api.P.SEED&&!api.entered()&&api.own(e)&&e.instruction.op==='MOV'&&e.instruction.mod==='I'&&e.operands[1]?.address===headAt&&api.wrote(e,headAt)&&compatible(e.operands[0].snapshot,template,api.core)){firstSeedWrite??={cycle:e.cycle,address:headAt,source:e.operands[0].address};api.work('preseed-writes',{target:headAt});api.phase('seeded');}
   if(api.P.SEED>=4&&!api.entered()&&api.own(e)&&e.instruction.op==='MOV'&&e.instruction.mod==='I'&&e.operands[1]?.address===bankAt&&api.wrote(e,bankAt)&&compatible(e.operands[0].snapshot,template,api.core)){firstSourceWrite??={cycle:e.cycle,address:bankAt,source:e.operands[0].address};api.work('source-initializations',{target:bankAt});}
   if(firstSeedWrite&&!compatible(api.peek(headAt),template,api.core))firstSeedStrideDamage??={cycle:e.cycle,address:headAt,instruction:api.peek(headAt),...api.provenance(headAt)};
   if(!api.entered()){if(external&&(privateSource?firstSourceWrite:firstSeedWrite)){const actual=api.peek(templateAt);if(!api.same(actual,template))firstTemplateChange??={cycle:e.cycle,address:templateAt,instruction:actual,...api.provenance(templateAt)};if(!compatible(actual,template,api.core))firstStrideDamage??={cycle:e.cycle,address:templateAt,instruction:actual,...api.provenance(templateAt)};}return;}
   if(moving(api,e,'pCarpet')){const source=e.operands[0].snapshot;api.work('carpet-writes',{target:e.operands[1].address});if(compatible(source,template,api.core))api.work('compatible-imp-copies');else api.work('other-carpet-copies');}
   if(!intact()){
    const bad=Array.from({length:4},(_,i)=>i).find(i=>!compactPumpCellCompatible(api.peek(api.at('pFeed',i)),api.original('pFeed',i),i,api.core));api.fault('structural-change',api.at('pFeed',bad));
    const f=api.firstFault(),friendly=f.owner===api.warrior&&f.writerPc>=0&&!api.inSelf(f.writerPc);
    if(api.P.RETIRE&&friendly&&api.workCount('launch-attempts')>=2*api.P.N)api.phase('retired',{cause:'friendly-external'});else api.phase('disabled');
   }
   const actual=api.peek(templateAt);if(!api.same(actual,template))firstTemplateChange??={cycle:e.cycle,address:templateAt,instruction:actual,...api.provenance(templateAt)};
   if(!compatible(actual,template,api.core))firstStrideDamage??={cycle:e.cycle,address:templateAt,instruction:actual,...api.provenance(templateAt)};
  },
  finish(){return {activePumpIntact:intact(),compatibleImpProcesses:api.processes().filter(pc=>compatible(api.peek(pc),template,api.core)).length,compatibilityScope:'Instruction compatibility, not process ancestry.',carpetSource:privateSource?'separate template bank':external?'separately seeded head':'local template',carpetSourceAddress:templateAt,sourceBankAddress:api.P.SEED>=4?bankAt:null,firstSourceWrite,firstSeedWrite,firstSeedStrideDamage,firstTemplateChange,firstStrideDamage};}
 };
}
export function verifyCompactPump(r){const issues=[];if(r.parameters.SEED&&!r.firstSeedWrite)issues.push('no compatible seed initialization before pump entry');if(r.parameters.SEED>=4&&!r.firstSourceWrite)issues.push('no compatible template-bank initialization before pump entry');if((r.work['launch-attempts']?.count??0)<2*r.parameters.N)issues.push('insufficient intact launch attempts');if(!r.phases['imp-running'])issues.push('no compatible imp execution observed');if(r.compatibleImpProcesses<r.parameters.N)issues.push('too few compatible imp processes survive');if(!r.activePumpIntact&&!r.phases.retired)issues.push('pump disabled without permitted friendly retirement');return issues;}

export function observeMulQuickscan(api){let released=false;const addresses=new Set();return {
 before(e){if(!api.entered()||!api.own(e)||released)return;if(!api.inSelf(e.pc)){released=true;api.phase('released',{probeValue:api.peek(api.at('probe')).b});return;}api.phase('scanning');},
 after(e){if(released||!api.entered()||!api.own(e))return;const offset=api.rel(e.pc,api.at('qScan'));if(offset>=3*api.P.UNITS||!['SEQ','SNE'].includes(e.instruction.op))return;const original=api.originalAt(e.pc);if(!original||!api.same(e.instruction,original))return;for(const o of e.operands)if(!api.inLoadedImage(o.address)){addresses.add(o.address);api.work('probe-reads',{target:o.address});}},
 finish(){return {probeAddresses:[...addresses].sort((a,b)=>a-b),uniqueProbeAddresses:addresses.size};}
};}
export function observeBurst(api){let released=false;return {
 before(e){if(api.entered()&&api.own(e)&&!released&&!api.inSelf(e.pc)){released=true;api.phase('released');}},
 after(e){if(released||!api.entered())return;for(const [label,ignore]of [['loop',[]],['ptr',['b']]])if(moving(api,e,label,ignore)&&api.same(e.operands[0].snapshot,api.original('bomb'))){api.work('bomb-writes',{target:e.operands[1].address});api.phase('bombing');}}
};}
