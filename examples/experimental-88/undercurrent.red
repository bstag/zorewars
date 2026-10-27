;redcode
;name Undercurrent 88
;author ZoreWars
;assert CORESIZE == 8000
;strategy Pure B-field sabotage with two matching end markers. Either marker can stop a lap when the other is destroyed.

base    DAT #0, #-1024
go      DJN go, <base
        CMP tagword, @base
        JMP go
reset   MOV #1, fuse
        MOV #1, last
        MOV #-1024, base
        JMP go
tagword DAT #3141, #0
fuse    DAT #3141, #1
last    DAT #3141, #1
        END go
