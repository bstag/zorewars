;name Stone and Imp
;author ZoreWars, after the stone/imp combinations of the 1990s
;strategy Runs two warriors at once: a Dwarf-style stone and an Imp Ring.
;strategy If the stone gets killed, the imps usually survive and force a tie.

istep   EQU     (CORESIZE+1)/3  ; imp ring spacing (2667)

        ORG     start
start   SPL     stone           ; one process becomes the stone
; Same launcher as Imp Ring: 4 processes, 3 of them sent to the ring points.
        SPL.B   1, 0
        SPL.B   1, 0
        JMP.B   }tab, 0
tab     DAT.F   #1, #0
        JMP     imp
        JMP     imp+istep
        JMP     imp+2*istep
        DAT.F   #0, #0
imp     MOV.I   #0, istep
; The stone: a Dwarf. It gets one turn in four, because it shares the
; warrior's turns with the three imps.
stone   ADD.AB  #4, bomb
        MOV.I   bomb, @bomb
        JMP     stone
bomb    DAT.F   #0, #0
