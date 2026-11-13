// Draft, fixed-layout recovery experiment. Enable explicitly; no hill promotion.
import stones from './hillstones2.js';
import {observeArmadillo,verifyArmadillo} from '../observation-roles.js';
const stone=stones.find(b=>b.id==='armadillo-switch');
const zero={op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0};
const stun={op:'SPL',mod:'B',aMode:'#',a:1,bMode:'#',b:1};
const targets=['asCmov','asCdjn','asBomb','asBmov'];
function observeRecovery(api){const base=observeArmadillo(api);let attempts=0,spawns=0,firstAttempt=null,firstSpawn=null,pending=null;
 return {before(e){base.before?.(e);if(api.matches(e,'rSpawn')){attempts++;firstAttempt??=e.cycle;pending=api.processes().length;api.work('recovery-attempts');api.phase('recovery');}},
 after(e){base.after?.(e);if(pending!==null){if(api.processes().length>pending){spawns++;firstSpawn??=e.cycle;api.work('recovery-spawns');api.phase('recovery-spawned');}pending=null;}
 if(firstAttempt!==null&&api.matches(e,'asCmov',['b'])&&e.operands[1]&&api.wrote(e,e.operands[1].address)&&api.same(e.operands[0].snapshot,api.original('asBomb'))&&!api.inSelf(e.operands[1].address))api.work('post-repair-clear-writes',{target:e.operands[1].address});},
 finish(){return {...base.finish(),recoveryAttempts:attempts,recoverySpawns:spawns,firstRecoveryAttempt:firstAttempt,firstRecoverySpawn:firstSpawn,recoveryScope:'SPL attempts and actual queue additions are distinct. Post-repair writes may be executed by old surviving processes; no process ancestry is claimed.'};}};
}
export default {
 ...stone,id:'recovering-stone',entry:'rEntry',processes:9,
 purpose:'Draft stone with independently growing watchers inside its clear-protected gap. Each entry starts a stone worker and watcher feeder. Checks four immutable stone/clear instructions; stops the damaged stone, restores the clear and bomb writer, resets the gate past protected code and spawns a fresh clear process. Does not detect every mutable control-field fault or protect watchers from enemy wipes.',
 params:{STEP:[3480,3480],HOP:[48,48],BYPASS:[0,1],FAULT:[0,3],AT:[200,70000],STUN:[0,1]},
 defaults:{STEP:3480,HOP:48,BYPASS:0,FAULT:0,AT:6000,STUN:1},
 observationRole:'recovering-stone-clear',observe:observeRecovery,
 phaseContract:{minimumClearWrites:100,requiresHealthyClearProcessAtEnd:true,recovery:'actual reset and a fresh entry, not merely restored bytes'},
 verifyObservation(r){const issues=verifyArmadillo({...r,phaseContract:{...r.phaseContract,requiresNaturalHandoff:!r.recoveryAttempts}});if(r.recoveryAttempts&&(r.work['post-repair-clear-writes']?.count??0)<100)issues.push('recovery did not produce 100 healthy clear writes');if(r.recoveryAttempts&&!r.recoverySpawns)issues.push('no fresh clear process was admitted after repair');return issues;},
 knowledge:{status:'standalone full verification passed; tested stone/imp composition rejected',parameterRoles:{STEP:'fixed stone lattice',HOP:'fixed clear exclusion interval',BYPASS:'same layout and watcher cost; suppress detection',FAULT:'verification injection cell; no emission change',AT:'verification injection cycle; no emission change',STUN:'verification injection opcode; no emission change'},
 tuningGroups:[{name:'recovery-placement-and-schedule',parameters:['STEP','HOP','body layout','parent.HOPA','parent.HOPB','pump.LEAD','watcher process allocation'],requires:'relink physical addresses; check direct writes, indirect pointer mutations, exact live launch arithmetic, fault latency and companion survival'}],
 tuning:['The supported profile is fixed; changing STEP/HOP or body size requires a new layout proof and full dynamic verification.','A larger gcd can clear the local code footprint but reduce bombing coverage: this profile visits200 DAT-bomb targets instead of the retained stone\'s800.','Keeping the first imp seed fixed does not preserve the active jump pointer or queue timing.','Use a disabled-recovery control to price code size, copying and growing watchers separately from the reaction.','Fault time/cell/opcode are verification controls, not strength genes.'],
 invariants:['Each entrant creates a growing watcher feeder and continues into the stone; parent allocation still determines stone worker count.','Natural handoff changes the loop and is not watched as corruption.','Recovery restores the clear state and creates a process; templates alone do not restart execution.','Reset the external gate to HOP+1, not zero: queued old clear processes can otherwise advance it into protected code.','STEP3480 on core8000 gives a40-cell lattice; HOP48 puts two write lanes at relative35/36 beyond this31-cell body.','Four immutable signatures are watched; mutable pointers and normal handoff are not compared to initial code.'],
 limitations:['Only the four immutable instruction signatures are checked; damage to asAdd/asLoop alone need not trigger repair.','No promise to survive a carpet covering the watchers/templates, or boot damage.','External-gate corruption may self-hit before polling detects damaged clear instructions.','A resumed clear can destroy compatible imps; companion phase contracts must still pass.','Growing watchers cost turns, source footprint and process slots; a sparse stone lattice also changes strength.','Repair SPL execution is an attempt; confirm actual queue growth before claiming a fresh process. Post-repair work is not process ancestry.'],
 experiments:{date:'2026-11-03',faults:{tested:50,phasePasses:32,baselinePhasePasses:15},admission:{proposals:92,admitted:0},field:{scope:'rejected diagnostic, not an admitted candidate',opponents:1099,roundsPerOpponent:12,changePercent:-31.211186867590225},decision:'retain draft as scoped mechanism, reject warrior replacement'},evidence:[]},
 mutable:stone.mutable,
 mismatches(P,settings){return [...stone.mismatches(P,settings),...(settings.coreSize!==8000||P.STEP!==3480||P.HOP!==48?['recovering-stone: this draft requires core8000, STEP3480 and HOP48; other layouts are not verified']:[])];},
 emit(ctx){const {L,P}=ctx,ins=ctx.ins.bind(ctx);
  ins('rEntry','SPL','B',L('rWatchFeed'),'0');
  stone.emit({...ctx,ins});
  ins('rRepair','MOV','I',L('rRefBomb'),L('asAmov'));
  ins(null,'MOV','I',L('rRefBomb'),L('asInc'));
  ins(null,'MOV','I',L('rRefMov'),L('asCmov'));
  ins(null,'MOV','I',L('rRefDjn'),L('asCdjn'));
  ins(null,'MOV','I',L('rRefBomb'),L('asBomb'));
  ins(null,'MOV','AB',`#${P.HOP+1}`,`${L('asInc')}-6`);
  ins(null,'MOV','I',L('rRefBmov'),L('asBmov'));
  ins('rSpawn','SPL','B',L('asCmov'),'0');
  ins('rWatchFeed','SPL','B','#0','0');
  ins('rStoneWatch','SEQ','I',L('asBmov'),L('rRefBmov'));
  ins(null,'JMP','B',P.BYPASS?L('rClearWatch'):L('rRepair'),'0');
  ins('rClearWatch','SEQ','I',L('asCmov'),L('rRefMov'));
  ins(null,'JMP','B',P.BYPASS?L('rLoopWatch'):L('rRepair'),'0');
  ins('rLoopWatch','SEQ','I',L('asCdjn'),L('rRefDjn'));
  ins(null,'JMP','B',P.BYPASS?L('rBombWatch'):L('rRepair'),'0');
  ins('rBombWatch','SEQ','I',L('asBomb'),L('rRefBomb'));
  ins(null,'JMP','B',P.BYPASS?L('rLap'):L('rRepair'),'0');
  ins('rLap','JMP','B',L('rStoneWatch'),'0');
  // These are *destination* instruction values, not references relative to
  // the template's source position. MOV.I copies the exact working encoding.
  ins('rRefMov','MOV','I','2','>-11');
  ins('rRefDjn','DJN','F','-1','>-12');
  ins('rRefBomb','DAT','F','<1',`${P.HOP+1}`);
  ins('rRefBmov','MOV','I','5','@-1');
 },
 plant(api){return api.P.BYPASS?[]:[[api.at(targets[api.P.FAULT]),api.P.STUN?stun:zero,api.P.AT]];},
 watch(api){let entered=false,reentries=0,afterWrites=0,lastWrite=null;const planted=api.scenario==='recovering-stone: planted target';
  return {before(pc){if(pc===api.entry())entered=true;if(!entered)return null;if(pc===api.at('rSpawn')&&api.same(api.vm.peek(pc),api.code('rSpawn')))reentries++;
   if(pc===api.at('asCmov')&&api.same(api.vm.peek(pc),api.code('asCmov'))){const gate=api.norm(pc+api.vm.peek(pc).b),target=api.norm(gate+api.vm.peek(gate).b);if(api.inSelf(target))throw Error('recovering-stone: clear targets protected recovery code');return {target,pc,cycle:api.vm.cycle,bomb:api.vm.peek(api.at('asBomb'))};}return null;},
   after(e){if(!e||e.bomb.op!=='DAT'||!api.same(api.vm.peek(e.target),e.bomb)||api.vm.writerPc[e.target]!==e.pc)return;if(e.cycle>=api.P.AT&&reentries){afterWrites++;lastWrite=api.vm.cycle;}},
   final(){if(!entered)return;if(!planted&&reentries)throw Error(`recovering-stone: false recovery without injected damage (${reentries})`);if(planted&&!api.P.BYPASS&&(!reentries||afterWrites<100||lastWrite<api.vm.cycle-1000))throw Error(`recovering-stone: recovery not persistent (${reentries}, ${afterWrites}, last ${lastWrite})`);}
  };
 }
};
