;name Blocks 94x
;author ZoreWars
;strategy {"OPENING":1,"RELOCATE":1,"BACKWARD":0,"PHASE":1,"WAIT":128,"STEP":997,"HOP":4096,"STUN":64}
;assert CORESIZE==55440
payloadSize EQU (payloadEnd-payload)
payloadEnd EQU (clearKill+1)
ORG opening
; block opening-state
probe DAT.F #0, #MAXLENGTH
clock DAT.F #0, #128
; block opening-bomber
opening ADD.AB #997, probe
 SLT.AB #(MAXLENGTH-1), probe
 JMP.B tick, 0
attackWrite MOV.I clearKill, @probe
tick DJN.B opening, clock
; block relocate-copy
transition MOV.I <copySource, <copyTarget
 DJN.B transition, copyCount
 JMP.B @copyTarget, 0
copySource DAT.F #0, #(payloadEnd-copySource)
copyTarget DAT.F #0, #(probe+4096+payloadSize-copyTarget)
copyCount DAT.F #0, #payloadSize
; block clear-stun-dat
payload MOV.AB #(payloadEnd-clearPtr), clearPtr
 MOV.AB #64, remaining
stunLoop MOV.I clearStun, >clearPtr
 DJN.B stunLoop, remaining
resetKill MOV.AB #(payloadEnd-clearPtr), clearPtr
 MOV.AB #(CORESIZE-payloadSize), remaining
killLoop MOV.I clearKill, >clearPtr
 DJN.B killLoop, remaining
 JMP.B resetKill, 0
clearPtr DAT.F #0, #0
remaining DAT.F #0, #0
clearStun SPL.B 0, #0
clearKill DAT.F #0, #0
END
