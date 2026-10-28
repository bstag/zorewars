;redcode-94
;name Molting Fragments 4
;author ZoreWars Evolver
;strategy Experimental evolved clear fragments; relocation lost. Weak held-out results; retained for study.
        ORG     0
        SPL.B   $1, $0
        SPL.B   $9, $0
        MOV.AB  #-13, $9
        MOV.I   $9, >7
        DJN.B   $-1, $7
        MOV.AB  #4, $5
        MOV.AB  #-13, $5
        MOV.I   $6, >3
        DJN.B   $-1, $3
        JMP.B   $-4, $0
        DJN.B   $-1, $7
        MOV.AB  #-9, $5
        MOV.AB  #-13, $5
        MOV.I   $6, <3
        DJN.B   $-1, $3
        JMP.B   $-4, $0
        END
