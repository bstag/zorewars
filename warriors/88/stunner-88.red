;redcode
;name Stunner '88
;author ZoreWars
;strategy Stunner in ICWS'88: drops SPL 0 bombs, which make every enemy
;strategy process that runs one split again and again, then clears the rest of
;strategy the core backward with DAT. '88 has no SPL #0, so the bomb is SPL 0, 0.

step    EQU     3048            ; a multiple of 8, so bombs never hit our own code
count   EQU     999

ptr     DAT     #0, #0          ; clear pointer: counts down from here
loop    ADD     #step, stun
        MOV     stun, @stun     ; drop an SPL 0 bomb
        DJN     loop, #count    ; repeat a fixed number of times
clear   MOV     last, <ptr      ; then clear backward with DAT bombs
        DJN     clear, #CORESIZE-(last+1-ptr)   ; every cell but our own
        JMP     0               ; done: wait here
stun    SPL     0, 0
last    DAT     #0, #0          ; the DAT bomb
        END     loop
