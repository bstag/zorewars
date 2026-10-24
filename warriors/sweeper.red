;name Sweeper
;author ZoreWars
;strategy A core clear. It walks forward through the whole core writing DAT
;strategy over every cell. When the sweep wraps around it lands on its own
;strategy pointer, rewrites it forever, and stops before hitting its own code.

        ORG     start
ptr     DAT.F   #0, #10         ; next cell to clear (relative to ptr)
start   MOV.I   bomb, >ptr      ; clear the cell, then advance the pointer
        JMP     start
bomb    DAT.F   #0, #0
