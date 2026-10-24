;redcode-94
;name PCount
;strategy Keeps a round counter in P-space (index 505 wraps to 5) and picks
;strategy one of three strategies by counter mod 3. Uses odd modifiers.
        ORG start
cnt     DAT.F   #0, #0
start   LDP.A   #505, cnt
        ADD.BA  #1, cnt
        STP.A   cnt, #505
        MOV.X   cnt, cnt
        MOD.AB  #3, cnt
        JMZ.B   dwarf, cnt
        SEQ.AB  #1, cnt
        JMP     imp
        STP.BA  #7, cnt
paper   SPL     1
        MOV.I   -1, 0
        SPL     1
        JMP     clear
dwarf   ADD.AB  #4, bomb
        MOV.I   bomb, @bomb
        JMP     dwarf
bomb    DAT.F   #0, #0
imp     MOV.I   #0, 1
clear   MOV.I   bomb, >bomb
        DJN.F   clear, }-100
