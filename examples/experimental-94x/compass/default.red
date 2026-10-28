;name Compass
;author ZoreWars
;strategy Comparison scan, explicit clear phases, independent boot/decoy layout
;recipe {"BOOT":1,"HOP":18000,"STEP":997,"GAP":7,"START":512,"SCANS":64,"PHASE":1,"STUN":32,"DECOYS":12,"DECOY":1}
;assert CORESIZE==55440
ORG boot
probe DAT.F #512, #519
clock DAT.F #0, #64
stride DAT.F #997, #997
remaining DAT.F #0, #32
scan ADD.F stride, probe
 SLT.AB #25, probe
 JMP.B tick, 0
 SLT.A #25, probe
 JMP.B tick, 0
compare SNE.I *probe, @probe
 JMP.B tick, 0
 JMP.B found, 0
tick DJN.B scan, clock
 MOV.A #26, probe
found MOV.AB probe, probe
 MOV.AB #32, remaining
stunGuard SLT.AB #25, probe
 MOV.AB #26, probe
stunWrite MOV.I stunBomb, >probe
 DJN.B stunGuard, remaining
killGuard SLT.AB #25, probe
 MOV.AB #26, probe
killWrite MOV.I killBomb, >probe
 JMP.B killGuard, 0
stunBomb SPL.B #0, #0
killBomb DAT.F #0, #0
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
 SPL.B #1, #1
boot MOV.I <copyFrom, <copyTo
 DJN.B boot, copyCount
 JMP.B probe+18000+scan-probe, 0
copyFrom DAT.F #0, #(probe+26-copyFrom)
copyTo DAT.F #0, #(probe+18000+26-copyTo)
copyCount DAT.F #0, #26
END
