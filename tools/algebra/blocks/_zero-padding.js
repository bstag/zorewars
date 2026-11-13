// Draft data for controlled layout experiments. Match initially empty core
// exactly; DAT #1,#1 decoys are not an equivalent pad for a rounded boot.
export default {
 id:'zero-padding',kind:'data',exit:'data',processes:0,writes:'sparse',
 purpose:'COUNT explicitly loaded DAT.F $0,$0 cells, matching initially empty core. Never intentionally executed. Useful for keeping rounded copy tails from borrowing a following decoy block.',
 params:{COUNT:[1,32]},defaults:{COUNT:3},
 emit(ctx){for(let i=0;i<ctx.P.COUNT;i++)ctx.ins(i?'':'zStart','DAT','F','0','0');}
};
