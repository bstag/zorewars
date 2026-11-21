;name Trio v2
;author ZoreWars
;strategy switch-score(boot(sweep),boot(twin-scan,decoy-field),boot(tail-silk))
;strategy A score-box switcher over three booted arms, tuned against the ladder and three silk and switcher
;strategy rivals: a sweep and a twin-scan that beat different silks, and tail-silk for ties.
;assert CORESIZE==25200
ORG b0start
b0start LDP.AB #21, b0tmp
 SEQ.AB #1931, b0tmp
 JMP.B b0reset, 0
 LDP.AB #0, b0res
 LDP.AB #20, b0last
 MOD.AB #3, b0last
 MOV.B b0last, b0ptr
 ADD.AB #22, b0ptr
 LDP.B b0ptr, b0sc
 JMZ.B b0loss, b0res
 DJN.B b0tie, b0res
 ADD.AB #1, b0sc
 JMP.B b0clear, 0
b0tie LDP.AB #25, b0stk
 ADD.AB #1, b0stk
 SLT.AB #1, b0stk
 JMP.B b0tieok, 0
 JMP.B b0loss, 0
b0tieok STP.B b0stk, #25
 ADD.AB #0, b0sc
 JMP.B b0store, 0
b0loss ADD.AB #-1, b0sc
b0clear STP.AB #0, #25
b0store STP.B b0sc, b0ptr
 ADD.AB #0, b0sc
 MOV.B b0last, b0pick
 LDP.AB #22, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0next0, 0
 MOV.AB #0, b0pick
 MOV.B b0cand, b0sc
b0next0
 LDP.AB #23, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0next1, 0
 MOV.AB #1, b0pick
 MOV.B b0cand, b0sc
b0next1
 LDP.AB #24, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0finish, 0
 MOV.AB #2, b0pick
 MOV.B b0cand, b0sc
b0finish STP.B b0pick, #20
 ADD.AB #b0table-b0pick, b0pick
 JMP.B @b0pick, 0
b0reset STP.AB #1931, #21
 STP.AB #12600, #22
 STP.AB #12600, #23
 STP.AB #12600, #24
 STP.AB #0, #25
 MOV.AB #2, b0pick
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
 JMP.B b6boot, 0
b2cp DAT.F $0, $b2cb+1-b2cp
b2trip DAT.F $0, $0
b2one DAT.F $1, $1
b2p DAT.F #5926, #5935
b2loop ADD.F b2st, b2p
 SEQ.I *b2p, @b2p
 JMP.B b2hit, 0
 ADD.F b2st, b2p
 SEQ.I *b2p, @b2p
 JMP.B b2hit, 0
b2lap DJN.B b2loop, #4284
 JMP.B b2clr, 0
b2hit SLT.AB #395-(b2p-b2cp)+20, b2p
 JMP.B b2lap, 0
 MOV.AB #10, b2c
 ADD.AB #0, b2p
b2wipe MOV.I b2st, <b2p
 MOV.I b2st, <b2p
b2c DJN.B b2wipe, #0
 ADD.AB #20, b2p
 JMP.B b2lap, 0
b2clr SPL.B #0, $0
b2cl MOV.I b2cb, >b2cp
 DJN.F b2cl, {b2cp
 JMP.B b2cl, 0
b2st SPL.B #12719, $12719
b2cb DAT.F $0, $b2cb+1-b2cp
b1boot MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 MOV.I -27, 12573
 JMP.B b2loop+12600, 0
b4cp DAT.F $3, $b4last+1-b4cp
b4st SPL.B #2228, $2228
b4cb DAT.F $3, $b4last+1-b4cp
b4pad0 DAT.F $0, $0
b4wipe MOV.I b4st, >b4cp
 MOV.I b4st, >b4cp
b4c DJN.B b4wipe, #0
b4loop ADD.F b4st, b4scan
b4scan SNE.I $2227, $2221
 ADD.F b4st, b4scan
 SEQ.I *b4scan, @b4scan
 SLT.A #340-8+8, b4scan
b4timer DJN.B b4loop, #11340
 JMZ.B b4clr, b4timer
 SLT.AB b4scan, #25176
 JMP.B b4loop, 0
 MOV.AB b4scan, b4cp
 MOV.AB #7, b4c
 JMP.B b4wipe, 0
b4clr MOV.I b4cb, b4st
 MOV.AB #0, b4c
b4last JMP.B b4wipe, 0
b5dfGap DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
b5dfField SPL.F <1, >8
 SPL.X #2, $69
 SPL.B }3, #130
 SPL.AB $4, <191
 SPL.I @5, @252
 SPL.A {6, >313
 SPL.BA *7, $374
 SPL.F >8, #435
 SPL.X <9, <496
 SPL.B #10, @557
 SPL.AB }11, >618
 SPL.I $12, $679
 SPL.A @13, #740
 SPL.BA {14, <801
 SPL.F *15, @862
 SPL.X >16, >923
 SPL.B <17, $984
 SPL.AB #18, #54
 SPL.I }19, <115
 SPL.A $20, @176
 SPL.BA @21, >237
 SPL.F {22, $298
 SPL.X *23, #359
 SPL.B >24, <420
 SPL.AB <25, @481
 SPL.I #26, >542
 SPL.A }27, $603
 SPL.BA $28, #664
 SPL.F @29, <725
 SPL.X {30, @786
 SPL.B *31, >847
 SPL.AB >32, $908
 SPL.I <33, #969
 SPL.A #34, <39
 SPL.BA }35, @100
 SPL.F $36, >161
 SPL.X @37, $222
 SPL.B {38, #283
 SPL.AB *39, <344
 SPL.I >40, @405
 SPL.A <41, >466
 SPL.BA #42, $527
 SPL.F }43, #588
 SPL.X $44, <649
 SPL.B @45, @710
 SPL.AB {46, >771
 SPL.I *47, $832
 SPL.A >48, #893
 SPL.BA <49, <954
 SPL.F #50, @24
 SPL.X }51, >85
 SPL.B $52, $146
 SPL.AB @53, #207
 SPL.I {54, <268
 SPL.A *55, @329
 SPL.BA >56, >390
 SPL.F <57, $451
 SPL.X #58, #512
 SPL.B }59, <573
 SPL.AB $60, @634
 SPL.I @61, >695
 SPL.A {62, $756
 SPL.BA *63, #817
 SPL.F >64, <878
 SPL.X <65, @939
 SPL.B #66, >9
 SPL.AB }67, $70
 SPL.I $68, #131
 SPL.A @69, <192
 SPL.BA {70, @253
 SPL.F *71, >314
 SPL.X >72, $375
 SPL.B <73, #436
 SPL.AB #74, <497
 SPL.I }75, @558
 SPL.A $76, >619
 SPL.BA @77, $680
 SPL.F {78, #741
 SPL.X *79, <802
 SPL.B >80, @863
 SPL.AB <81, >924
 SPL.I #82, $985
 SPL.A }83, #55
 SPL.BA $84, <116
 SPL.F @85, @177
 SPL.X {86, >238
 SPL.B *87, $299
 SPL.AB >88, #360
 SPL.I <89, <421
 SPL.A #90, @482
 SPL.BA }91, >543
 SPL.F $92, $604
 SPL.X @93, #665
 SPL.B {94, <726
 SPL.AB *95, @787
 SPL.I >96, >848
 SPL.A <97, $909
 SPL.BA #98, #970
 SPL.F }99, <40
 SPL.X $100, @101
 SPL.B @101, >162
 SPL.AB {102, $223
 SPL.I *103, #284
 SPL.A >104, <345
 SPL.BA <105, @406
 SPL.F #106, >467
 SPL.X }107, $528
 SPL.B $108, #589
 SPL.AB @109, <650
 SPL.I {110, @711
 SPL.A *111, >772
 SPL.BA >112, $833
 SPL.F <113, #894
 SPL.X #114, <955
 SPL.B }115, @25
 SPL.AB $116, >86
 SPL.I @117, $147
 SPL.A {118, #208
 SPL.BA *119, <269
 SPL.F >120, @330
 SPL.X <121, >391
 SPL.B #122, $452
 SPL.AB }123, #513
 SPL.I $124, <574
 SPL.A @125, @635
 SPL.BA {126, >696
 SPL.F *127, $757
 SPL.X >128, #818
 SPL.B <129, <879
 SPL.AB #130, @940
 SPL.I }131, >10
 SPL.A $132, $71
 SPL.BA @133, #132
 SPL.F {134, <193
 SPL.X *135, @254
 SPL.B >136, >315
 SPL.AB <137, $376
 SPL.I #138, #437
 SPL.A }139, <498
 SPL.BA $140, @559
 SPL.F @141, >620
 SPL.X {142, $681
 SPL.B *143, #742
 SPL.AB >144, <803
 SPL.I <145, @864
 SPL.A #146, >925
 SPL.BA }147, $986
 SPL.F $148, #56
 SPL.X @149, <117
 SPL.B {150, @178
 SPL.AB *151, >239
 SPL.I >152, $300
 SPL.A <153, #361
 SPL.BA #154, <422
 SPL.F }155, @483
 SPL.X $156, >544
 SPL.B @157, $605
 SPL.AB {158, #666
 SPL.I *159, <727
 SPL.A >160, @788
 SPL.BA <161, >849
 SPL.F #162, $910
 SPL.X }163, #971
 SPL.B $164, <41
 SPL.AB @165, @102
 SPL.I {166, >163
 SPL.A *167, $224
 SPL.BA >168, #285
 SPL.F <169, <346
 SPL.X #170, @407
 SPL.B }171, >468
 SPL.AB $172, $529
 SPL.I @173, #590
 SPL.A {174, <651
 SPL.BA *175, @712
 SPL.F >176, >773
 SPL.X <177, $834
 SPL.B #178, #895
 SPL.AB }179, <956
 SPL.I $180, @26
 SPL.A @181, >87
 SPL.BA {182, $148
 SPL.F *183, #209
 SPL.X >184, <270
 SPL.B <185, @331
 SPL.AB #186, >392
 SPL.I }187, $453
b3boot MOV.I >b3copyFrom, >b3copyTo
 DJN.B b3boot, b3headCount
b3go SPL.B b4loop+12600, 0
b3tail MOV.I >b3copyFrom, >b3copyTo
 DJN.B b3tail, b3tailCount
 JMP.B b4loop+12600, 0
b3copyFrom DAT.F #0, #-320
b3copyTo DAT.F #0, #12279
b3headCount DAT.F #0, #8
b3tailCount DAT.F #0, #14
b7tStart SPL.B 1, 0
 SPL.B 1, 0
 SPL.B 1, 0
b7t0 SPL.B 3039, #0
 MOV.I >b7t0, }b7t0
 MOV.I <b7t0, {b7t1
b7t1 SPL.B 1607, #0
b7tDrop MOV.I #3287, }3287
b7tCarpet MOV.I b7tBomb, >2376
b7tBomb DAT.F <3287, <6574
b6boot MOV.I <b6copyFrom, <b6copyTo
 DJN.B b6boot, b6copyCount
 JMP.B b7tStart+12600, 0
b6copyFrom DAT.F #0, #-3
b6copyTo DAT.F #0, #12596
b6copyCount DAT.F #0, #10
END
