;redcode
;name Mice
;author Chip Wendell (1986), adapted to ICWS'94 syntax
;strategy A replicator ("paper"). Copies its 8 instructions to a new spot,
;strategy starts a new process there with SPL, then repeats with a new
;strategy destination. Copies spread through the core faster than most
;strategy bombers can destroy them.
        DAT     #0, #0
start   MOV     #12, $-1
        MOV     @-2, <5
        DJN     $-1, $-3
        SPL     @3, $0
        ADD     #653, $2
        JMZ     $-5, $-6
        DAT     #0, #833
        END     start
