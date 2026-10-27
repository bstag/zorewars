;redcode
;name Afterimage 88
;author ZoreWars
;assert CORESIZE == 8000
;strategy Tripwire-triggered moving clear with bounded source, destination and sweep pointers, verified landing, and a rebuilt prologue.

HOP equ 1536
src     DAT #0, #0
go      MOV mark, @watch
        MOV #last+1-ptr, ptr
sweep   SLT #last-ptr, ptr
        JMP move
        SLT ptr, #CORESIZE-(ptr-src)-1
        JMP move
        MOV last, @ptr
        ADD #1, ptr
        MOV last, @ptr
        ADD #1, ptr
        CMP mark, @watch
        JMP move
        JMP sweep
move    MOV #last+1-src, src
        MOV #HOP+last+1-dst, dst
copy    SLT #go+2-src, src
        JMP ready
        SLT src, #last+2-src
        JMP move
        SLT #last+1-dst, dst
        JMP move
        SLT dst, #CORESIZE-(dst-src)
        JMP move
        MOV <src, <dst
        JMP copy
ready   CMP #HOP+go+2-dst, dst
        JMP move
        MOV second, <dst
        MOV first, <dst
        JMP @dst
dst     DAT #0, #0
ptr     DAT #0, #0
watch   DAT #0, #go-watch+384
mark    DAT #0, #1
first   MOV mark-go, @watch-go
second  MOV #last+1-ptr, ptr-go-1
last    DAT #0, #0
        END go
