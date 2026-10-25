;redcode-94
;name Evolved stream (kill reward)
;author ZoreWars Evolver (from scratch)
; PROTOTYPE (not in the library; see README.md in this folder).
; Champion of generation 10 of the second from-scratch run (evolve --scratch
; --ties 0.1: a tie with a champion counts a tenth, so champions must kill).
; Like Gremlin, from a different random start, it is a DJN stream: DJN.I #4,
; {-15 loops on itself while its pointer walks back through memory taking
; one off both fields of every cell. Ten instructions, one process. 1.91 on
; 40x20x10: Volume Queen, Plane Queen and Battleship 30-0, Leapfrog 29-1,
; Fast Silk 12-16; it ties Gremlin 30 rounds in 30. Run with --torus 40x20x10.
        ORG     1
        TRN.AB  $[6,-1,4], >[9,-9,-1]
        NOP.F   <[0,0,-5], $-12
        NOP.I   {0, >-2
        MUL.BA  $-15, }14
        DJN.I   #4, {-15
        SNE.X   }[4,8,0], $[0,0,-2]
        ADD.F   *[5,-3,0], $[17,-5,-1]
        SPL.AB  }-2, <-14
        TRN.B   $[0,0,-1], $0
        TRN.B   $1, $0
        END
