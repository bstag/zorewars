;redcode
;name Vampire
;author ZoreWars, after the classic "vampire" design
;strategy Instead of DAT bombs, it drops JMP "fangs". A fang's A-field is
;strategy adjusted so that, wherever it lands, it jumps to the vampire's pit.
;strategy An enemy process that runs into a fang is pulled into the pit and
;strategy dies there.
        DAT     #-7, #7
start   ADD     $-1, $3
        MOV     $2, @2
        JMP     $-2, $0
        JMP     $1, $0
        DAT     #0, #0
        END     start
