;redcode
;name Genetic 88 4ab78c7a
;author ZoreWars Evolver
;assert CORESIZE == 8000
;strategy Seed 4242; 88; genotype 4ab78c7a92fb6639. Fresh-placement gain 0.292 points/round over the screening-selected starting baseline; see README.md.
start   SPL     $10, $0
        SPL     $1, $0
        SPL     $1, $0
        JMP     <1, $0
        DAT     #0, #4
        JMP     $-2663, $0
        JMP     $2669, $0
        JMP     $1, $0
        MOV     $0, $2667
        DAT     #0, #8
        MOV     $6, <-1
        MOV     $5, <-2
        MOV     $4, <-3
        MOV     $3, <-4
        ADD     #12, $-5
        JMP     $-5, $0
        DAT     #0, #0
        END     start
