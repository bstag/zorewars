;name Duet v1
;author ZoreWars
;strategy switch-score(boot(sweep),boot(tail-silk))
;strategy A score-box switcher over two booted arms: a sweep scanner tuned against silk papers,
;strategy and a tail-silk paper that ties what the sweep cannot beat.
;assert CORESIZE==25200
ORG b0start
b0start LDP.AB #21, b0tmp
 SEQ.AB #1931, b0tmp
 JMP.B b0reset, 0
 LDP.AB #0, b0res
 LDP.AB #20, b0last
 MOD.AB #2, b0last
 MOV.B b0last, b0ptr
 ADD.AB #22, b0ptr
 LDP.B b0ptr, b0sc
 JMZ.B b0loss, b0res
 DJN.B b0tie, b0res
 ADD.AB #1, b0sc
 JMP.B b0clear, 0
b0tie LDP.AB #24, b0stk
 ADD.AB #1, b0stk
 SLT.AB #3, b0stk
 JMP.B b0tieok, 0
 JMP.B b0loss, 0
b0tieok STP.B b0stk, #24
 ADD.AB #0, b0sc
 JMP.B b0store, 0
b0loss ADD.AB #-1, b0sc
b0clear STP.AB #0, #24
b0store STP.B b0sc, b0ptr
 ADD.AB #1, b0sc
 MOV.B b0last, b0pick
 LDP.AB #22, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0next0, 0
 MOV.AB #0, b0pick
 MOV.B b0cand, b0sc
b0next0
 LDP.AB #23, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0finish, 0
 MOV.AB #1, b0pick
 MOV.B b0cand, b0sc
b0finish STP.B b0pick, #20
 ADD.AB #b0table-b0pick, b0pick
 JMP.B @b0pick, 0
b0reset STP.AB #1931, #21
 STP.AB #12600, #22
 STP.AB #12600, #23
 STP.AB #0, #24
 MOV.AB #0, b0pick
 JMP.B b0finish, 0
b0tmp DAT.F #0, #0
b0res DAT.F #0, #0
b0last DAT.F #0, #0
b0ptr DAT.F #0, #0
b0sc DAT.F #0, #0
b0cand DAT.F #0, #0
b0pick DAT.F #0, #0
b0stk DAT.F #0, #0
b0table JMP.B b1boot, 0
 JMP.B b3boot, 0
b2cp DAT.F $0, $b2cb+1-b2cp
b2trip DAT.F $0, $0
b2one DAT.F $1, $1
b2p DAT.F #5926, #5935
b2pad0 DAT.F $0, $0
b2pad1 DAT.F $0, $0
b2pad2 DAT.F $0, $0
b2loop ADD.F b2st, b2p
 SEQ.I *b2p, @b2p
 JMP.B b2hit, 0
 ADD.F b2st, b2p
 SEQ.I *b2p, @b2p
 JMP.B b2hit, 0
b2lap DJN.B b2loop, #4284
 JMP.B b2clr, 0
b2hit SLT.AB #77-(b2p-b2cp)+18, b2p
 JMP.B b2lap, 0
 MOV.AB #9, b2c
 ADD.AB #5, b2p
b2wipe MOV.I b2st, <b2p
 MOV.I b2st, <b2p
b2c DJN.B b2wipe, #0
 ADD.AB #13, b2p
 JMP.B b2lap, 0
b2clr SPL.B #0, $0
b2cl MOV.I b2cb, >b2cp
 DJN.F b2cl, {b2cp
 JMP.B b2cl, 0
b2st SPL.B #12719, $12719
b2cb DAT.F $0, $b2cb+1-b2cp
b1boot MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 MOV.I -30, 12570
 JMP.B b2loop+12600, 0
b4tStart SPL.B 1, 0
 SPL.B 1, 0
 SPL.B 1, 0
b4t0 SPL.B 3039, #0
 MOV.I >b4t0, }b4t0
 MOV.I <b4t0, {b4t1
b4t1 SPL.B 1607, #0
b4tDrop MOV.I #3287, }3287
b4tCarpet MOV.I b4tBomb, >2376
b4tBomb DAT.F <3287, <6574
b3boot MOV.I <b3copyFrom, <b3copyTo
 DJN.B b3boot, b3copyCount
 JMP.B b4tStart+12600, 0
b3copyFrom DAT.F #0, #-3
b3copyTo DAT.F #0, #12596
b3copyCount DAT.F #0, #10
END
