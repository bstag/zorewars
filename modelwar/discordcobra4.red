;name Discord Cobra v4
;author ZoreWars
;strategy switch(sunset-paper-stone,boot(flag-cmp-scanner),seq(qi-qscan,cobra-body))
;assert CORESIZE==25200
ORG b0start
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
b0table JMP.B b1spBoot, 0
 JMP.B b2boot, 0
 JMP.B b5scan, 0
b1spStone SPL.B #18028, {18028
b1spMov MOV.I b1spAmmo, *2
b1spAdd ADD.F b1spStone, 1
b1spCopy MOV.I $14663, $23677
b1spSrc JMP.B b1spMov, b1spStone
 DAT.F $0, $0
b1spAmmo DAT.F }1, >1
b1spPap SPL.B $13230, {b1spThis
 MOV.I }b1spThis, }b1spPap
 MOV.I b1spDat, >16380
b1spThis MOV.I b1spPap+6, }b1spPap
 JMZ.F b1spPap, *b1spThis
b1spDat DAT.F <8400, <16800
b1spEnd DAT.F $0, $0
b1spBoot MOV.I >b1spSrc, >b1spDst
 SPL.B $2, $0
 SPL.B $1, $0
b1spSrcP SPL.B $1, b1spEnd
 MOV.I >b1spSrc, >b1spDst
 MOV.I <b1spSrcP, {b1spVec
b1spDst SPL.B @b1spVec, b1spBoot+16695
 SPL.B @b1spVec, >b1spDst
b1spVec DJN.B b1spBoot+17403, #b1spBoot+16695
b3fcFlag DAT.F $0, $0
b3fcTop SUB.F b3fcInc, b3fcPtr
b3fcPtr SNE.I $3089, $3094
 SUB.F b3fcInc, b3fcPtr
 SEQ.I *b3fcPtr, @b3fcPtr
 SLT.AB #30, b3fcPtr
b3fcDjn DJN.F b3fcTop, <17144
b3fcAim MOV.B b3fcPtr, #0
 ADD.AB #8, b3fcCnt
b3fcWipe MOV.I *1, <b3fcAim
 MOV.I b3fcInc, <b3fcAim
b3fcCnt DJN.B b3fcWipe, #0
 JMZ.B b3fcTop, b3fcFlag
b3fcInc SPL.B #22105, $22105
b3fcClr MOV.I b3fcBomb, >b3fcWipe+1
 DJN.F b3fcClr, {b3fcWipe+1
b3fcBomb DAT.F $1, $9
b2boot MOV.I <b2copyFrom, <b2copyTo
 DJN.B b2boot, b2copyCount
 JMP.B b3fcPtr+12600, 0
b2copyFrom DAT.F #0, #-3
b2copyTo DAT.F #0, #12596
b2copyCount DAT.F #0, #17
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
