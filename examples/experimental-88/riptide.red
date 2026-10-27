;redcode
;name Riptide 88
;author ZoreWars
;assert CORESIZE == 8000
;strategy B-field corruption followed by DAT killing. Redundant scan fuses and independent clear bounds protect the body.

base    DAT #0, #-1024
go      JMP s0
s0      DJN s0, <base

setup   MOV #-1, base
kill    SLT #last+1-base+8, base
        JMP idle
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        JMP kill
idle    JMP idle
trap    SPL 0, 0
bomb    DAT #0, #0
fuse    DAT #0, #1
last    DAT #0, #1
        END go
