// Draft: add one MOV to the existing stone's forward clear. The emitter
// retains the original self-switch and decrement stream. LAYOUT0 uses
// MOV/MOV/DJN; LAYOUT1 preserves the old bomb slot and uses MOV/DJN/MOV/JMP.
// No additional process. GAP/PAD support explicit layout experiments.
import stones from './hillstones2.js';
const stone=stones.find(x=>x.id==='armadillo-switch');
const stun={op:'SPL',mod:'B',aMode:'#',a:1,bMode:'#',b:1};
export default {
 ...stone,id:'double-clear-stone',
 purpose:'Experimental self-switching stone with two DAT writers per clear loop. WRITERS1 with PAD0 reproduces the original emitter. LAYOUT0 adds a MOV before the DJN; LAYOUT1 keeps the old bomb slot and appends a writer/return, separated by GAP DAT cells. PAD adds tail DAT cells. FAULT chooses which writer receives SPL1,1 at cycle6000 in the contract scenario, changing no emitted code. Partial stun tolerance is tested; arbitrary damage immunity is not promised. Compatible layout/constants must be verified together.',
 params:{...stone.params,WRITERS:[1,2],FAULT:[0,1],PAD:[0,3],LAYOUT:[0,1],GAP:[0,12]},defaults:{...stone.defaults,WRITERS:2,FAULT:0,PAD:0,LAYOUT:0,GAP:0},
 mutable:P=>[...stone.mutable,...(P.WRITERS===2?[['dcSecond',['b']]]:[])],
 emit(ctx){
  stone.emit({...ctx,ins(label,op,mod,a,b){
   if(label==='asCdjn'&&ctx.P.WRITERS===2){
    if(!ctx.P.LAYOUT)ctx.ins('dcSecond','MOV','I',ctx.L('asBomb'),`>${ctx.L('asInc')}-6`);
    ctx.ins(label,op,mod,ctx.L(ctx.P.LAYOUT?'dcSecond':'asCmov'),b);
   }else ctx.ins(label,op,mod,a,b);
  }});
  if(ctx.P.LAYOUT&&ctx.P.WRITERS===2){
   for(let i=0;i<ctx.P.GAP;i++)ctx.ins(`dcGap${i}`,'DAT','F','0','0');
   ctx.ins('dcSecond','MOV','I',ctx.L('asBomb'),`>${ctx.L('asInc')}-6`);
   ctx.ins('dcReturn','JMP','B',ctx.L('asCmov'),'0');
  }
  for(let i=0;i<ctx.P.PAD;i++)ctx.ins(`dcPad${i}`,'DAT','F','0','0');
 },
 plant(api){return api.P.WRITERS===2?[[api.at(api.P.FAULT?'dcSecond':'asCmov'),stun,6000]]:[];},
 watch(api){
  const {vm,P}=api,labels=P.WRITERS===2?['asCmov','dcSecond']:['asCmov'],byPc=new Map(labels.map(l=>[api.at(l),l]));
  let entered=false,switched=false,writes=0,recovery=0,lastRecovery=null;const targets=new Set(),planted=api.scenario==='double-clear-stone: planted target';
  return {
   before(pc){
    if(pc===api.entry())entered=true;if(!entered)return null;
    if(vm.peek(api.at('asLoop')).op==='SPL')switched=true;
    const label=byPc.get(pc);if(!label||!api.same(vm.peek(pc),api.code(label)))return null;
    const ins=vm.peek(pc),gate=api.norm(pc+ins.b),target=api.norm(gate+vm.peek(gate).b);
    if(api.inSelf(target))throw Error('double-clear-stone: clear targeted its own code');
    return {pc,target,bomb:vm.peek(api.at('asBomb')),cycle:vm.cycle,label};
   },
   after(tok){if(!tok)return;
    if(tok.bomb.op!=='DAT'||!api.same(vm.peek(tok.target),tok.bomb)||vm.writerPc[tok.target]!==tok.pc)throw Error(`double-clear-stone: invalid DAT write at ${vm.cycle} (${api.scenario})`);
    writes++;
    if(planted&&tok.cycle>=6000&&tok.label!==(P.FAULT?'dcSecond':'asCmov')){recovery++;lastRecovery=vm.cycle;targets.add(tok.target);}
   },
   final(){
    if(!entered)return;if(!switched||writes<100)throw Error(`double-clear-stone: no functional handoff (${switched}, ${writes})`);
    if(planted&&P.WRITERS===2&&(recovery<100||targets.size<100||lastRecovery<vm.cycle-1000))throw Error(`double-clear-stone: other writer did not sustain clearing after stun (${recovery} writes, ${targets.size} targets, last ${lastRecovery})`);
   }
  };
 }
};
