;name Mice
;author Chip Wendell (1986), adapted to ICWS'94 syntax
;strategy A replicator ("paper"). Copies its 8 instructions to a new spot,
;strategy starts a new process there with SPL, then repeats with a new
;strategy destination. Copies spread through the core faster than most
;strategy bombers can destroy them.

        ORG     start
ptr     DAT.F   #0, #0
start   MOV.AB  #12, ptr        ; number of cells to copy
loop    MOV.I   @ptr, <copy     ; copy one cell, last to first
        DJN.B   loop, ptr
        SPL.B   @copy, 0        ; start the new copy running
        ADD.AB  #653, copy      ; choose the next destination
        JMZ.B   start, ptr
copy    DAT.F   #0, #833
