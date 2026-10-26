;redcode
;name Imp
;author A. K. Dewdney (1984)
;strategy The smallest program that never dies. It copies itself one cell
;strategy forward, then executes that copy, crawling around the core forever.
;strategy It rarely wins, but it is very hard to kill, so it forces ties.
start   MOV     $0, $1
        END     start
