// Draft experiment: enable alongside _compact-pump.js. This composes the
// existing stone emitter with a one-process remote watchdog/clear. It needs
// exactly three entry processes (fanboot N4, SPLIT1). No global gate changes.
import stones from './hillstones2.js';
const stone=stones.find(x=>x.id==='armadillo-switch');
const remote=['rWatch','rAgain','rStopA','rStopB','rStopPump','rClear','rCount','rKill','rTick','rLap','rBomb','rRef','rPtr'];
const zero={op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0};
export default {
 id:'stone-reserve',kind:'body',exit:'never',writes:'core',roams:false,grows:true,processes:9,dialects:'94',
 purpose:'Experimental early fallback: the unchanged eight-cell stone, with three entrants split into three stone processes and one independent watchdog. Boots a thirteen-cell counted backward clear RESERVE cells away; damage to the main clear MOV stops the old stone feeder, bomber and imp feeder, then starts the reserve clear. Requires exactly three entry processes, as fanboot N4 SPLIT1 supplies. Friendly imps and the primary clear can retire the reserve; no late recovery is promised.',
 params:{...stone.params,RESERVE:[256,7400],PUMPDIST:[256,7744]},defaults:{...stone.defaults,RESERVE:2000,PUMPDIST:645},entry:'rsStart',
 provides:{datBomb:'asBomb'},
 mutable:[...stone.mutable,['rsStart',['b']]],
 emit(ctx){
  const {L,P}=ctx;stone.emit(ctx);
  // First two entrants go directly to the stone. The last also starts a
  // stone process, then alone copies and runs the independent reserve.
  ctx.ins('rsStart','DJN','B',L('asInc'),'#3');
  ctx.ins(null,'SPL','B',L('asInc'),'0');
  for(let i=0;i<remote.length;i++)ctx.ins(i===0?'rsBoot':null,'MOV','I',L(remote[i]),`${L(remote[i])}+${P.RESERVE}`);
  ctx.ins(null,'JMP','B',`${L('rWatch')}+${P.RESERVE}`,'0');
  ctx.ins('rWatch','SNE','I',L('rRef'),`*${L('rPtr')}`);
  ctx.ins('rAgain','JMP','B',L('rWatch'),'0');
  // A triggered replacement must stop the old bomber from destroying it.
  ctx.ins('rStopA','MOV','I',L('rBomb'),`${L('asInc')}-${P.RESERVE}`);
  ctx.ins('rStopB','MOV','I',L('rBomb'),`${L('asAmov')}-${P.RESERVE}`);
  ctx.ins('rStopPump','MOV','I',L('rBomb'),`${L('asInc')}+${P.PUMPDIST}-${P.RESERVE}`);
  // The original stone's clear MOV has these position-independent fields.
  // Once triggered this reference cell becomes the clear's lap counter.
  ctx.ins('rClear','MOV','AB',`#(${L('rWatch')}-${L('rPtr')})`,L('rPtr'));
  ctx.ins('rCount','MOV','AB',`#(CORESIZE-${remote.length})`,L('rRef'));
  ctx.ins('rKill','MOV','I',L('rBomb'),`<${L('rPtr')}`);
  ctx.ins('rTick','DJN','B',L('rKill'),L('rRef'));
  ctx.ins('rLap','JMP','B',L('rClear'),'0');
  ctx.ins('rBomb','DAT','F','#0','#1');
  ctx.ins('rRef','MOV','I','2','>-11');
  ctx.ins('rPtr','DAT','F',`${L('asCmov')}-${L('rPtr')}-${P.RESERVE}`,'#0');
 },
 plant(api){return [[api.at('asCmov'),zero,1000]];},
 running(api){return api.vm.processes(0).some(pc=>api.inSelf(pc)||api.norm(pc-api.at('rWatch')-api.P.RESERVE)<remote.length);},
 watch(api){
  const {vm,P}=api,at=l=>api.norm(api.at(l)+P.RESERVE),start=at('rWatch'),end=at('rPtr');
  let booted=false,entrants=0,triggered=null,writes=0,firstWrite=null,lastWrite=null;
  const planted=api.scenario==='stone-reserve: planted target';
  return {
   before(pc){
    if(pc===api.entry()&&!booted)entrants++;
    if(pc===start&&!booted){
     if(entrants!==3)throw Error(`stone-reserve: needs three entry processes, saw ${entrants}`);
     for(const l of remote)if(!api.same(vm.peek(at(l)),api.code(l)))throw Error(`stone-reserve: remote ${l} copy was damaged before entry at ${vm.cycle} (${api.scenario})`);
     if(api.norm(at('rPtr')+vm.peek(at('rPtr')).a)!==api.at('asCmov'))throw Error('stone-reserve: watcher points at the wrong clear');
     const feed=vm.peek(api.norm(api.at('asInc')+P.PUMPDIST));
     if(feed.op!=='SPL'||feed.mod!=='B'||feed.aMode!=='#'||feed.a!==0||feed.bMode!=='$'||feed.b!==0)throw Error('stone-reserve: PUMPDIST does not identify the compact imp feeder');
     booted=true;
    }
    if(pc===at('rClear')&&api.same(vm.peek(pc),api.code('rClear'))&&triggered===null)triggered=vm.cycle;
    if(pc===at('rKill')&&api.same(vm.peek(pc),api.code('rKill'))){
     const target=api.norm(at('rPtr')+vm.peek(at('rPtr')).b-1);
     if(api.norm(target-start)<remote.length)throw Error('stone-reserve: clear targeted its own reserve');
     return {target,pc};
    }
    return null;
   },
   after(tok){if(!tok)return;if(!api.same(vm.peek(tok.target),api.code('rBomb'))||vm.writerPc[tok.target]!==tok.pc)throw Error(`stone-reserve: missing clear write at ${vm.cycle}, target ${tok.target}, bomb ${JSON.stringify(vm.peek(at('rBomb')))} (${api.scenario})`);writes++;firstWrite??=vm.cycle;lastWrite=vm.cycle;},
   final(){
    if(!booted)throw Error('stone-reserve: independent watchdog was never booted (requires three entrants)');
    if(planted&&(triggered===null||triggered<1000||triggered>3000||writes<100))throw Error(`stone-reserve: damage did not start an effective fallback (${triggered}, ${writes} writes)`);
    void firstWrite;void lastWrite;void end;
   }
  };
 }
};
