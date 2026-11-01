;redcode-94
;name Riptide
;author ZoreWars
;strategy Two 3-point imp spirals, 5000 cells apart, each fed new imps without
;strategy end. Built from ZoreWars' vector-spiral launcher
;strategy (tools/algebra/blocks/imps.js) with a SPL #0 pump in front, so a
;strategy spiral that is holed keeps getting fresh imps. For the 10-slot
;strategy ModelWar arena, where staying alive is what scores.

step    equ     2667            ; (CORESIZE+1)/3: three steps land one cell past the start
gap     equ     5000            ; distance of the second spiral

        org     boot
; Copy spiral B (8 cells) gap cells away, start it, then run spiral A here.
boot    mov     {src, {dst
        mov     {src, {dst
        mov     {src, {dst
        mov     {src, {dst
        mov     {src, {dst
        mov     {src, {dst
        mov     {src, {dst
        mov     {src, {dst
        spl     sb+gap          ; the copy of B
        jmp     sa
src     dat     #sb+8-src, 0    ; copy from the end of B backwards
dst     dat     #sb+8+gap-dst, 0

; Spiral A. Four processes sit in the pump; each pass every one of them sends
; out a jumper and an adder, in that order, so the jumpers land step apart and
; each pass starts a whole run of imps at once, where the last run ended.
sa      spl     1
        spl     1               ; 4 processes
pa      spl     #0, 0           ; the pump: one stays, one goes on, every pass
        spl     ada             ; a jumper, then an adder
        jmp     @vca            ; the jumper goes to the next spiral point
ada     add.ab  #step, vca      ; the adder moves the point on
vca     dat     #0, #ima-vca    ; adders die here
ima     mov.i   #1, step        ; the imp (A-field marks it as A's)

; Spiral B, the same with its own imp.
sb      spl     1
        spl     1
pb      spl     #0, 0
        spl     adb
        jmp     @vcb
adb     add.ab  #step, vcb
vcb     dat     #0, #imb-vcb
imb     mov.i   #2, step
