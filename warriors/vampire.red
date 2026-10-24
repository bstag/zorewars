;name Vampire
;author ZoreWars, after the classic "vampire" design
;strategy Instead of DAT bombs, it drops JMP "fangs". A fang's A-field is
;strategy adjusted so that, wherever it lands, it jumps to the vampire's pit.
;strategy An enemy process that runs into a fang is pulled into the pit and
;strategy dies there.

        ORG     start
step    DAT.F   #-7, #7         ; A-field moves back, B-field moves forward
start   ADD.F   step, fang
        MOV.I   fang, @fang     ; drop the fang where its B-field points
        JMP     start
fang    JMP     pit, 0          ; A-field always points at the pit
pit     DAT.F   #0, #0          ; captured processes die here
