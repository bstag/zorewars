;redcode-94
;name Genetic volume-cube 16dc14c7
;author ZoreWars Evolver
;assert CORESIZE == 8000 && SIZEX == 20 && SIZEY == 20 && SIZEZ == 20
;strategy Seed 4242; volume-cube; genotype 16dc14c774b6d933. Fresh-placement gain 0.328 points/round over the screening-selected starting baseline; see README.md.
        ORG     0
        SPL.B   $1, $0
        JMP.B   $2, $0
        DAT.F   #0, #8
        MOV.I   $5, >-1
        DJN.B   $-1, #-8
        MOV.AB  #8, $-3
        MOV.I   $3, >-4
        JMP.B   $-1, $0
        SPL.B   #0, #[0,0,-7]
        DAT.F   #0, #0
        END
