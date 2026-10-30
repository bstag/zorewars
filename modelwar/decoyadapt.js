// Decoy Shot (ModelWar 1v1, 25200 core): a oneshot followed by a long
// decoy. The decoy repeats every PERIOD cells, so our own scan (pairs PERIOD
// apart) sees it as empty, while scans with any other gap see it as code.
// An enemy oneshot that lands on the decoy clears forward from there and has
// to wrap the whole core before it reaches us; our clear sits first, so a
// hit on our own decoy also clears the enemy before it gets back to us.
name("Decoy Adapter");
author("ZoreWars");
strategy("Decoy Shot plus a P-space switch: keep a score per clear setting and play the one that is ahead.");

const P = {"ALT":5000,"DECOY":4000,"PERIOD":11,"STEP":10091,"DEC":8419};
// SPACE {"DECOY":[200,5000],"PERIOD":[5,23],"STEP":[2000,23000],"DEC":[1000,24000]}

raw(`gate    equ clear-4`);
raw(`first   equ bptr-1+${P.STEP}`);
raw(`        org pstart`);
raw(`bptr    dat    #1,        #11`);
raw(`dptr    spl    #${P.DEC},      13`);
raw(`clear   mov    *bptr,     >gate`);
raw(`        mov    *bptr,     >gate`);
raw(`        djn.f  clear,     }dptr`);
for (let i = 0; i < 5; i++) raw(`        dat 0,0`);
raw(`oneshot add    inc,       scanptr`);
raw(`scanptr sne    first+${P.PERIOD}, }first`);
raw(`        djn.f  oneshot,   *scanptr`);
raw(`        mov    scanptr,   gate`);
raw(`        jmp    clear-1,   <gate`);
for (let i = 0; i < 4; i++) raw(`        dat 0,0`);
raw(`inc     dat    ${P.STEP},      ${P.STEP}`);
// P-space switch: cell 0 = last result (0 lost, 1 won, 2 tie), cell 1 = mode used,
// cells 2/3 = running score (wins - losses) of each mode. Play the mode that is ahead;
// ties favour mode 0. Without working P-space everything stays 0: plain Decoy Shot.
raw(`pstart  ldp.ab #0,        res`);
raw(`        ldp.ab #1,        mode`);
raw(`        ldp.ab #2,        c0`);
raw(`        ldp.ab #3,        c1`);
raw(`        slt.ab #2,        res`);
raw(`        jmp    upd`);
raw(`        jmp    pick`);
raw(`upd     jmz.b  lost,      res`);
raw(`        sne.ab #1,        res`);
raw(`        jmp    won`);
raw(`        jmp    pick`);
raw(`won     mov.ab #1,        d`);
raw(`        jmp    apply`);
raw(`lost    mov.ab #-1,       d`);
raw(`apply   jmz.b  a0,        mode`);
raw(`        add.b  d,         c1`);
raw(`        stp.b  c1,        #3`);
raw(`        jmp    pick`);
raw(`a0      add.b  d,         c0`);
raw(`        stp.b  c0,        #2`);
raw(`pick    mov.ab #0,        mode`);
raw(`        mov.b  c1,        df`);
raw(`        sub.b  c0,        df`);
raw(`        add.ab #1000,     df`);
raw(`        slt.ab #1000,     df`);
raw(`        jmp    store`);
raw(`        mov.ab #1,        mode`);
raw(`store   stp.b  mode,      #1`);
raw(`        jmz.b  oneshot,   mode`);
raw(`        mov.a  #${P.ALT},    dptr`);
raw(`        jmp    oneshot`);
raw(`res     dat    0,         0`);
raw(`mode    dat    0,         0`);
raw(`c0      dat    0,         0`);
raw(`c1      dat    0,         0`);
raw(`d       dat    0,         0`);
raw(`df      dat    0,         0`);
for (let i = 0; i < P.DECOY; i++) {
  const k = (i % P.PERIOD) + 1;
  raw(`        dat    #${k}, #${P.PERIOD + 1 - k}`);
}
