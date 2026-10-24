;name Dwarf
;author A. K. Dewdney (1984)
;strategy The classic "stone" (bomber). Drops a DAT bomb on every 4th cell.
;strategy Any process that executes a DAT dies. A step of 4 divides the
;strategy core size (8000) evenly, so the Dwarf never bombs its own code.

step    EQU     4

        ORG     loop
loop    ADD.AB  #step, bomb     ; move the target pointer forward
        MOV.I   bomb, @bomb     ; copy the bomb to where its B-field points
        JMP     loop
bomb    DAT.F   #0, #0
