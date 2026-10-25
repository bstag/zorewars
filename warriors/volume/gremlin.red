;redcode-94
;name Gremlin
;author ZoreWars Evolver (from scratch)
;strategy Found by "zorewars evolve --scratch": random programs, no library code or
;strategy opponents, 20 generations on the 100x80 plane, then 12 on 40x20x10.
;strategy A DJN stream: it walks back through memory taking one off both fields
;strategy of every cell, which breaks the exact arithmetic of clears and scanners.
;
; Where it comes from: the evolver started from random instructions and
; scored them only against its own earlier champions. This is generation 8
; of the 3D run. Its ancestors on the plane were tie-farmers (they survived
; by not dying); this one nearly always lost to them, but against the
; library it beats Volume Queen 29-1, Volume Chameleon 26-3, Adapter 28-1,
; Plane Queen and Leapfrog 30-0 (1.91 points per round on 40x20x10).
;
; How it works: almost all of its time (79,971 of 80,000 cycles alone) is
; one instruction, DJN.F #10, {-10 (line 13). DJN with an immediate target
; jumps to itself, so it loops. Each pass, {-10 steps the A-field of line 3
; (JMP.B $5) one back and uses it as a pointer, and DJN.F takes one off
; both fields of the cell it points at. So a stream of "off by one" walks
; back through every cell. A clear depends on exact numbers (its pointer,
; its counter, its bombs): nudged by one, Volume Queen's clear writes over
; its own code and dies within a few hundred cycles. Papers are many
; redundant copies and shrug it off: it loses to them. The other lines are
; evolutionary leftovers that run a few times at the start, launching
; processes into the stream. Its strategy needs nothing 3D: warriors/gremlin.red
; is the same program for the classic ring (TRN made NOP, vectors cut to
; their x part). The comments were added afterwards; the instructions are
; exactly as evolved.
        ORG     0
        SPL.B   $1, $0
        SPL.B   $11, $0
        SPL.B   $1, $0
        JMP.B   $5, $0
        TRN.F   @[-7,2,0], {[-16,2,0]
        SLT.B   #9, }-3
        SLT.AB  >-5, *-6
        MUL.B   *-1, *-5
        MUL.A   *[6,6,-1], #[11,6,-5]
        NOP.X   *[-13,0,-2], *[12,-3,3]
        TRN.B   $[0,1,0], $0
        ADD.X   }[3,-5,0], $[-4,-3,0]
        ADD.X   #[7,-10,0], <[-13,-2,0]
        DJN.F   #10, {-10
        MUL.X   {[-10,4,0], >[18,5,0]
        JMZ.BA  *[16,-4,0], {[15,-2,0]
        DAT.X   {7, #[10,-5,0]
        DAT.X   $3, {[0,4,0]
        END
