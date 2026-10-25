;redcode-94
;name Plane Queen
;author ZoreWars Evolver (from Two-Pass Clear and Fast Silk, ZoreWars)
;strategy Found by "zorewars evolve --torus 100x80" (Red Queen rounds of MAP-Elites,
;strategy started from Two-Pass Clear, Papercut and Plane Silk as champions). A two-pass
;strategy core clear plus a decoy sprayer: the best warrior on the plane when added.
;
; Where it comes from: lines 3-10 are Two-Pass Clear unchanged, and lines
; 11-17 are Fast Silk's three-stream copy loop. Evolution put them together,
; added the launch lines, and lost the SPL that would start each copy, so
; the copies never run: the loop sprays inert fragments of the warrior across
; the plane (decoys) while the clear does the killing. It even uses the
; clear's DAT bomb (line 10) as its copy pointers. The comments were added
; afterwards; the instructions are exactly as evolved.
;
; On the plane: a clear's >ptr walks every cell row by row, so geometry can't
; hide anything from it, and the decoys give scanners and stones something
; else to hit.

        ORG     0
; ---- launch ----
        SPL.B   $11, $0         ; a process for the decoy sprayer
        SPL.B   $1, $0          ; two processes for the clear
        JMP.B   $2, $0

; ---- Two-Pass Clear (ZoreWars): SPL 0 everywhere, then DAT everywhere ----
        DAT.F   #0, #8          ; clear pointer
        MOV.I   $5, >-1         ; pass 1: SPL 0
        DJN.B   $-1, #-8
        MOV.AB  #8, $-3
        MOV.I   $3, >-4         ; pass 2: DAT
        JMP.B   $-1, $0
        SPL.B   #0, #0          ; the stun bomb
        DAT.F   #0, #0          ; the kill bomb; also the sprayer's pointers (A: write, B: read)

; ---- decoy sprayer (Fast Silk's loop, without its SPL) ----
        MOV.I   >-1, }-1        ; copy a cell from just here to the target...
        MOV.I   >-2, }-2        ; ...three per pass
        MOV.I   >-3, }-3
        ADD.A   #-3770, $3      ; next target: a new place on the plane
        MOV.F   $2, $-5         ; reset the pointers
        JMP.B   $-6, $0
        DAT.F   #-1290, #0      ; first target
        END
