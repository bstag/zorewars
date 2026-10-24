;name Seeker
;author ZoreWars
;strategy A SEQ scanner with a core clear. It compares two cells 6 apart;
;strategy anything other than a matching pair of empty cells means an enemy
;strategy is near, and both cells get an SPL 0 "stun" bomb. After one lap of
;strategy the core it sweeps everything with DAT to finish stunned enemies.

step    EQU     12              ; how far the scan moves each time
gap     EQU     6               ; distance between the two cells compared
count   EQU     (CORESIZE-2-gap-(last-scan))/step   ; scans before we'd see ourselves

last    EQU     (kill+1)      ; one past our final instruction (pMARS drops labels after the last line)

        ORG     loop
cptr    DAT.F   #0, #last-cptr  ; clear pointer: starts just after our code
loop    ADD.F   inc, scan       ; move both scan pointers forward by step
scan    SEQ.I   last-scan-step, last-scan-step+gap  ; two cells identical?
        JMP     hit             ;   no: something is there
next    DJN.B   loop, cnt       ;   yes (empty): keep scanning until done
clear   MOV.I   kill, >cptr     ; scan over: write DAT on every cell after us
        JMP     clear
hit     MOV.I   stun, *scan     ; stun-bomb the first cell compared
        MOV.I   stun, @scan     ; and the second
        JMP     next
inc     DAT.F   #step, #step    ; added to both of scan's fields
cnt     DAT.F   #0, #count      ; scans left
stun    SPL.B   #0, #0          ; an enemy running this splits forever, uselessly
kill    DAT.F   #0, #0
