;redcode
;name Scout '88
;author ZoreWars
;strategy Scout in ICWS'88: looks at every 9th cell and bombs the first one
;strategy that isn't empty. '88 JMZ tests only the B-field, so a cell with
;strategy a zero B-field counts as empty.

step    EQU     9
len     EQU     (fin+1-ptr)

ptr     DAT     #0, #len        ; next cell to look at, relative to ptr
bomb    DAT     #0, #0
loop    ADD     #step, ptr      ; look a little further away
        JMZ     loop, @ptr      ; empty (B-field zero)? keep looking
        SLT     #len, ptr       ; found something beyond our own code?
        JMP     loop            ;   no, it was us: keep looking
        MOV     bomb, @ptr      ;   yes: drop a DAT bomb on it
fin     JMP     loop
        END     loop
