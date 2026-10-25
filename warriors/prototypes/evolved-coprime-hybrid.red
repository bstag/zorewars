;redcode-94
; PROTOTYPE (not in the library; see README.md in this folder).
; Champion of generation 2 of an evolver run on 41x20x9 from scratch: a
; silk copier stepping by [-18,0,-2] plus a stone bombing every [14,-6,4],
; both through all three axes. Result: 2.05 there (Plane Queen 2.32). Run
; it with --torus 41x20x9.
;name Evolved 3-axis hybrid
;author ZoreWars Evolver
;strategy Champion of Red Queen generation 2 (zorewars evolve): paper/stone hybrid, 1953 processes, 180 cells.
        ORG     0
        SPL.B   $15, $0
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $[-6,5,4], #-4
        MOV.I   >-1, }-1
        MOV.I   $5, >6
        ADD.A   #[-18,0,-2], $4
        ADD.AB  #[12,7,4], $4
        MOV.F   $2, $-5
        JMP.B   $-6, $0
        DAT.F   #[-6,5,4], #0
        DAT.F   #0, #[11,-9,1]
        ADD.AB  #[14,-6,4], $5
        MOV.I   $4, @4
        DJN.B   $-2, #[15,4,1]
        MOV.I   $3, >-4
        JMP.B   $-1, $0
        END
