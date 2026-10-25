;redcode-94
;name Gremlin (ring)
;author ZoreWars Evolver (from scratch)
;strategy The evolved DJN stream of volume/gremlin.red, on the classic ring: one
;strategy instruction walks back through memory taking one off both fields of
;strategy every cell, breaking the exact arithmetic of clears and stones.
;
; Gremlin was evolved from random programs on the 40x20x10 volume (see
; warriors/volume/gremlin.red). Its strategy is classic ICWS'94 Redcode:
; lines 0-3 start processes, and line 13, DJN.F #10, {-10, is the stream
; (its pointer is line 3's A-field). Its 3D parts were leftovers: the TRN
; turned stray processes off into empty memory, and the vectors sat in lines
; that never matter. This version changes only those: each TRN is a NOP,
; and each vector is its x part. Everything else is exactly as evolved.
;
; On the ring it beats Two-Pass Clear 30-0, Vampire 28-1 and Dwarf 22-7,
; but scanners (Gatekeeper, Red Queen, Hedgehog) and papers beat it: 1.18
; points per round against the library and the classics.
        ORG     0
        SPL.B   $1, $0
        SPL.B   $11, $0
        SPL.B   $1, $0
        JMP.B   $5, $0
        NOP.F   @-7, {-16
        SLT.B   #9, }-3
        SLT.AB  >-5, *-6
        MUL.B   *-1, *-5
        MUL.A   *6, #11
        NOP.X   *-13, *12
        NOP.B   $0, $0
        ADD.X   }3, $-4
        ADD.X   #7, <-13
        DJN.F   #10, {-10
        MUL.X   {-10, >18
        JMZ.BA  *16, {15
        DAT.X   {7, #10
        DAT.X   $3, {0
        END
