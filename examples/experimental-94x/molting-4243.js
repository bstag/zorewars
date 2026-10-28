// Molting: a bounded opening, then a one-time move into a different attack.
// Experimental 94x ring warrior; no P-space. See docs/molting-94x-journal.md.
// OPENING: 0 bomber, 1 scanner. TRIGGER: 0 timer, 1 marker or timer.
// BACKWARD: 0 forward clear, 1 backward clear. HOP is the new body's offset.
// SPACE {"OPENING":[0,1],"TRIGGER":[0,1],"BACKWARD":[0,1],"WAIT":[32,768],"STEP":[64,2048],"HOP":[2048,48000],"SENSOR":[256,1800]}
const P = {"OPENING":1,"TRIGGER":1,"BACKWARD":0,"WAIT":128,"STEP":997,"HOP":5540,"SENSOR":911};

if (CORESIZE !== 55440 || SIZEY !== 1 || SIZEZ !== 1) throw new Error('Molting requires the 55440-cell 94x ring (--rules 94x).');
const ranges = { OPENING: [0, 1], TRIGGER: [0, 1], BACKWARD: [0, 1], WAIT: [32, 768], STEP: [64, 2048], HOP: [2048, 48000], SENSOR: [256, 1800] };
for (const [key, [lo, hi]] of Object.entries(ranges)) {
  if (!Number.isInteger(P[key]) || P[key] < lo || P[key] > hi) throw new Error(`Invalid ${key}: expected an integer in ${lo}..${hi}`);
}

name("Molting Sensor 4243");
author('ZoreWars');
strategy(`${P.OPENING ? 'Scanner' : 'Bomber'}; ${P.TRIGGER ? 'marker or timer' : 'timer'} triggers relocation; ${P.BACKWARD ? 'backward' : 'forward'} SPL/DAT clear.`);
comment(`Parameters ${JSON.stringify(P)}`);
org('opening');
equ('psize', '(pend-payload)');
equ('pend', '(clearKill+1)');

// All opening targets are relative to probe (instruction zero). Never attack
// the first 2048 cells: this protects the complete template and the marker.
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
if (P.TRIGGER) {
  seq.i('marker', `probe+${P.SENSOR}`);
  jmp('molt');
}
djn.b('hunt', 'clock');

// Copy the untouched payload backwards, then jump to its FIRST cell.
// Only one process enters the payload, so the pass counter has one owner.
label('molt'); mov.i(predec('src'), predec('dst'));
djn.b('molt', 'copies');
jmp(ind('dst'));

// Every clear pass excludes the entire relocated payload. Bounded DAT
// passes restart instead of eventually wrapping into our own instructions.
const first = P.BACKWARD ? 'payload-clearPtr' : 'pend-clearPtr';
const advance = P.BACKWARD ? predec('clearPtr') : postinc('clearPtr');
label('payload'); mov.ab(imm(first), 'clearPtr');
mov.ab(imm('CORESIZE-psize'), 'remaining');
label('stunLoop'); mov.i('clearStun', advance);
djn.b('stunLoop', 'remaining');
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
