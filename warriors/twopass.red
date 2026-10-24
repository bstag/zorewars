;name Two-Pass Clear
;author ZoreWars
;strategy Sweeps the whole core twice. The first pass writes SPL 0, which
;strategy makes any enemy process that touches it split uselessly; the second
;strategy pass writes DAT, which kills every process still running.

len     EQU     (last-ptr)

last    EQU     (kill+1)      ; one past our final instruction (pMARS drops labels after the last line)

        ORG     start
ptr     DAT.F   #0, #len        ; next cell to write, starting just past our code
start   MOV.I   stun, >ptr      ; pass 1: write an SPL 0 and move on
        DJN.B   start, #CORESIZE-len  ; one write per cell that isn't us
        MOV.AB  #len, ptr       ; rewind the pointer
clear   MOV.I   kill, >ptr      ; pass 2: write a DAT and move on
        JMP     clear           ; stops on its own: when the pointer comes back
;                                 around to ptr it keeps rewriting ptr itself
stun    SPL.B   #0, #0
kill    DAT.F   #0, #0
