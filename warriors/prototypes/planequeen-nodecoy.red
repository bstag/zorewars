;redcode-94
; PROTOTYPE (not in the library; see README.md in this folder).
; Plane Queen with its first SPL moved to the DAT at the end, so the decoy
; sprayer never runs. Result: the same score as Plane Queen (2.45 on
; 100x80, 2.35 on 40x20x10): the decoy adds nothing.
;name Plane Queen (no decoy)
;author ZoreWars Evolver (from Two-Pass Clear and Fast Silk, ZoreWars)
;strategy Found by "zorewars evolve --torus 100x80" (Red Queen rounds of MAP-Elites,
;strategy started from Two-Pass Clear, Papercut and Plane Silk as champions). A two-pass
;strategy core clear run by two processes, plus one decoy: the best warrior on the plane when added.
;
; Where it comes from: lines 3-10 are Two-Pass Clear unchanged, and lines
; 11-17 are Fast Silk's three-stream copy loop. Evolution put them together,
; added the launch lines, and lost the SPL that would start each copy, so
; the copy never runs: the loop leaves one inert fragment of the warrior
; (three cells) somewhere else as a decoy. It even uses the clear's DAT bomb
; (line 10) as its copy pointers. Its last JMP lands on that DAT, so the
; sprayer copies once and ends, which turns out to matter: a sprayer that
; kept looping would be caught by the clear's SPL 0 pass and fill the
; process queue, starving the clear (Volume Queen, its 3D port, sprays a
; counted number of decoys for that reason). So most of its edge over
; Two-Pass Clear is the clear run by two processes, which survives losing
; one, plus a decoy and a larger body. The comments were added afterwards;
; the instructions are exactly as evolved.
;
; On the plane: a clear's >ptr walks every cell row by row, so geometry can't
; hide anything from it, and the decoys give scanners and stones something
; else to hit.

        ORG     0
; ---- launch ----
        SPL.B   $17, $0         ; a process for the decoy sprayer
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

; ---- one decoy (Fast Silk's loop, without its SPL; the JMP ends in the DAT above) ----
        MOV.I   >-1, }-1        ; copy a cell from just here to the target...
        MOV.I   >-2, }-2        ; ...three per pass
        MOV.I   >-3, }-3
        ADD.A   #-3770, $3      ; next target: a new place on the plane
        MOV.F   $2, $-5         ; reset the pointers
        JMP.B   $-6, $0
        DAT.F   #-1290, #0      ; first target
        END
