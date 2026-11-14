;redcode-lp
;name Romulan R.O.U.S.
;author ZoreWars, from Philip Kendall and S. Fernandes
;strategy Run Romulan Warbird and R.O.U.S. in parallel with 32 blank cells between them.
;assert CORESIZE == 8000 && MAXPROCESSES == 8

        ORG launch
launch  SPL scan
        JMP paperLoop
        DAT 0, 0

; Romulan Warbird by Philip Kendall
step    equ     98
protect equ     (adjust-scan)
stream  equ     -1308
scan1   equ     (loop+step)

ptr     equ     (inc-2)
cstart  equ     (adjust+2-ptr)

inc     dat.f   (step*2),(step*2)
loop    add.f   inc,@x
scan    cmp.i   scan1+step,scan1
        slt.ab  #protect,@x
        djn.f   loop,<stream
        mov.i   jbomb,@scan
x       mov.i   sbomb,<scan
        add.f   adjust,scan
        jmn.a   @x,inc
sbomb   spl.a   #0,}ptr
clear   mov.i   dbomb,>ptr
jbomb   jmp.a   -1,}ptr
dbomb   dat.f   >2667,>cstart
adjust  dat.f   step,(step+1)

        FOR 32
        DAT 0, 0
        ROF

; R.O.U.S. by S. Fernandes
pstep   equ    6192
ipos    equ    5033
spos    equ    1319

paper   mov    #22          ,   #7
paperLoop    mov    <paper       ,   {pboot
         mov    >ipos        ,   {spos
         add.f  <0           ,   >0
        jmn    paperLoop         ,   *paperLoop
         spl    @paper       ,   >83
pboot   jmz    pstep        ,   *0

        END launch
