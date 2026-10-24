;redcode-94
;name Evolved Silk
;author ZoreWars Evolver
;strategy A silk paper bred by "zorewars evolve" (Red Queen rounds of MAP-Elites)
;strategy from slices of ZoreWars bots. Nobody wrote it: evolution rebuilt a
;strategy classic silk, with a copy distance that changes on every pass.
;
; It came out of the evolver's archive cell for warriors that reach the
; 8000-process limit and execute 1000-3999 different cells. The comments were
; added afterwards; the instructions are exactly as evolved.

        ORG     0
; Launcher: SPL 1 doubles the processes that run the following lines.
        SPL.B   $1, $0
        SPL.B   $2, $0          ; skips the next line for half of them
        SPL.B   $31, $0         ; a leftover of evolution: starts a process in
                                ; empty core, where it dies at once. Harmless.
        SPL.B   $1, $0
        SPL.B   $1, $0
        SPL.B   $1, $0
; The silk: every process runs these lines in step, so each pass copies one
; cell per process to 1777 cells away and starts the copy running.
silk    SPL.B   $1777, #0       ; start a process at the copy
        MOV.I   >-1, }-1        ; copy one cell of ourselves there
        ADD.A   #1013, seed     ; next time, copy 1013 cells further away
        MOV.F   seed, silk      ; reset silk's pointers from the seed
        JMP     silk
seed    DAT.F   #1777, #0
        END
