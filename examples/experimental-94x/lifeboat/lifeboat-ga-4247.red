;name Lifeboat 94x
;author ZoreWars
;strategy Booted guarded stone; independent watchdog takes over with a bounded clear.
; Parameters {"BOOT":0,"STEP":17224,"HOP":18000,"SHOTS":512,"BOMB":0,"BACKWARD":0,"PHASE":2,"STUN":64}
;assert CORESIZE == 55440
payloadSize EQU (payloadEnd-payload)
payloadEnd EQU (killBomb+1)
ORG launch
payload DAT.F #0, #payloadSize
shots DAT.F #0, #512
watchCount DAT.F #0, #1056
flag DAT.F #0, #0
stoneRef ADD.AB #17224, payload-stone
launch SPL.B stone, 0
watch SEQ.I stone, stoneRef
 JMP.B clearStart, 0
 JMN.B clearStart, flag
 DJN.B watch, watchCount
 JMP.B clearStart, 0
stone ADD.AB #17224, payload
 SLT.AB #(payloadSize-1), payload
 JMP.B tick, 0
attack MOV.I killBomb, @payload
tick DJN.B stone, shots
 MOV.AB #1, flag
retire DAT.F #0, #0
clearStart
 MOV.AB #(payloadEnd-clearPtr), clearPtr
 MOV.AB #(CORESIZE-payloadSize), remaining
stunLoop MOV.I stunBomb, >clearPtr
 DJN.B stunLoop, remaining
reset MOV.AB #(payloadEnd-clearPtr), clearPtr
 MOV.AB #(CORESIZE-payloadSize), remaining
killLoop MOV.I killBomb, >clearPtr
 DJN.B killLoop, remaining
 JMP.B reset, 0
clearPtr DAT.F #0, #0
remaining DAT.F #0, #0
stunBomb SPL.B #0, #0
killBomb DAT.F #0, #0
END
