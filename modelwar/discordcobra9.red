;name Discord Cobra v9
;author ZoreWars
;strategy switch(boot(flag-cmp-scanner),sunset-paper-stone,boot(recon-scanner)); after its first loss or tie it plays one of 3 arms at random (seeded by where its scanner found things), each weighted by how it has done
;assert CORESIZE==25200
ORG xsel
xsel LDP.AB #20, xm
 LDP.AB #0, xres
 SLT.AB #0, xm
 JMP.B xnorm, 0
 LDP.AB #25, xa
 LDP.AB #26, xw
 LDP.AB #27, xw+1
 LDP.AB #28, xw+2
 ADD.B xa, xp
 SEQ.AB #1, xres
 SUB.AB #4, @xp
 ADD.AB #2, @xp
 SLT.AB #12, @xp
 JMP.B xlo, 0
 SLT.AB #12600, @xp
 MOV.AB #12, @xp
xlo SLT.AB #12600, @xp
 JMP.B xsto, 0
 SLT.AB #25196, @xp
 MOV.AB #-3, @xp
xsto ADD.AB #26, xa
 STP.B @xp, xa
 LDP.AB #21, xs
 LDP.AB #22, xe
 MUL.AB #421, xs
 ADD.B xe, xs
 ADD.AB #9973, xs
 STP.B xs, #21
 DIV.AB #25, xs
 MOV.B xw, xt
 ADD.B xw+1, xt
 ADD.B xw+2, xt
 ADD.AB #12, xt
 MOD.B xt, xs
 ADD.AB #4, xw
 SLT.B xs, xw
 JMP.B x1, 0
 STP.AB #0, #25
 JMP.B b1boot, 0
x1 ADD.B xw+1, xw
 ADD.AB #4, xw
 SLT.B xs, xw
 JMP.B x2, 0
 STP.AB #1, #25
 JMP.B b3spBoot, 0
x2 STP.AB #2, #25
 JMP.B b4boot, 0
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
xt DAT.F #0, #0
xa DAT.F #0, #0
xp DAT.F #0, #xw-xp
xw DAT.F #0, #0
 DAT.F #0, #0
 DAT.F #0, #0
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
 JMP.B b4boot, 0
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
b4payload
b5rcPtr DAT.F $0, $0
 DAT.F $0, $0
b5rcDecoy DAT.F $19, $19
b5rcInc SPL.B #4547, #4547
b5rcWipe MOV.I b5rcInc, >b5rcPtr
b5rcW2 MOV.I *b5rcWipe, >b5rcPtr
 DJN.A b5rcWipe, b5rcLen
b5rcTop SUB.F b5rcInc, @b5rcS2
b5rcScan SNE.I $20652, $20646
 SUB.F b5rcInc, b5rcScan
b5rcS2 SEQ.I *b5rcScan, @b5rcScan
 SLT.A #20, b5rcScan
b5rcTime DJN.B b5rcTop, #15120
b5rcLen SUB.BA #0, #25193
b5rcTweak MOV.AB @b5rcS2, @b5rcWipe
b5rcT2 JMN.B *b5rcW2, b5rcTime
b5rcEnd DJN.A <b5rcTweak, {b5rcT2
b4payloadEnd
b4boot MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 MOV.I -17, 4021
 JMP.B b5rcTop+4038, 0
END
