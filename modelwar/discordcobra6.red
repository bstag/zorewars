;name Discord Cobra v6
;author ZoreWars
;strategy switch(boot(flag-cmp-scanner),sunset-paper-stone,seq(qi-qscan,cobra-body)); after its first loss or tie it plays Sunset or Discord at random (seeded by where its scanner found things), leaning to the one that wins
;assert CORESIZE==25200
ORG xsel
xsel LDP.AB #20, xm
 LDP.AB #0, xres
 SLT.AB #0, xm
 JMP.B xnorm, 0
 LDP.AB #24, xk
 LDP.AB #25, xa
 SLT.AB #1, xres
 JMP.B xupd, 0
 JMP.B xdraw, 0
xupd SEQ.B xa, xres
 SUB.AB #2, xk
 ADD.AB #1, xk
 SNE.AB #-3, xk
 ADD.AB #1, xk
 SNE.AB #5, xk
 SUB.AB #1, xk
 STP.B xk, #24
xdraw LDP.AB #21, xs
 LDP.AB #22, xe
 MUL.AB #421, xs
 ADD.B xe, xs
 ADD.AB #9973, xs
 STP.B xs, #21
 DIV.AB #3150, xs
 ADD.AB #3, xk
 SLT.B xs, xk
 JMP.B xdis, 0
 STP.AB #1, #25
 JMP.B b3spBoot, 0
xdis STP.AB #0, #25
 JMP.B b1boot, 0
xnorm JMZ.B xup, xres
 SEQ.AB #1, xres
 JMP.B xtie, 0
 JMZ.B b0start, xm
 SUB.AB #1, xm
 JMP.B xst, 0
xup ADD.AB #1, xm
xst STP.B xm, #20
 JMP.B b0start, 0
xtie SNE.AB #2, xres
 JMP.B xup, 0
 JMP.B b0start, 0
xm DAT.F #0, #0
xres DAT.F #0, #0
xs DAT.F #0, #0
xe DAT.F #0, #0
xk DAT.F #0, #0
xa DAT.F #0, #0
b0start LDP.AB #0, b0result
 LDP.AB #1, b0choice
 MOD.AB #3, b0choice
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
 LDP.AB #2, b0losses
 JMN.B b0won, b0result
 ADD.AB #1, b0losses
 SLT.AB #1, b0losses
 JMP.B b0keep, 0
 ADD.AB #1, b0choice
b0won MOV.AB #0, b0losses
b0keep MOD.AB #3, b0choice
 STP.B b0choice, #1
 STP.B b0losses, #2
 ADD.AB #b0table-b0choice, b0choice
 JMP.B @b0choice, 0
b0result DAT.F #0, #0
b0choice DAT.F #0, #0
b0losses DAT.F #0, #0
b0ties DAT.F #0, #0
b0table JMP.B b1boot, 0
 JMP.B b3spBoot, 0
 JMP.B b5scan, 0
b2fcFlag DAT.F $0, $0
b2fcTop SUB.F b2fcInc, b2fcPtr
b2fcPtr SNE.I $3089, $3094
 SUB.F b2fcInc, b2fcPtr
 SEQ.I *b2fcPtr, @b2fcPtr
 SLT.AB #30, b2fcPtr
b2fcDjn DJN.F b2fcTop, <17144
 STP.B b2fcPtr, #22
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
b1copyCount DAT.F #0, #18
b3spStone SPL.B #18028, {18028
b3spMov MOV.I b3spAmmo, *2
b3spAdd ADD.F b3spStone, 1
b3spCopy MOV.I $14663, $23677
b3spSrc JMP.B b3spMov, b3spStone
 DAT.F $0, $0
b3spAmmo DAT.F }1, >1
b3spPap SPL.B $13230, {b3spThis
 MOV.I }b3spThis, }b3spPap
 MOV.I b3spDat, >16380
b3spThis MOV.I b3spPap+6, }b3spPap
 JMZ.F b3spPap, *b3spThis
b3spDat DAT.F <8400, <16800
b3spEnd DAT.F $0, $0
b3spBoot MOV.I >b3spSrc, >b3spDst
 SPL.B $2, $0
 SPL.B $1, $0
b3spSrcP SPL.B $1, b3spEnd
 MOV.I >b3spSrc, >b3spDst
 MOV.I <b3spSrcP, {b3spVec
b3spDst SPL.B @b3spVec, b3spBoot+16695
 SPL.B @b3spVec, >b3spDst
b3spVec DJN.B b3spBoot+17403, #b3spBoot+16695
b5scan SNE.I b5q0+5340, b5q0+4329
 SEQ.I b5q0+18120, b5q0+9585
 JMP.B b5decide, 0
 SNE.I b5q0+13500, b5q0+12042
 SEQ.I b5q0+9000, b5q0+5130
 JMP.B b5dec, 0
 SNE.I b5q0+8835, b5q0+9344
 SEQ.I b5q0+22830, b5q0+18960
 DJN.F b5dec, b5q0
 SNE.I b5q0+8160, b5q0+7713
 SEQ.I b5q0+7920, b5q0+13032
 DJN.F b5dec, b5t2
 SNE.I b5q0+9300, b5q0+5823
 SEQ.I b5q0+17400, b5q0+23895
 JMP.B b5dec, <b5qb
 SNE.I b5q0+3960, b5q0+1494
 SEQ.I b5q0+24480, b5q0+14310
 DJN.F b5dec, <b5qb
 SNE.I b5q0+14400, b5q0+16641
 SEQ.I b5q0+18000, b5q0+14265
 JMP.B b5dec, }b5dec
 SEQ.I b5q0+15422, b5q0+4920
 DJN.F b5fast, b5q0
 SEQ.I b5q0+12780, b5q0+5256
 DJN.F b5fast, b5t2
 SEQ.I b5q0+20040, b5q0+8406
 DJN.F b5fast, {b5fast
 JMP.B b4link0, 0
b5t1 DAT.F 2215, 2487
b5t2 DAT.F 4665, 2698
b5qb DAT.F >-78, {b5t2
b5dec MUL.F @b5qb, b5q0
b5decide SNE.I *b5q0, @b5q0
b5fast MUL.X b5t2, b5q0
 SEQ.I -114, *b5q0
 MOV.X b5q0, b5q0
b5bLoop MOV.I b5qb, @b5q0
b5q0 MOV.I 5340, }4329
 ADD.AB #5, b5q0
 DJN.B b5bLoop, #20
 JMP.B b4link0, 0
b4link0 JMP.B b6go, 0
b6cptr DAT.F 2383, 2372
b6bptr DAT.F 1, 9
b6cs0 SPL.B #124, 1077
b6clear MOV.I *b6bptr, >b6cptr
 MOV.I *b6bptr, >b6cptr
 DJN.F b6clear, }b6cs0
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
b6loop SUB.F b6inc, @b6dj
 SEQ.I {b6cptr, <b6cptr
 SNE.I {b6cptr, <b6cptr
b6dj DJN.F b6loop, <b6cptr
b6inc SPL.B *b6bptr, <b6cptr
b6imp MOV.I #4000, 1
b6go MOV.I {b6cfrom, {b6cto
 MOV.I <b6cfrom, <b6cto
 DJN.B b6go, #6
b6cto SPL.B b6loop+2957, b6cptr+2957
 MOV.F #0, {0
b6cfrom DAT.F b6loop+6, b6cptr+6
END
