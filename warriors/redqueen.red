;redcode-94
;name Red Queen
;author Chip Wendell (Mice, 1986) and ZoreWars (Gatekeeper; combination found by the ZoreWars evolver)
;strategy A compare scanner and a slow replicator side by side: Gatekeeper
;strategy hunts, and a copy of Mice spreads in the background without
;strategy taking the scanner's turns. Our evolver came upon this pairing.
;
; Where it comes from. Our evolver ("zorewars evolve": Red Queen rounds of
; MAP-Elites, started from Hedgehog, Hydra and Fast Silk as champions) found
; this combination, but it invented neither half:
;   - Mice is Chip Wendell's replicator, winner of the first ICWS tournament
;     in 1986 (adapted for ZoreWars in mice.red). Its body is here unchanged.
;   - Gatekeeper is ZoreWars' compare scanner, which follows the line of
;     Wayne Sheppard's Iron Gate (1993) and Stefan Strack's Agony (1988/1994).
; What evolution contributed is putting them together, the three launch
; lines, and a leftover fragment at the end. The comments were added
; afterwards; the instructions are exactly as evolved.

        ORG     0
; ---- launch (evolved): one SPL per extra part ----
        SPL.B   $35, $0         ; a process to the leftover at the end
        SPL.B   $27, $0         ; a process to Mice
        JMP.B   $3, $0          ; this process runs Gatekeeper

; ---- Gatekeeper (ZoreWars): compare scanner, SPL carpets, two-pass clear ----
        DAT.F   #0, #0          ; imp gate
        DAT.F   #0, #0          ; clear pointer
        ADD.F   $16, $1         ; move both probes
        SEQ.I   $21, $29        ; two cells 8 apart identical?
        JMP.B   $8, $0          ;   no: carpet them
        DJN.B   $-3, $14        ;   yes: next pair
        MOV.AB  #23, $-5        ; lap done: clear from just past Gatekeeper
        MOV.I   $15, >-6        ; pass 1: SPL 0 everywhere
        JMN.B   $-1, $-7
        MOV.AB  #23, $-8
        MOV.I   $13, >-9        ; pass 2: DAT everywhere
        JMP.B   $-1, <-11       ; ...decrementing the imp gate
        MOV.AB  $-9, $8         ; carpet: aim at the find
        ADD.AB  #-23, $7
        MOV.AB  #22, $7
        MOV.I   $7, >5          ; 22 SPL 0 stun bombs
        DJN.B   $-1, $5
        JMP.B   $-12, $0        ; back to scanning
        DAT.F   #24, #24        ; probe step
        DAT.F   #0, #331        ; scan count
        DAT.F   #0, #0          ; carpet pointer
        DAT.F   #0, #0          ; carpet count
        SPL.B   #0, #0          ; the stun bomb
        DAT.F   #0, #0          ; the kill bomb

; ---- Mice (Chip Wendell, 1986): copy itself, start the copy, repeat ----
        DAT.F   #0, #0          ; copy pointer
        MOV.AB  #12, $-1        ; copy 12 cells...
        MOV.I   @-2, <5         ; ...one at a time, last cell first
        DJN.B   $-1, $-3
        SPL.B   @3, $0          ; start a process in the copy
        ADD.AB  #653, $2        ; next copy 653 cells further on
        JMZ.B   $-5, $-6        ; and again
        DAT.F   #0, #833        ; destination

; ---- leftover (evolved): writes two cells, then runs off into empty core ----
        MOV.I   $4, >-3
        MOV.I   $3, >-4
        ADD.AB  #12, $-5
        END
