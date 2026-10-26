;redcode
;name Dwarf
;author A. K. Dewdney (1984)
;strategy The classic "stone" (bomber). Drops a DAT bomb on every 4th cell.
;strategy Any process that executes a DAT dies. A step of 4 divides the
;strategy core size (8000) evenly, so the Dwarf never bombs its own code.
start   ADD     #4, $3
        MOV     $2, @2
        JMP     $-2, $0
        DAT     #0, #0
        END     start
