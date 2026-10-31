;redcode-94
;name Riptide
;author ZoreWars
;strategy Phase-disjoint dual 3-point imp spiral launcher (half=3600, scratch=889)
;strategy tuned against quickscanners and enemy 3-point imp spirals for 10-slot Arena.
;assert CORESIZE == 8000

        istep   equ 2667
        half    equ 3600
        scratch equ 889
        istart  equ 1-4*istep

        org     boot

boot    spl     1,          {scratch
        spl     1,          {scratch
split   spl     L1+half,    L2
        mov     >split,     }split

L1      spl     #0,         >2
        add.f   #istep,     1
        jmp     istart,     {scratch
        mov.i   #istep/2,   istep

        for     14
        dat     0,          0
        rof

L2      spl     #0,         >2
        add.f   #istep,     1
        jmp     istart,     {scratch
        mov.i   #istep,     *0

        for     70
        dat     0,          0
        rof

        end
