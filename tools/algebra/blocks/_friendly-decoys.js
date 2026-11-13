// Draft data: repeated unequal fields avoid the specific DJN.F 1,1 -> 0,0
// trap in our own clear. Other instructions can still modify the fields;
// compatibility and field strength must be measured in the full composite.
export default {
 id:'friendly-decoys',kind:'data',exit:'data',processes:0,writes:'sparse',
 purpose:'COUNT passive DAT or SPL decoys with immediate fields1,2. Equal decrements alone cannot make both fields zero simultaneously, unlike1,1 decoys. This avoids one specific own-clear interaction, not arbitrary damage or a guarantee of field strength.',
 params:{COUNT:[1,28],TYPE:[0,1]},defaults:{COUNT:6,TYPE:1},
 emit(ctx){for(let i=0;i<ctx.P.COUNT;i++)ctx.ins(i?'':'dStart',ctx.P.TYPE?'SPL':'DAT',ctx.P.TYPE?'B':'F','#1','#2');}
};
