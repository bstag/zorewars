;redcode
;name Imp Ring '88
;author ZoreWars, after the imp rings of the 1990s
;strategy Imp Ring in ICWS'88: three imps a third of the core apart, each
;strategy copying itself onto the next point just before that one runs. The
;strategy launcher sends four processes through a table with JMP <tab: each
;strategy one takes the next entry down, the fourth dies on the DAT.

step    EQU     (CORESIZE+1)/3  ; 2667: three steps = 8001, one cell past the start

start   SPL     1               ; 1 process becomes 2, both at the next line
        SPL     1               ; 2 become 4
        JMP     <tab            ; take one off tab's B-field, jump to tab+B
tab     DAT     #0, #4          ; process 4 arrives here and dies
        JMP     imp+2*step      ; process 3 -> ring point 2 (empty for now)
        JMP     imp+step        ; process 2 -> ring point 1 (empty for now)
        JMP     imp             ; process 1 -> ring point 0
imp     MOV     0, step         ; copy myself one third of the core ahead
        END     start
