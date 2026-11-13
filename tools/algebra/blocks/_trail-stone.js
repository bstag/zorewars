// Source-inspired mechanism experiment; the shared stone emitter is reused.
import stones from './hillstones2.js';
const stone=stones.find(b=>b.id==='armadillo-switch');
export default {
 ...stone,id:'trail-stone',
 purpose:'Armadillo stone/clear with the Tolypeutes-style A-indirect DJN stream operand *-3. Same eight-cell shape, self-copy handoff and clear; numerical geometry and companion coordination still require verification.',
 knowledge:{...stone.knowledge,status:'draft addressing variation',tuning:['Compare addressing alone before combining STEP2090/HOP46 or a three-point pump.','Resolve and preserve actual stone/pump destinations when source layout changes.','A-indirect stream addressing changes side effects; passing intrinsic launch arithmetic and full phase checks remains mandatory.'],evidence:[]},
 emit(ctx){stone.emit({...ctx,ins(label,op,mod,a,b){ctx.ins(label,op,mod,a,label==='asLoop'?'*-3':b);}});}
};
