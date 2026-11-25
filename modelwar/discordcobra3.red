;name Discord Cobra v3
;author ZoreWars
;strategy switch(boot(flag-cmp-scanner),seq(qi-qscan,cobra-body),switch(boot(flag-cmp-scanner),switch-table(sunset-paper-stone,boot(recon-scanner),redeploy)),sunset-paper-stone)
;assert CORESIZE==25200
ORG b0start
b0start LDP.AB #0, b0result
 LDP.AB #1, b0choice
 MOD.AB #4, b0choice
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
b0keep MOD.AB #4, b0choice
 STP.B b0choice, #1
 ADD.AB #b0table-b0choice, b0choice
 JMP.B @b0choice, 0
b0result DAT.F #0, #0
b0choice DAT.F #0, #0
b0ties DAT.F #0, #0
b0table JMP.B b1boot, 0
 JMP.B b4scan, 0
 JMP.B b6start, 0
 JMP.B b14spBoot, 0
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
b4scan SNE.I b4q0+5340, b4q0+4329
 SEQ.I b4q0+18120, b4q0+9585
 JMP.B b4decide, 0
 SNE.I b4q0+13500, b4q0+12042
 SEQ.I b4q0+9000, b4q0+5130
 JMP.B b4dec, 0
 SNE.I b4q0+8835, b4q0+9344
 SEQ.I b4q0+22830, b4q0+18960
 DJN.F b4dec, b4q0
 SNE.I b4q0+8160, b4q0+7713
 SEQ.I b4q0+7920, b4q0+13032
 DJN.F b4dec, b4t2
 SNE.I b4q0+9300, b4q0+5823
 SEQ.I b4q0+17400, b4q0+23895
 JMP.B b4dec, <b4qb
 SNE.I b4q0+3960, b4q0+1494
 SEQ.I b4q0+24480, b4q0+14310
 DJN.F b4dec, <b4qb
 SNE.I b4q0+14400, b4q0+16641
 SEQ.I b4q0+18000, b4q0+14265
 JMP.B b4dec, }b4dec
 SEQ.I b4q0+15422, b4q0+4920
 DJN.F b4fast, b4q0
 SEQ.I b4q0+12780, b4q0+5256
 DJN.F b4fast, b4t2
 SEQ.I b4q0+20040, b4q0+8406
 DJN.F b4fast, {b4fast
 JMP.B b3link0, 0
b4t1 DAT.F 2215, 2487
b4t2 DAT.F 4665, 2698
b4qb DAT.F >-78, {b4t2
b4dec MUL.F @b4qb, b4q0
b4decide SNE.I *b4q0, @b4q0
b4fast MUL.X b4t2, b4q0
 SEQ.I -85, *b4q0
 MOV.X b4q0, b4q0
b4bLoop MOV.I b4qb, @b4q0
b4q0 MOV.I 5340, }4329
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
b6start LDP.AB #0, b6result
 LDP.AB #7, b6choice
 MOD.AB #2, b6choice
 ADD.AB #1, b6result
 JMZ.B b6keep, b6result
 ADD.AB #1, b6choice
b6keep MOD.AB #2, b6choice
 STP.B b6choice, #7
 ADD.AB #b6table-b6choice, b6choice
 JMP.B @b6choice, 0
b6result DAT.F #0, #0
b6choice DAT.F #0, #0
b6table JMP.B b7boot, 0
 JMP.B b9start, 0
b8fcFlag DAT.F $0, $0
b8fcTop SUB.F b8fcInc, b8fcPtr
b8fcPtr SNE.I $3089, $3094
 SUB.F b8fcInc, b8fcPtr
 SEQ.I *b8fcPtr, @b8fcPtr
 SLT.AB #30, b8fcPtr
b8fcDjn DJN.F b8fcTop, <17144
b8fcAim MOV.B b8fcPtr, #0
 ADD.AB #8, b8fcCnt
b8fcWipe MOV.I *1, <b8fcAim
 MOV.I b8fcInc, <b8fcAim
b8fcCnt DJN.B b8fcWipe, #0
 JMZ.B b8fcTop, b8fcFlag
b8fcInc SPL.B #22105, $22105
b8fcClr MOV.I b8fcBomb, >b8fcWipe+1
 DJN.F b8fcClr, {b8fcWipe+1
b8fcBomb DAT.F $1, $9
b7boot MOV.I <b7copyFrom, <b7copyTo
 DJN.B b7boot, b7copyCount
 JMP.B b8fcPtr+12600, 0
b7copyFrom DAT.F #0, #-3
b7copyTo DAT.F #0, #12596
b7copyCount DAT.F #0, #17
b9start LDP.AB #0, b9result
 ADD.AB #1, b9result
 JMZ.B b9first, b9result
 SLT.B b9result, #4
 MOV.AB #3, b9result
 ADD.AB #b9moduli-b9result-1, b9result
 LDP.AB #234, b9row
 MOD.B @b9result, b9row
 SLT.B b9row, #11
b9first MOV.AB #0, b9row
 ADD.AB #b9table-b9row, b9row
 STP.B @b9row, #234
 JMP.B @b9row, 0
b9result DAT.F #0, #0
b9row DAT.F #0, #0
b9moduli DAT.F #0, #11
 DAT.F #0, #12
 DAT.F #0, #13
b9table JMP.B b10spBoot, #1005
 JMP.B b10spBoot, #741
 JMP.B b13rdGo, #1254
 JMP.B b10spBoot, #1162
 JMP.B b11boot, #788
 JMP.B b10spBoot, #46
 JMP.B b13rdGo, #1410
 JMP.B b10spBoot, #574
 JMP.B b11boot, #1412
 JMP.B b10spBoot, #1353
 JMP.B b10spBoot, #874
b10spStone SPL.B #18028, {18028
b10spMov MOV.I b10spAmmo, *2
b10spAdd ADD.F b10spStone, 1
b10spCopy MOV.I $14663, $23677
b10spSrc JMP.B b10spMov, b10spStone
 DAT.F $0, $0
b10spAmmo DAT.F }1, >1
b10spPap SPL.B $13230, {b10spThis
 MOV.I }b10spThis, }b10spPap
 MOV.I b10spDat, >16380
b10spThis MOV.I b10spPap+6, }b10spPap
 JMZ.F b10spPap, *b10spThis
b10spDat DAT.F <8400, <16800
b10spEnd DAT.F $0, $0
b10spBoot MOV.I >b10spSrc, >b10spDst
 SPL.B $2, $0
 SPL.B $1, $0
b10spSrcP SPL.B $1, b10spEnd
 MOV.I >b10spSrc, >b10spDst
 MOV.I <b10spSrcP, {b10spVec
b10spDst SPL.B @b10spVec, b10spBoot+16695
 SPL.B @b10spVec, >b10spDst
b10spVec DJN.B b10spBoot+17403, #b10spBoot+16695
b11payload
b12rcPtr DAT.F $0, $0
 DAT.F $0, $0
b12rcDecoy DAT.F $19, $19
b12rcInc SPL.B #4547, #4547
b12rcWipe MOV.I b12rcInc, >b12rcPtr
b12rcW2 MOV.I *b12rcWipe, >b12rcPtr
 DJN.A b12rcWipe, b12rcLen
b12rcTop SUB.F b12rcInc, @b12rcS2
b12rcScan SNE.I $20652, $20646
 SUB.F b12rcInc, b12rcScan
b12rcS2 SEQ.I *b12rcScan, @b12rcScan
 SLT.A #20, b12rcScan
b12rcTime DJN.B b12rcTop, #15120
b12rcLen SUB.BA #0, #25193
b12rcTweak MOV.AB @b12rcS2, @b12rcWipe
b12rcT2 JMN.B *b12rcW2, b12rcTime
b12rcEnd DJN.A <b12rcTweak, {b12rcT2
b11payloadEnd
b11boot MOV.I -17, 4021
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
 JMP.B b12rcTop+4038, 0
b13rdGo MOV.I <b13rdSrc, <b13rdDst
 DJN.B b13rdGo, b13rdCnt
b13rdJmp JMP.B b12rcTop+21420, 0
b13rdSrc DAT.F #0, #(b11payloadEnd-b13rdSrc)
b13rdDst DAT.F #0, #(b11payloadEnd+21420-b13rdDst)
b13rdCnt DAT.F #0, #(b11payloadEnd-b11payload)
b14spStone SPL.B #18028, {18028
b14spMov MOV.I b14spAmmo, *2
b14spAdd ADD.F b14spStone, 1
b14spCopy MOV.I $14663, $23677
b14spSrc JMP.B b14spMov, b14spStone
 DAT.F $0, $0
b14spAmmo DAT.F }1, >1
b14spPap SPL.B $13230, {b14spThis
 MOV.I }b14spThis, }b14spPap
 MOV.I b14spDat, >16380
b14spThis MOV.I b14spPap+6, }b14spPap
 JMZ.F b14spPap, *b14spThis
b14spDat DAT.F <8400, <16800
b14spEnd DAT.F $0, $0
b14spBoot MOV.I >b14spSrc, >b14spDst
 SPL.B $2, $0
 SPL.B $1, $0
b14spSrcP SPL.B $1, b14spEnd
 MOV.I >b14spSrc, >b14spDst
 MOV.I <b14spSrcP, {b14spVec
b14spDst SPL.B @b14spVec, b14spBoot+16695
 SPL.B @b14spVec, >b14spDst
b14spVec DJN.B b14spBoot+17403, #b14spBoot+16695
END
