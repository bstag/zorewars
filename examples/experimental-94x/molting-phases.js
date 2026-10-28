// Molting payload experiment. Existing Molting files remain frozen.
// PHASE: 0 direct DAT, 1 STUN writes then DAT, 2 a full-core stun pass.
// STUN is unused in modes 0 and 2. The scanner opening still uses SPL bombs.
// SPACE {"OPENING":[0,1],"TRIGGER":[0,1],"BACKWARD":[0,1],"WAIT":[32,768],"STEP":[64,2048],"HOP":[2048,48000],"SENSOR":[256,1800],"PHASE":[0,2],"STUN":[32,4096]}
const P = {"OPENING":0,"TRIGGER":0,"BACKWARD":0,"WAIT":211,"STEP":1338,"HOP":6965,"SENSOR":545,"PHASE":1,"STUN":512};

if (CORESIZE !== 55440 || SIZEY !== 1 || SIZEZ !== 1) throw new Error('Molting requires the 55440-cell 94x ring (--rules 94x).');
const ranges = { OPENING: [0, 1], TRIGGER: [0, 1], BACKWARD: [0, 1], WAIT: [32, 768], STEP: [64, 2048], HOP: [2048, 48000], SENSOR: [256, 1800], PHASE: [0, 2], STUN: [32, 4096] };
for (const [key, [lo, hi]] of Object.entries(ranges)) {
  if (!Number.isInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}: expected an integer in ${lo}..${hi}`);
}
name('Molting Phases 94x');
author('ZoreWars');
strategy(`${P.OPENING ? 'Scanner' : 'Bomber'}; ${P.TRIGGER ? 'marker or timer' : 'timer'} relocation; ${P.BACKWARD ? 'backward' : 'forward'} clear, ${P.PHASE === 0 ? 'direct DAT' : P.PHASE === 1 ? P.STUN + ' stun writes then DAT' : 'full stun pass then DAT'}.`);
comment(`Parameters ${JSON.stringify(P)}`);
org('opening');
equ('psize', '(pend-payload)');
equ('pend', '(clearKill+1)');

// Opening remains identical to the original family. Label arithmetic adjusts
// the copy when direct DAT removes the four stun-loop instructions.
label('probe'); dat.f(imm(0), imm(2048));
label('src'); dat.f(imm(0), imm('pend-src'));
label('dst'); dat.f(imm(0), imm(`probe+${P.HOP}+psize-dst`));
label('copies'); dat.f(imm(0), imm('psize'));
label('clock'); dat.f(imm(0), imm(P.WAIT));
label('marker'); dat.f(imm(17), imm(23));
label('opening');
if (P.TRIGGER) mov.i('marker', `probe+${P.SENSOR}`);
label('hunt'); add.ab(imm(P.STEP), 'probe');
slt.b(imm(2047), 'probe');
jmp('tick');
if (P.OPENING) jmz.f('tick', ind('probe'));
mov.i(P.OPENING ? 'clearStun' : 'clearKill', ind('probe'));
label('tick');
if (P.TRIGGER) { seq.i('marker', `probe+${P.SENSOR}`); jmp('molt'); }
djn.b('hunt', 'clock');
label('molt'); mov.i(predec('src'), predec('dst'));
djn.b('molt', 'copies');
jmp(ind('dst'));

// Restart DAT at the beginning of the stun strip; do not skip the stunned
// cells. Every full DAT pass still excludes the entire relocated payload.
const first = P.BACKWARD ? 'payload-clearPtr' : 'pend-clearPtr';
const advance = P.BACKWARD ? predec('clearPtr') : postinc('clearPtr');
label('payload');
if (P.PHASE !== 0) {
  mov.ab(imm(first), 'clearPtr');
  mov.ab(imm(P.PHASE === 2 ? 'CORESIZE-psize' : P.STUN), 'remaining');
  label('stunLoop'); mov.i('clearStun', advance);
  djn.b('stunLoop', 'remaining');
}
label('resetKill'); mov.ab(imm(first), 'clearPtr');
mov.ab(imm('CORESIZE-psize'), 'remaining');
label('killLoop'); mov.i('clearKill', advance);
djn.b('killLoop', 'remaining');
jmp('resetKill');
label('clearPtr'); dat.f(imm(0), imm(0));
label('remaining'); dat.f(imm(0), imm(0));
label('clearStun'); spl.b(imm(0), imm(0));
label('clearKill'); dat.f(imm(0), imm(0));
if (curline() > MAXLENGTH) throw new Error(`Molting needs ${curline()} instructions; length limit is ${MAXLENGTH}.`);
