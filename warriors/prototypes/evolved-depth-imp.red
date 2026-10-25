;redcode-94
; PROTOTYPE (not in the library; see README.md in this folder).
; Champion of generation 1 of the first evolver run with TRN (40x20x10,
; from Volume Queen). It invented a depth imp: it copies MOV.I $0,$[0,0,1]
; into the cell one layer below a TRN $[0,0,1], so the turned process steps
; into the copy and keeps going through the layers, like Lift. Later
; champions dropped it.
;name Evolved depth imp
;author ZoreWars Evolver
;strategy Champion of Red Queen generation 1 (zorewars evolve): paper/stone hybrid, 8000 processes, 900 cells.
        ORG     0
        SPL.B   $16, $0
        SPL.B   $4, $0
        MOV.I   $2, $[1,0,1]
        TRN.B   $[0,0,1], $0
        MOV.I   $0, $[0,0,1]
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $[-11,-6,3], #0
        MOV.I   >-1, }-1
        MOV.I   >-2, }-2
        MOV.I   >-3, }-3
        ADD.A   #[-19,-4,-5], $3
        MOV.F   $2, $-5
        JMP.B   $-6, $0
        DAT.F   #[-11,-6,3], #0
        MOV.I   $2, @2
        JMP.B   $-2, $0
        DAT.F   #0, #0
        END
