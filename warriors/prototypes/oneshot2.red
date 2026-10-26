;redcode-94
; PROTOTYPE (not in the library; see README.md in this folder). Classic ring.
; Result: 1.17 against the ring field (One-Shot 1.20, Oneshot '88 2.19):
; beats Dwarf 18-2 and Two-Pass Clear 20-0, loses to scanners (Gatekeeper
; 0-19, Red Queen 1-19). Going backward wasn't Oneshot '88's edge on the ring:
; its clear is a self-multiplying SPL 0 swarm, in 10 instructions.
;name One-Shot II
;author ZoreWars
;strategy Backward one-shot: scans down through the core, two cells a pass;
;strategy at the first find it lays SPL 0 / JMP -1 traps from just above the
;strategy find down to us, then DATs everywhere, lap after lap.
;
; What changed from One-Shot (ideas from Oneshot '88 and ULTIMA RATIO REGUM,
; hill warriors whose fronts come the other way): the scan and the clear run
; backward (predecrement pointers), the traps are SPL 0 / JMP -1 pairs, and
; the passes are counted so the clear never runs into its own code and can
; repeat for the whole round.

step    EQU     12              ; scan step
gap     EQU     6               ; distance between the two cells compared
len     EQU     (last-cptr)
count   EQU     (CORESIZE-len-gap-step)/step   ; scans in a lap that miss us
last    EQU     (left+1)

        ORG     loop
cptr    DAT.F   #0, #0          ; the clear's pointer (counts down)
loop    SUB.F   inc, scan       ; both scan pointers one step further down
scan    SEQ.I   cptr-scan, cptr-scan-gap   ; two cells identical?
        JMP     found           ;   no: something is there
        DJN.B   loop, cnt       ;   yes: keep scanning, unless a lap is done
        JMP     lap             ; nothing found: clear the lot
found   MOV.AB  scan, cptr      ; aim the clear at the find (scan's A-field)...
        ADD.AB  #scan-cptr+9, cptr   ; ...relative to cptr, a little above it
        MOV.B   cptr, left      ; pass 1 runs from there down to just short of us:
        ADD.AB  #CORESIZE-len, left  ; (CORESIZE - len) + aim cells,
        DIV.AB  #2, left        ; two to a pass
        JMP     pass1
lap     MOV.AB  #0, cptr        ; a full lap: from just behind cptr
        MOV.AB  #(CORESIZE-len)/2, left
pass1   MOV.I   spl0, <cptr     ; traps, walking backward
        MOV.I   jmp1, <cptr
        DJN.B   pass1, left
        MOV.AB  #0, cptr
        MOV.AB  #CORESIZE-len, left
pass2   MOV.I   dat0, <cptr     ; DATs everywhere but us
        DJN.B   pass2, left
        JMP     lap             ; and again
inc     DAT.F   #step, #step
cnt     DAT.F   #0, #count
spl0    SPL.B   #0, #0
jmp1    JMP.B   $-1, $0
dat0    DAT.F   #0, #0
left    DAT.F   #0, #0
        END
