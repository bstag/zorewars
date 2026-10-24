;redcode-94
;name PSwitch
;strategy Reads last round's result from P-space cell 0: if it lost, it
;strategy becomes an imp; if it won or tied, it plays a dwarf.
        ORG start
res     DAT.F   #0, #0
start   LDP.AB  #0, res
        JMZ.B   imp, res
dwarf   ADD.AB  #4, bomb
        MOV.I   bomb, @bomb
        JMP     dwarf
bomb    DAT.F   #0, #0
imp     MOV.I   #0, 1
