;name Tree
;author ZoreWars
;strategy seq(opening-qscan-mul,probe-burst2,fanboot(armadillo-switch,compact-imp-pump))
;assert CORESIZE==8000
ORG b1qScan
b1probe DAT.F #0, #69
b1t0 DAT.F #0, #1-247*(b1probe)
b1t1 DAT.F #0, #1-247*(b1probe)
b1t2 DAT.F #0, #1-247*(b1probe)
b1t3 DAT.F #0, #1-247*(b1probe)
b1t4 DAT.F #0, #1-247*(b1probe)
b1t5 DAT.F #0, #1-247*(b1probe)
b5pImp MOV.I #0, 1143
b1qScan SNE.I b1probe+(b1t0-b1probe)*248+584, b1probe+(b1t0-b1probe)*248+722
 SEQ.I <b1t0, b1probe+(b1t0-b1probe)*248+138
 JMP.B b1dec0, {b1sel
 SNE.I b1probe+(b1t1-b1probe)*248+584, b1probe+(b1t1-b1probe)*248+722
 SEQ.I <b1t1, b1probe+(b1t1-b1probe)*248+138
 JMP.B b1dec0, $0
 SNE.I b1probe+(b1t2-b1probe)*248+584, b1probe+(b1t2-b1probe)*248+722
 SEQ.I <b1t2, b1probe+(b1t2-b1probe)*248+138
 JMP.B b1dec0, }b1sel
 SNE.I b1probe+(b1t3-b1probe)*248+584, b1probe+(b1t3-b1probe)*248+722
 SEQ.I <b1t3, b1probe+(b1t3-b1probe)*248+138
 JMP.B b1dec1, {b1sel
 SNE.I b1probe+(b1t4-b1probe)*248+584, b1probe+(b1t4-b1probe)*248+722
 SEQ.I <b1t4, b1probe+(b1t4-b1probe)*248+138
 JMP.B b1dec1, $0
 SNE.I b1probe+(b1t5-b1probe)*248+584, b1probe+(b1t5-b1probe)*248+722
 SEQ.I <b1t5, b1probe+(b1t5-b1probe)*248+138
 JMP.B b1dec1, }b1sel
 JMP.B b2burst, 0
b1dec1 ADD.A #b1t4-b1t1, b1sel
b1dec0 MOV.AB #584, b1probe
 MUL.B *b1sel, b1probe
 JMN.F b2burst, @b1probe
 ADD.AB #138, b1probe
 JMP.B b2burst, 0
b1sel DAT.F b1t1-b1sel, #0
b2burst SNE.AB #69, b1probe
 JMP.B b3start, 0
 MOV.B b1probe, b2ptr
 ADD.AB #7849, b2ptr
 SLT.B b2ptr, #7753
 JMP.B b3start, 0
 ADD.AB #(151+b1probe-b2ptr), b2ptr
b2loop MOV.I b2bomb, @b2ptr
b2ptr MOV.I b2bomb, *0
 ADD.AB #6, b2ptr
b2cnt DJN.B b2loop, #17
 JMP.B b3start, 0
b2bomb DAT.F #-82, #0
b3start MOV.I b5pImp, b5pFeed+2390+68
b3fanStart SPL.B 1, 0
 SPL.B 1, 0
 MOV.I <b3sa, {b3va
 MOV.I <b3sa, {b3va
 MOV.I <b3vb, {b3vb
b3va DJN.B b3c0+3361+8-b3va, #4
 SPL.B *b3va, 0
b3vb JMP.B b3c1+2390+4-b3vb, b3c1+4-b3vb
b3sa DAT.F #0, b3c0+8-b3sa
b3c0
b4asInc SPL.B #3510, <b4asInc-3510
b4asAmov MOV.I {3510, <b4asLoop-3510-56
b4asBmov MOV.I b4asBomb, @-1
b4asAdd ADD.F b4asInc, -2
b4asLoop DJN.F @-1, *-3
b4asCmov MOV.I b4asBomb, >b4asInc-6
b4asCdjn DJN.F -1, >b4asInc-6
b4asBomb DAT.F <1, 56+1
b3c1
b5pFeed SPL.B #0, 0
b5pCarpet MOV.I b5pFeed+4+64, >b5pJump
b5pStep ADD.A #1144, b5pJump
b5pJump JMP.B b5pFeed+4+64-b5pJump-1144, b5pFeed+4+64-b5pJump
END
