// Diagnostic variants of the retained A-indirect stream. Not promoted defaults.
// Enable with ALGEBRA_DRAFTS=_field-stream.js,_compact-pump.js.
import stones from './hillstones2.js';
const base=stones.find(b=>b.id==='armadillo-switch');
export default ['A','B'].map(field=>({
 ...base,id:'field-stream-'+field.toLowerCase(),
 purpose:`Diagnostic ${field}-only DJN stream. Isolate field arithmetic while retaining the original fan boot, stone, clear and insurance. Modifier also changes DJN's branch condition; it is not equivalent to a one-contact host restoration.`,
 defaults:{...base.defaults,STREAM:1},
 knowledge:{...base.knowledge,failures:[...base.knowledge.failures,'This modifier is an experimental field-isolation control, not a validated competitive improvement.',`The retained assembly with ${field}-only stream passed full phase verification but lost on both fresh 12-round full-field screens (1099 opponents); pooled loss was ${field==='A'?'1.91':'2.29'} percent. This rejects the tested replacement, not all single-field streams.`],tuning:[...base.knowledge.tuning,'DJN modifier changes both decremented fields and zero-test semantics. Verify full purpose before measuring field strength.'],evidence:[...base.knowledge.evidence]},
 mismatches(P,settings){return [...base.mismatches(P,settings),...(P.STREAM!==1?['field-stream draft requires STREAM1']:[])];},
 emit(ctx){base.emit({...ctx,ins(label,op,mod,...operands){ctx.ins(label,op,label==='asLoop'?field:mod,...operands);}});}
}));
