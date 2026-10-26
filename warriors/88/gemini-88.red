;redcode
;name Gemini '88
;author ZoreWars, after A. K. Dewdney's Gemini (1984)
;strategy Gemini in ICWS'88: copies itself 100 cells ahead, one cell at a
;strategy time, then jumps into the copy. '88 has no post-increment modes,
;strategy so two ADDs move the read and write pointers.

hop     EQU     100
len     EQU     (last+1-src)

src     DAT     #0, #0          ; B-field: next cell to read, relative to src
dst     DAT     #0, #0          ; B-field: next cell to write, relative to dst
start   MOV     #0, src         ; the copy starts with fresh pointers
        MOV     #hop-1, dst     ; dst is one cell after src, so hop-1
loop    MOV     @src, @dst      ; copy one cell
        ADD     #1, src
        ADD     #1, dst
        CMP     #len, src       ; copied the whole program? skip the jump back
        JMP     loop
last    JMP     start+hop       ; run the copy
        END     start
