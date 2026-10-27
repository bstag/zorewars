;redcode
;name Levy 88
;author ZoreWars
;assert CORESIZE == 8000
;strategy Fangs recruit captured enemy processes into a bounded backward clear; the original process only lays fangs.

base    DAT #0, #-1
inc     DAT #-99, #99
shift   DAT #1, #-1
go      ADD inc, fang
        MOV fang, @fang
        ADD shift, fang
        MOV fang, @fang
        ADD shift, fang
        MOV fang, @fang
        ADD shift, fang
        MOV fang, @fang
        JMP go
fang    JMP pit-(28-(fang-base)), 28-(fang-base)
pit     SLT #2048, base
        DAT #0, #0
        MOV bomb, <base
        JMP pit
bomb    DAT #0, #0
        END go
