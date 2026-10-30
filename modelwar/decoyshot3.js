// Decoy Shot (ModelWar 1v1, 25200 core): a oneshot followed by a long
// decoy. The decoy repeats every PERIOD cells, so our own scan (pairs PERIOD
// apart) sees it as empty, while scans with any other gap see it as code.
// An enemy oneshot that lands on the decoy clears forward from there and has
// to wrap the whole core before it reaches us; our clear sits first, so a
// hit on our own decoy also clears the enemy before it gets back to us.
name("Decoy Shot 3");
author("ZoreWars");
strategy("Oneshot scanner + d-clear, an imp gate below it, then a periodic decoy that only other scanners see.");

const P = {"GATEGAP":30,"DECOY":4000,"PERIOD":11,"STEP":10091,"DEC":8419};
// SPACE {"DECOY":[200,5000],"PERIOD":[5,23],"STEP":[2000,23000],"DEC":[1000,24000]}

raw(`gate    equ clear-4`);
raw(`first   equ bptr-1+${P.STEP}`);
raw(`        org start`);
raw(`ig      dat    0,         0`);
for (let i = 0; i < P.GATEGAP; i++) raw(`        dat    0,         0`);
raw(`bptr    dat    #1,        #11`);
raw(`dptr    spl    #${P.DEC},      13`);
raw(`clear   mov    *bptr,     >gate`);
raw(`        mov    *bptr,     >gate`);
raw(`        djn.f  gt,        }dptr`);
raw(`gt      jmp    clear,     <ig`);
for (let i = 0; i < 5; i++) raw(`        dat 0,0`);
raw(`oneshot add    inc,       scanptr`);
raw(`scanptr sne    first+${P.PERIOD}, }first`);
raw(`        djn.f  oneshot,   *scanptr`);
raw(`        mov    scanptr,   gate`);
raw(`        mov    bptr,      gl`);
raw(`        jmp    clear-1,   <gate`);
for (let i = 0; i < 4; i++) raw(`        dat 0,0`);
raw(`inc     dat    ${P.STEP},      ${P.STEP}`);
raw(`start   spl    gl`);
raw(`        jmp    oneshot`);
raw(`gl      jmp    gl,        <ig`);
for (let i = 0; i < P.DECOY; i++) {
  const k = (i % P.PERIOD) + 1;
  raw(`        dat    #${k}, #${P.PERIOD + 1 - k}`);
}
