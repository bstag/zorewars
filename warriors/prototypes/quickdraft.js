// Quick Draft: Backdraft with a quickscan in front, the opening almost every
// top ring hill warrior uses. For its first few dozen cycles it compares
// pairs of cells spread through the volume; a pair that differs holds
// something. It stuns a block of the row around the find with SPL 0, kills
// the block with DAT, then runs Backdraft as usual. A miss costs ~60 cycles.
// In 3D a body is at most 40 cells, so 2 x N checks find the enemy only
// now and then (ring hill warriors are far bigger targets).
name("Quick Draft");
author("ZoreWars");
strategy("Quickscan of fixed cell pairs; on a find, an SPL 0 then DAT block around it; then Backdraft's backward clear.");
if (SIZEZ < 2) throw new Error("Quick Draft is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// SPACE {"N":[8,24],"R":[10,30],"SX":[1,79],"SY":[1,9],"SZ":[1,9]}
const P = {"N":12,"R":24,"SX":54,"SY":4,"SZ":8};

// Checked cells: a = tp + A0 + k*step, b = a + half the volume. None may be
// in our own row (or the row our body may run on into): a find there would
// make us bomb ourselves.
const half = [SIZEX / 2, SIZEY / 2, SIZEZ / 2];
const A0 = [SIZEX / 2, 2, 3];
const wrap = (v, m) => ((v % m) + m) % m;
for (let k = 1; k <= P.N; k++) for (const off of [[0, 0, 0], half]) {
  const y = wrap(A0[1] + off[1] + k * P.SY, SIZEY), z = wrap(A0[2] + off[2] + k * P.SZ, SIZEZ);
  if (z === 0 && (y <= 1 || y === SIZEY - 1)) throw new Error(`check ${k} lands in our own rows: change SY/SZ`);
}

label("ptr");   dat.f(0, 0);                                  // Backdraft's pointer
org("scan");
// ---- quickscan ----
label("scan");  add.f("step", "tp");
seq.i(aind("tp"), ind("tp"));                                 // the pair: both empty?
jmp("found");                                                 //   no: something is there
djn.b("scan", imm(P.N));
jmp("go");
label("found"); seq.i(aind("tp"), "emp");                     // a empty? then b is the find
mov.ab("tp", "tp");                                           // a is the find: aim at a
sub.ab(imm(P.R), "tp");                                       // start R cells before it, along its row
label("stunb"); mov.i("stun", postinc("tp"));                 // SPL 0 over 2R cells...
djn.b("stunb", imm(2 * P.R));
label("killb"); mov.i("kill", predec("tp"));                  // ...then DAT back over them
djn.b("killb", imm(2 * P.R));
// ---- Backdraft ----
label("go");
label("lap");   mov.ab(imm(0), "ptr");
mov.ab(imm(`(${CORESIZE}-len)/2`), "left");
label("pass1"); mov.i("stun", predec("ptr"));
mov.i("jump", predec("ptr"));
djn.b("pass1", "left");
mov.ab(imm(0), "ptr");
mov.ab(imm(`${CORESIZE}-len`), "left");
label("pass2"); mov.i("kill", predec("ptr"));
djn.b("pass2", "left");
jmp("lap");
label("stun");  spl.b(imm(0), imm(0));
label("jump");  jmp(-1);
label("kill");  dat.f(imm(0), imm(0));
label("step");  dat.f(vec(P.SX, P.SY, P.SZ), vec(P.SX, P.SY, P.SZ));
label("tp");    dat.f(vec(A0[0], A0[1], A0[2]), vec(A0[0] + half[0], A0[1] + half[1], A0[2] + half[2]));
label("emp");   dat.f(0, 0);                                  // an empty cell to compare with
label("left");  dat.f(0, 0);
equ("len", "(left+1-ptr)");
