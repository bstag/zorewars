;name Twin Silk
;author ZoreWars
;strategy Two Silk papers started side by side, each with its own copy distance
;strategy and drift, so one clear or bomb run can't stop both. Built for
;strategy many-warrior games, where the points go to whoever is still alive.

        ORG     start
start   SPL     b               ; one process starts paper B, one stays for A
        SPL     1               ; 1 process -> 2
        SPL     1               ; 2 -> 4
        SPL     1               ; 4 -> 8, all lined up at 'asilk'
; Paper A: the same loop as Silk. A-field = where the copy goes, B-field = next cell to read.
asilk   SPL     718, #0         ; each of the 8 processes starts one in the copy
        MOV.I   >asilk, }asilk  ; each copies one cell: 8 processes, 8 cells
        ADD.A   #725, aseed     ; choose a new distance for the next copy
        MOV.F   aseed, asilk    ; reset both pointers for the next pass
        JMP     asilk           ; and replicate again
aseed   DAT.F   #718, #0
; Paper B: another 8 processes, a long first jump and a large drift.
b       SPL     1
        SPL     1
        SPL     1
bsilk   SPL     4315, #0
        MOV.I   >bsilk, }bsilk
        ADD.A   #3173, bseed
        MOV.F   bseed, bsilk
        JMP     bsilk
bseed   DAT.F   #4315, #0
