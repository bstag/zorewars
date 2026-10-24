;name Silk
;author ZoreWars, after the "silk" papers of the mid-1990s
;strategy A fast replicator. Eight processes run the same code in lockstep:
;strategy each one copies one cell of the program and starts a process in the
;strategy new copy, so a whole copy is made in a single pass. Every copy
;strategy repeats this, so the number of copies doubles again and again.

step    EQU     1777            ; distance to the first copy
delta   EQU     1013            ; how much the distance changes each time

        ORG     start
start   SPL     1               ; 1 process -> 2
        SPL     1               ; 2 -> 4
        SPL     1               ; 4 -> 8, all lined up at 'silk'
; silk's A-field is where the copy goes; its B-field is the next cell to read.
silk    SPL     step, #0        ; each of the 8 processes starts one in the copy
        MOV.I   >silk, }silk    ; each copies one cell: 8 processes, 8 cells
        ADD.A   #delta, seed    ; choose a new distance for the next copy
        MOV.F   seed, silk      ; reset both pointers for the next pass
        JMP     silk            ; and replicate again
seed    DAT.F   #step, #0       ; A: next copy distance, B: read from cell 0
