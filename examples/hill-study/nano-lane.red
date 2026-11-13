;redcode-nano
;name Nano Lane
;author ZoreWars
;strategy Scan one residue class, sharing the scan's B-field with the attack.
;assert CORESIZE == 80 && MAXLENGTH == 5

        ORG     look
advance ADD.AB  #5, look
look    JMZ.F   advance, @43
attack  MOV.I   bomb, @look
        JMP.B   advance
bomb    DAT.F   $0, $0
        END
