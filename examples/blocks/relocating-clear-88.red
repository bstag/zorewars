;name Blocks 88
;author ZoreWars
;strategy {"OPENING":1,"RELOCATE":1,"BACKWARD":0,"PHASE":1,"WAIT":128,"STEP":997,"HOP":4096,"STUN":64}
;assert CORESIZE==8000
payloadSize EQU (payloadEnd-payload)
payloadEnd EQU (clearKill+1)
; block opening-state
probe DAT #0, #MAXLENGTH
clock DAT #0, #128
; block opening-bomber
opening ADD #997, probe
 SLT #(MAXLENGTH-1), probe
 JMP tick, 0
attackWrite MOV clearKill, @probe
tick DJN opening, clock
; block relocate-copy
transition MOV <copySource, <copyTarget
 DJN transition, copyCount
 JMP @copyTarget, 0
copySource DAT #0, #(payloadEnd-copySource)
copyTarget DAT #0, #(probe+4096+payloadSize-copyTarget)
copyCount DAT #0, #payloadSize
; block clear-stun-dat
payload MOV #(payloadEnd-clearPtr), clearPtr
 MOV #64, remaining
stunLoop MOV clearStun, @clearPtr
 ADD #1, clearPtr
 DJN stunLoop, remaining
resetKill MOV #(payloadEnd-clearPtr), clearPtr
 MOV #(CORESIZE-payloadSize), remaining
killLoop MOV clearKill, @clearPtr
 ADD #1, clearPtr
 DJN killLoop, remaining
 JMP resetKill, 0
clearPtr DAT #0, #0
remaining DAT #0, #0
clearStun SPL 0, #0
clearKill DAT #0, #0
END opening
