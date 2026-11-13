// An independently booted *primary* clear, not damage detection or repair.
import stones from './hillstones2.js';
import {observeArmadillo} from '../observation-roles.js';
const stone=stones.find(b=>b.id==='armadillo-switch');
const primaryLabels=api=>api.P.FEEDERS===2?['pFeed','pSecond','pMov','pDjn']:['pFeed','pMov','pDjn'];
const primaryIgnore=label=>['pFeed','pSecond'].includes(label)?['a','b']:[];
const remote=(api,label)=>{
 const d=api.P.DIST?api.norm(api.at('asInc')+api.P.DIST-api.at('pFeed')):0;
 return api.norm(api.at(label)+d);
};
function observePrimary(api){const old=observeArmadillo(api),at=l=>remote(api,l),labels=primaryLabels(api),live=a=>api.inSelf(a)||api.rel(a,at('pFeed'))<labels.length;let started=false,firstPrimaryFault=null;
 return {before(e){if(api.own(e)&&e.pc===at('pFeed')){started=true;api.phase('primary-started');}},
 after(e){old.after?.(e);if(started&&!firstPrimaryFault)for(const label of labels)if(!api.same(api.peek(at(label)),api.original(label),primaryIgnore(label))){firstPrimaryFault={cycle:e.cycle,cell:label,address:at(label),instruction:api.peek(at(label)),...api.provenance(at(label))};break;}
 if(!api.entered()||!api.own(e)||e.pc!==at('pMov')||!api.same(e.instruction,api.original('pMov'))||e.operands.length!==2||!api.wrote(e,e.operands[1].address)||!api.same(e.operands[0].snapshot,api.original('asBomb')))return;
  const target=e.operands[1].address;if(live(target)){api.work('primary-self-writes',{target});api.fault('primary-self-write',target);}else{api.work('primary-clear-writes',{target});api.phase('primary-clearing');}},
 finish(){const intact=labels.every(l=>api.same(api.peek(at(l)),api.original(l),primaryIgnore(l))),bombIntact=api.same(api.peek(api.at('asBomb')),api.original('asBomb'));return {...old.finish(),primaryEntry:at('pFeed'),primaryCodeIntact:intact,primaryBombIntact:bombIntact,firstPrimaryFault,primaryProcesses:intact&&bombIntact?api.processes().filter(p=>api.rel(p,at('pFeed'))<labels.length).length:0};}};
}
export default {
 ...stone,id:'primary-clear-stone',entry:'pEntry',processes:12,
 purpose:'Four-entry stone with a separately started primary clear and one or two SPL feeders. The final entrant boots and starts that clear while its SPL preserves the fourth stone worker. DIST0 uses the local template as the live clear; positive DIST boots it that far beyond the stone entry. Both clear paths share a gate and protected interval. No watcher, trigger or repair.',
 params:{...stone.params,DIST:[0,160],WAIT:[0,128],FEEDERS:[1,2]},defaults:{...stone.defaults,STEP:3510,HOP:96,DIST:61,WAIT:0,FEEDERS:1},
 observationRole:'stone-with-primary-clear',observe:observePrimary,
 phaseContract:{minimumPrimaryWrites:100,requiresPrimaryProcessAtEnd:true,allocation:'exactly four entrants; four stone workers plus one primary-clear bootstrap'},
 verifyObservation(r){const issues=[];if(!r.work['bomb-writes']?.count)issues.push('stone produced no healthy DAT bomb write');if((r.work['primary-clear-writes']?.count??0)<100)issues.push('primary clear produced fewer than100 healthy writes');if(r.work['primary-self-writes']?.count||r.work['self-clear-writes']?.count)issues.push('a clear wrote into protected code');if(!r.primaryProcesses)issues.push('no healthy independent primary-clear process remains');return issues;},
 knowledge:{status:'mechanically verified draft; tested primary deployments lost field strength',parameterRoles:{STEP:'stone lattice',HOP:'stone geometry and shared clear exclusion',DIST:'actual primary entry offset from stone; zero runs template locally',WAIT:'single bootstrap DJN visits; not VM cycles',FEEDERS:'one or two primary SPL feeder cells'},
 invariants:['Exactly four body entrants are required; the fourth starts a fourth stone worker plus one clear bootstrap.','The clear is copied and started in ordinary deployment without requiring stone damage or handoff.','Both writers must skip the main block and separately booted clear.','Copy templates hold destination-relative operand encodings.'],
 tuningGroups:[{parameters:['HOP','DIST','WAIT','parent.HOPA','parent.HOPB','pump.LEAD'],requires:'check both copied spans, all actual clear targets, active launcher arithmetic and ending insurance'}],
 lessons:['Initial trail writes miss some placements that later trail laps overwrite: the handoff itself demonstrates a second write class.','The aligned one-feeder clear uses residues1/2/3; two feeders use0/1/2/3, leaving the MOV/DJN on2/3.','Numeric changes to an immediate SPL feeder do not redirect that instruction, but its fields can still be read as data by the stone.','Starting useful clearing hundreds of cycles earlier did not offset footprint and scheduling costs in the tested whole-field panel.'],
 limitations:['Shared gate and stone bomb are common dependencies; this is not independent damage immunity.','A primary clear can kill its friendly stone or imp engine.','WAIT counts visits by one bootstrap process and must be measured under the shared queue schedule.','This is a mechanism probe using our stone/pump; it does not reproduce Son of Vain\'s complete independent stone, bomb, gate and boot.'],evidence:[]},
 mutable:[...stone.mutable,['pEntry',['b']],['pWait',['b']]],
 mismatches(P,settings){return [...stone.mismatches(P,settings),...(P.DIST&&P.DIST<32?['primary-clear-stone: booted primary must be at least32 cells beyond stone']:[]),...(P.HOP<(P.DIST?P.DIST+P.FEEDERS+7:32)?['primary-clear-stone: HOP must exclude the full local and primary span']:[])];},
 emit(ctx){const {L,P}=ctx;let pc=0;const ins=(...a)=>{ctx.ins(...a);pc++;};stone.emit({...ctx,ins});
  const dest=P.DIST?`${L('asInc')}+${P.DIST}`:L('pFeed');
  ins('pEntry','DJN','B',L('asInc'),'#4');
  ins(null,'SPL','B',L('asInc'),'0');
  for(const [i,label]of primaryLabels(ctx).entries())ins(null,'MOV','I',L(label),`${dest}+${i}`);
  if(P.WAIT)ins('pWait','DJN','B',L('pWait'),`#${P.WAIT}`);
  ins(null,'JMP','B',dest,'0');
  // A-indirect reads can decrement a residue-1 feeder's numeric A field,
  // harmless for immediate SPL. Keep the actual MOV/DJN on residues2/3,
  // avoiding the later A-trail's residue4 as well as initial lanes7/8.
  while(pc%10!==(P.FEEDERS===2?0:1))ins(`pPad${pc}`,'DAT','F','#0','#0');
  ins('pFeed','SPL','B','#0','0');
  if(P.FEEDERS===2)ins('pSecond','SPL','B','#0','0');
  ins('pMov','MOV','I',`${L('asBomb')}-(${dest})-${P.FEEDERS}`,`>${L('asInc')}-6-(${dest})-${P.FEEDERS}`);
  ins('pDjn','DJN','F','-1',`>${L('asInc')}-6-(${dest})-${P.FEEDERS+1}`);
 },
 running(api){const start=remote(api,'pFeed');return api.vm.processes(0).some(p=>api.inSelf(p)||api.norm(p-start)<primaryLabels(api).length);},
 watch(api){const {vm}=api,at=l=>remote(api,l);let entrants=0,started=false,writes=0;
  return {before(pc){if(pc===api.entry())entrants++;if(pc===at('pFeed'))started=true;if(pc!==at('pMov')||!api.same(vm.peek(pc),api.code('pMov')))return null;
   const gate=api.norm(pc+vm.peek(pc).b),target=api.norm(gate+vm.peek(gate).b);if(api.inSelf(target)||api.norm(target-at('pFeed'))<primaryLabels(api).length)throw Error('primary-clear-stone: clear targets its live region');return {pc,target,bomb:vm.peek(api.at('asBomb'))};},
   after(e){if(e&&e.bomb.op==='DAT'&&api.same(vm.peek(e.target),e.bomb)&&vm.writerPc[e.target]===e.pc)writes++;},
   final(){if(entrants!==4)throw Error(`primary-clear-stone: needs four entrants, saw ${entrants}`);if(!started||writes<100)throw Error(`primary-clear-stone: no useful primary (${started}, ${writes})`);}
  };
 }
};
