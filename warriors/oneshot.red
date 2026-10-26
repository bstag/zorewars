;name One-Shot
;author ZoreWars, after one-shots such as Frontwards and Myrmidon
;strategy Scans until it finds the enemy once, then never scans again: it
;strategy stuns everything from just before the hit to the end of the core
;strategy with SPL 0, then goes over the same stretch again with DAT.

step    EQU     12              ; scan step
gap     EQU     6               ; distance between the two cells compared
count   EQU     (CORESIZE-2-gap-(last-scan))/step   ; scans before we'd see ourselves

last    EQU     (dat0+1)      ; one past our final instruction (pMARS drops labels after the last line)

        ORG     loop
cptr    DAT.F   #0, #0          ; clear pointer, relative to cptr
loop    ADD.F   inc, scan       ; move both scan pointers forward
scan    SEQ.I   last-scan-step, last-scan-step+gap  ; two cells identical?
        JMP     found           ;   no: that's the enemy
        DJN.B   loop, cnt       ;   yes: keep scanning, unless we've done a lap
        MOV.AB  #last-cptr, cptr  ; nothing found: clear from just after our code
        JMP     go
found   MOV.AB  scan, cptr      ; aim the clear at the hit (scan's A-field) ...
        ADD.AB  #scan-cptr-8, cptr  ; ... converted to be relative to cptr, minus 8
go      MOV.B   cptr, start     ; remember where the clear began (B-field to B-field)
        SPL     #0, 0           ; a swarm: every process runs the clear, so one hit can't stop it
stun    MOV.I   spl0, >cptr     ; pass 1: SPL 0 on each cell, then move on
        JMN.B   stun, cptr      ; until the pointer wraps round to cptr itself
        MOV.B   start, cptr     ; rewind to where we began
        SPL     #0, 0           ; a swarm for the DAT pass too
kill    MOV.I   dat0, >cptr     ; pass 2: DAT on each cell
        JMP     kill            ; ends by rewriting cptr forever, never reaching us
inc     DAT.F   #step, #step
cnt     DAT.F   #0, #count
start   DAT.F   #0, #0
spl0    SPL.B   #0, #0
dat0    DAT.F   #0, #0
