;redcode
;name Telltale 88
;author ZoreWars
;assert CORESIZE == 8000
;strategy Classify a zeroed word to choose SPL suppression or DAT killing. Redundant scan fuses and independent clear bounds protect the body.

base    DAT #0, #-512
go      JMP s0
s0      DJN s0, <base
contact CMP bomb, @base
        JMP setup

prepare MOV #-1, base
freeze    SLT #last+1-base+12, base
        JMP setup
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        MOV trap, <base
        JMP freeze
setup   MOV #-1, base
kill    SLT #last+1-base+12, base
        JMP idle
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        MOV bomb, <base
        JMP kill
idle    JMP setup
trap    SPL 0, 0
bomb    DAT #0, #0
fuse    DAT #0, #1
last    DAT #0, #1
        END go
