;name Scout
;author ZoreWars
;strategy A scanner. Instead of bombing blindly, it looks at cells 9 apart
;strategy and only attacks when it finds something non-empty. It skips
;strategy its own code by checking how far away the found cell is.

step    EQU     9
len     EQU     (fin+1-ptr)

        ORG     loop
ptr     DAT.F   #0, #len
bomb    DAT.F   #0, #0
loop    ADD.AB  #step, ptr      ; look a little further away
        JMZ.F   loop, @ptr      ; empty cell (both fields zero)? keep looking
        SLT.AB  #len, ptr       ; found something beyond our own code?
        JMP     loop            ;   no, it was us: keep looking
        MOV.I   bomb, @ptr      ;   yes: drop a DAT bomb on it
fin     JMP     loop
