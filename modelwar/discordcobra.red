;name Discord Cobra
;author ZoreWars
;strategy P-space switch (block algebra): Discord's two-pair scanner, booted half the core away, until it loses (or ties 4 in a row), then King Cobra's quickscan and oneshot. Both arms are rebuilt from the 94x and 94nop top-10 recipes.
;assert CORESIZE==25200
ORG b0start
b0start LDP.AB #0, b0result
 LDP.AB #1, b0choice
 MOD.AB #2, b0choice
 LDP.AB #3, b0ties
 ADD.AB #1, b0result
 SLT.AB #2, b0result
 JMP.B b0notie, 0
 ADD.AB #1, b0ties
 SLT.AB #3, b0ties
 JMP.B b0tdone, 0
 MOV.AB #1, b0result
b0notie MOV.AB #0, b0ties
b0tdone SUB.AB #1, b0result
 STP.B b0ties, #3
 JMN.B b0keep, b0result
 ADD.AB #1, b0choice
b0keep MOD.AB #2, b0choice
 STP.B b0choice, #1
 ADD.AB #b0table-b0choice, b0choice
 JMP.B @b0choice, 0
b0result DAT.F #0, #0
b0choice DAT.F #0, #0
b0ties DAT.F #0, #0
b0table JMP.B b1boot, 0
 JMP.B b4scan, 0
b2fcFlag DAT.F $0, $0
b2fcTop SUB.F b2fcInc, b2fcPtr
b2fcPtr SNE.I $3089, $3094
 SUB.F b2fcInc, b2fcPtr
 SEQ.I *b2fcPtr, @b2fcPtr
 SLT.AB #30, b2fcPtr
b2fcDjn DJN.F b2fcTop, <17144
b2fcAim MOV.B b2fcPtr, #0
 ADD.AB #8, b2fcCnt
b2fcWipe MOV.I *1, <b2fcAim
 MOV.I b2fcInc, <b2fcAim
b2fcCnt DJN.B b2fcWipe, #0
 JMZ.B b2fcTop, b2fcFlag
b2fcInc SPL.B #22105, $22105
b2fcClr MOV.I b2fcBomb, >b2fcWipe+1
 DJN.F b2fcClr, {b2fcWipe+1
b2fcBomb DAT.F $1, $9
b1boot MOV.I <b1copyFrom, <b1copyTo
 DJN.B b1boot, b1copyCount
 JMP.B b2fcPtr+12600, 0
b1copyFrom DAT.F #0, #-3
b1copyTo DAT.F #0, #12596
b1copyCount DAT.F #0, #17
b4scan SNE.I b4q0+5340, b4q0+4327
 SEQ.I b4q0+18120, b4q0+255
 JMP.B b4decide, 0
 SNE.I b4q0+13500, b4q0+6646
 SEQ.I b4q0+9000, b4q0+7590
 JMP.B b4dec, 0
 SNE.I b4q0+8835, b4q0+3948
 SEQ.I b4q0+22830, b4q0+21420
 DJN.F b4dec, b4q0
 SNE.I b4q0+8160, b4q0+2319
 SEQ.I b4q0+7920, b4q0+5016
 DJN.F b4dec, b4t2
 SNE.I b4q0+9300, b4q0+849
 SEQ.I b4q0+17400, b4q0+4185
 JMP.B b4dec, <b4qb
 SNE.I b4q0+3960, b4q0+21722
 SEQ.I b4q0+24480, b4q0+3930
 DJN.F b4dec, <b4qb
 SNE.I b4q0+14400, b4q0+24529
 SEQ.I b4q0+18000, b4q0+19785
 JMP.B b4dec, }b4dec
 SEQ.I b4q0+15422, b4q0+20790
 DJN.F b4fast, b4q0
 SEQ.I b4q0+12780, b4q0+21128
 DJN.F b4fast, b4t2
 SEQ.I b4q0+20040, b4q0+3978
 DJN.F b4fast, {b4fast
 JMP.B b3link0, 0
b4t1 DAT.F 2215, 2487
b4t2 DAT.F 4665, 2698
b4qb DAT.F >-78, {b4t2
b4dec MUL.F @b4qb, b4q0
b4decide SNE.I *b4q0, @b4q0
b4fast MUL.X b4t2, b4q0
 SEQ.I -83, *b4q0
 MOV.X b4q0, b4q0
b4bLoop MOV.I b4qb, @b4q0
b4q0 MOV.I 5340, }4327
 ADD.AB #5, b4q0
 DJN.B b4bLoop, #20
 JMP.B b3link0, 0
b3link0 JMP.B b5go, 0
b5cptr DAT.F 2383, 2372
b5bptr DAT.F 1, 9
b5cs0 SPL.B #124, 1077
b5clear MOV.I *b5bptr, >b5cptr
 MOV.I *b5bptr, >b5cptr
 DJN.F b5clear, }b5cs0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
 DAT.F 0, 0
b5loop SUB.F b5inc, @b5dj
 SEQ.I {b5cptr, <b5cptr
 SNE.I {b5cptr, <b5cptr
b5dj DJN.F b5loop, <b5cptr
b5inc SPL.B *b5bptr, <b5cptr
b5imp MOV.I #4000, 1
b5go MOV.I {b5cfrom, {b5cto
 MOV.I <b5cfrom, <b5cto
 DJN.B b5go, #6
b5cto SPL.B b5loop+2957, b5cptr+2957
 MOV.F #0, {0
b5cfrom DAT.F b5loop+6, b5cptr+6
END
