;name Stunner
;author ZoreWars
;strategy Bombs with SPL 0 instead of DAT. An enemy that executes SPL 0
;strategy keeps splitting into useless copies of itself, so its real code
;strategy gets almost no turns. After stunning, a DAT sweep finishes it off.

step    EQU     3048            ; a multiple of 8, so bombs never hit our own code
count   EQU     999

        ORG     loop
ptr     DAT.F   #0, #8          ; sweep pointer, starts just past our code
loop    ADD.AB  #step, stun
        MOV.I   stun, @stun     ; drop an SPL 0 bomb
        DJN.B   loop, #count    ; repeat a fixed number of times
clear   MOV.I   kill, >ptr      ; then sweep the whole core with DAT bombs
        JMP     clear
stun    SPL.B   #0, #0
kill    DAT.F   #0, #0
