// Original ZoreWars recipe. Verify with buildAirbag after tuning.
// SPACE {"BOOT":[0,1],"STEP":[1,55439],"HOP":[256,54000],"SHOTS":[16,2048],"BOMB":[0,1],"BACKWARD":[0,1],"PHASE":[0,2],"STUN":[1,4096]}
const P = {"BOOT":0,"STEP":17224,"HOP":18000,"SHOTS":512,"BOMB":0,"BACKWARD":0,"PHASE":2,"STUN":64};
const airbagSpace = {"BOOT":[0,1],"STEP":[1,55439],"HOP":[256,54000],"SHOTS":[16,2048],"BOMB":[0,1],"BACKWARD":[0,1],"PHASE":[0,2],"STUN":[1,4096]};
function emitAirbag(P) {
  if (Object.keys(P).length !== Object.keys(airbagSpace).length) throw new Error('Unexpected airbag parameters');
  for (const [key,[lo,hi]] of Object.entries(airbagSpace)) if (!Number.isSafeInteger(P[key]) || P[key]<lo || P[key]>hi) throw new Error(`Invalid ${key}`);
  const lines = [';name Lifeboat 94x', ';author ZoreWars', ';strategy Booted guarded stone; independent watchdog takes over with a bounded clear.',
    `; Parameters ${JSON.stringify(P)}`, ';assert CORESIZE == 55440', 'payloadSize EQU (payloadEnd-payload)', 'payloadEnd EQU (killBomb+1)', `ORG ${P.BOOT?'boot':'launch'}`];
  const emit = (label,op,a,b='0') => lines.push(`${label ?? ''} ${op} ${a}, ${b}`);
  if(P.BOOT) {
  emit('boot','MOV.I','<copyFrom','<copyTo');
  emit(null,'DJN.B','boot','copyCount');
  emit(null,'JMP.B',`boot+${P.HOP}+(launch-payload)`);
  emit('copyFrom','DAT.F','#0','#(payloadEnd-copyFrom)');
  emit('copyTo','DAT.F','#0',`#(boot+${P.HOP}+payloadSize-copyTo)`);
  emit('copyCount','DAT.F','#0','#payloadSize');
  }
  // These data cells travel with the payload; the probe is offset zero there.
  emit('payload','DAT.F','#0','#payloadSize');
  emit('shots','DAT.F','#0',`#${P.SHOTS}`);
  emit('watchCount','DAT.F','#0',`#${P.SHOTS*2+32}`);
  emit('flag','DAT.F','#0','#0');
  emit('stoneRef','ADD.AB',`#${P.STEP}`,'payload-stone');
  emit('launch','SPL.B','stone');
  emit('watch','SEQ.I','stone','stoneRef');
  emit(null,'JMP.B','clearStart');
  emit(null,'JMN.B','clearStart','flag');
  emit(null,'DJN.B','watch','watchCount');
  emit(null,'JMP.B','clearStart');
  emit('stone','ADD.AB',`#${P.STEP}`,'payload');
  emit(null,'SLT.AB','#(payloadSize-1)','payload');
  emit(null,'JMP.B','tick');
  emit('attack','MOV.I',P.BOMB ? 'stunBomb' : 'killBomb','@payload');
  emit('tick','DJN.B','stone','shots');
  emit(null,'MOV.AB','#1','flag');
  emit('retire','DAT.F','#0','#0'); // intentional child retirement, not warrior suicide
  const first = P.BACKWARD ? '(payload-clearPtr)' : '(payloadEnd-clearPtr)';
  const target = P.BACKWARD ? '<clearPtr' : '>clearPtr';
  lines.push('clearStart');
  if (P.PHASE) {
    emit(null,'MOV.AB',`#${first}`,'clearPtr');
    emit(null,'MOV.AB',P.PHASE===2?'#(CORESIZE-payloadSize)':`#${P.STUN}`,'remaining');
    emit('stunLoop','MOV.I','stunBomb',target);
    emit(null,'DJN.B','stunLoop','remaining');
  }
  emit('reset','MOV.AB',`#${first}`,'clearPtr');
  emit(null,'MOV.AB','#(CORESIZE-payloadSize)','remaining');
  emit('killLoop','MOV.I','killBomb',target);
  emit(null,'DJN.B','killLoop','remaining');
  emit(null,'JMP.B','reset');
  emit('clearPtr','DAT.F','#0','#0');
  emit('remaining','DAT.F','#0','#0');
  emit('stunBomb','SPL.B','#0','#0');
  emit('killBomb','DAT.F','#0','#0');
  lines.push('END');
  return lines.join('\n')+'\n';
}
if (CORESIZE!==55440 || SIZEY!==1 || SIZEZ!==1) throw new Error('Lifeboat requires the 94x ring');
raw(emitAirbag(P));
