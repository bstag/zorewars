// Draft: reuse the stone emitter and its existing gated clear. The loop now
// has a bounded counter; its first fall-through latches the existing SPL
// onto the loop so subsequent processes also enter the clear. The original
// A-trail can still switch earlier. No watcher process or remote reserve.
import stones from './hillstones2.js';
const stone=stones.find(x=>x.id==='armadillo-switch');
export default {
 ...stone,id:'bounded-stone',
 purpose:'The existing stone and gated clear with a bounded DJN.B counter. Counter expiry copies the existing SPL onto the counter, latching the clear phase after queued in-flight work. KEEPSTREAM0 replaces the old decrement stream and permits the original A-trail to switch first. KEEPSTREAM1 retains that stream and adds the clock as a separate instruction in the main loop. COUNT counts visits to first expiry, not VM cycles. No polling process.',
 params:{...stone.params,COUNT:[16,7999],KEEPSTREAM:[0,1]},defaults:{...stone.defaults,COUNT:288,KEEPSTREAM:0},
 emit(ctx){
  stone.emit({...ctx,ins(label,op,mod,a,b){
   if(label==='asLoop'){
    if(ctx.P.KEEPSTREAM)ctx.ins(label,op,mod,ctx.L('bsClock'),b);
    ctx.ins(ctx.P.KEEPSTREAM?'bsClock':label,'DJN','B',ctx.P.KEEPSTREAM?ctx.L('asAmov'):a,`#${ctx.P.COUNT}`);
    ctx.ins('bsLatch','MOV','I',ctx.L('asInc'),ctx.L(ctx.P.KEEPSTREAM?'bsClock':'asLoop'));
   }else ctx.ins(label,op,mod,a,b);
  }});
 },
 watch(api){
  const {vm,P}=api,loop=api.at(P.KEEPSTREAM?'bsClock':'asLoop'),cmov=api.at('asCmov');
  let entered=false,loops=0,switched=false,writes=0,expired=false;
  return {
   before(pc){
    if(pc===api.entry())entered=true;
    if(!entered)return null;
    if(vm.peek(loop).op==='SPL')switched=true;
    if(pc===loop&&vm.peek(loop).op==='DJN'){
     const i=vm.peek(loop),remaining=api.norm(P.COUNT-loops);
     if(i.mod!=='B'||i.bMode!=='#'||api.norm(i.b)!==remaining)throw Error(`bounded-stone: invalid counter (${i.b}, expected ${remaining})`);
     if(remaining===1)expired=true;
     loops++;
    }
    // Expiry and the MOV latch are consecutive instructions of one process.
    // Other queued processes may visit the DJN between those turns, wrapping
    // its counter below zero. Remember the actual expiry event rather than
    // incorrectly requiring the shared counter to remain zero until the MOV.
    if(pc===api.at('bsLatch')&&vm.peek(loop).op!=='SPL'&&!expired)throw Error('bounded-stone: premature latch');
    if(pc===cmov&&api.same(vm.peek(cmov),api.code('asCmov'))){
     const gate=api.norm(cmov+vm.peek(cmov).b),target=api.norm(gate+vm.peek(gate).b);
     if(api.inSelf(target))throw Error('bounded-stone: clear targeted its own code');
     return {target,bomb:vm.peek(api.at('asBomb'))};
    }
    return null;
   },
   after(tok){if(tok){if(tok.bomb.op!=='DAT'||vm.writerPc[tok.target]!==cmov||!api.same(vm.peek(tok.target),tok.bomb))throw Error(`bounded-stone: invalid clear write at ${vm.cycle} (${api.scenario}), bomb ${JSON.stringify(tok.bomb)}`);writes++;}},
   final(){if(!entered)return;if(!switched||writes<100)throw Error(`bounded-stone: ineffective handoff (${loops} visits, ${writes} writes, switched ${switched})`);}
  };
 }
};
