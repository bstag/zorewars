;name Trio v7
;author ZoreWars
;strategy switch-score(steered-oneshot,boot(sweep),boot(twin-scan,decoy-field),boot(tail-silk),switch(boot(paper),boot(twin-scan,decoy-field)))
;strategy Trio v6 plus a fifth member tried right after the mirror switch: a one-shot scanner wrapped in decoys
;strategy (steered-oneshot), for opponents that scan the same way.
;assert CORESIZE==25200
ORG b0start
b0start LDP.AB #21, b0tmp
 SEQ.AB #1931, b0tmp
 JMP.B b0reset, 0
 LDP.AB #0, b0res
 LDP.AB #20, b0last
 MOD.AB #5, b0last
 MOV.B b0last, b0ptr
 ADD.AB #22, b0ptr
 LDP.B b0ptr, b0sc
 JMZ.B b0loss, b0res
 DJN.B b0tie, b0res
 ADD.AB #1, b0sc
 JMP.B b0clear, 0
b0tie LDP.AB #27, b0stk
 ADD.AB #1, b0stk
 SLT.AB #1, b0stk
 JMP.B b0tieok, 0
 JMP.B b0loss, 0
b0tieok STP.B b0stk, #27
 ADD.AB #0, b0sc
 JMP.B b0store, 0
b0loss ADD.AB #-1, b0sc
b0clear STP.AB #0, #27
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
 JMP.B b0next1, 0
 MOV.AB #1, b0pick
 MOV.B b0cand, b0sc
b0next1
 LDP.AB #24, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0next2, 0
 MOV.AB #2, b0pick
 MOV.B b0cand, b0sc
b0next2
 LDP.AB #25, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0next3, 0
 MOV.AB #3, b0pick
 MOV.B b0cand, b0sc
b0next3
 LDP.AB #26, b0cand
 SLT.B b0sc, b0cand
 JMP.B b0finish, 0
 MOV.AB #4, b0pick
 MOV.B b0cand, b0sc
b0finish STP.B b0pick, #20
 ADD.AB #b0table-b0pick, b0pick
 JMP.B @b0pick, 0
b0reset STP.AB #1931, #21
 STP.AB #12600, #22
 STP.AB #12600, #23
 STP.AB #12600, #24
 STP.AB #12600, #25
 STP.AB #12600, #26
 STP.AB #0, #27
 MOV.AB #4, b0pick
 JMP.B b0finish, 0
b0tmp DAT.F #0, #0
b0res DAT.F #0, #0
b0last DAT.F #0, #0
b0ptr DAT.F #0, #0
b0sc DAT.F #0, #0
b0cand DAT.F #0, #0
b0pick DAT.F #0, #0
b0stk DAT.F #0, #0
b0table JMP.B b1soScan, 0
 JMP.B b2boot, 0
 JMP.B b4boot, 0
 JMP.B b7boot, 0
 JMP.B b9start, 0
b1soHead0 DAT.F $9806, $14842
b1soHead1 DAT.F $11201, $6528
b1soHead2 DAT.F $9469, $13890
b1soHead3 DAT.F $19209, $1010
b1soHead4 DAT.F $20308, $23159
b1soHead5 DAT.F $15579, $10158
b1soHead6 DAT.F $19840, $3333
b1soJmp JMP.B b1soScan, $0
b1soBptr DAT.F #1, #11
b1soSpl SPL.B #3000, $13
b1soClr MOV.I *b1soBptr, >b1soBptr-2
 MOV.I *b1soBptr, >b1soBptr-2
b1soDjn DJN.F b1soClr, }b1soSpl
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
b1soScan ADD.F b1soInc, b1soSptr
b1soSptr SNE.I b1soBptr-1+5044+13, }b1soBptr-1+5044
b1soBack DJN.F b1soScan, *b1soSptr
b1soMov MOV.I b1soSptr, b1soBptr-2
b1soGo JMP.B b1soSpl, <b1soBptr-2
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
 DAT.F $0, $0
b1soInc DAT.F $5044, $5044
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
b1soTail0 DAT.F $21386, $17684
b1soTail1 DAT.F $13076, $4563
b1soTail2 DAT.F $9292, $21637
b1soTail3 DAT.F $9434, $13002
b1soTail4 DAT.F $25061, $11636
b1soTail5 DAT.F $11081, $16169
b1soTail6 DAT.F $4065, $11528
b1soTail7 DAT.F $16408, $17935
b1soTail8 DAT.F $11177, $7108
b1soTail9 DAT.F $13421, $14053
b1soTail10 DAT.F $19962, $15161
b3cp DAT.F $0, $b3cb+1-b3cp
b3trip DAT.F $0, $0
b3one DAT.F $1, $1
b3p DAT.F #5926, #5935
b3pad0 DAT.F $0, $0
b3pad1 DAT.F $0, $0
b3pad2 DAT.F $0, $0
b3loop ADD.F b3st, b3p
 SEQ.I *b3p, @b3p
 JMP.B b3hit, 0
 ADD.F b3st, b3p
 SEQ.I *b3p, @b3p
 JMP.B b3hit, 0
b3lap DJN.B b3loop, #4284
 JMP.B b3clr, 0
b3hit SLT.AB #837-(b3p-b3cp)+18, b3p
 JMP.B b3lap, 0
 MOV.AB #9, b3c
 ADD.AB #5, b3p
b3wipe MOV.I b3st, <b3p
 MOV.I b3st, <b3p
b3c DJN.B b3wipe, #0
 ADD.AB #13, b3p
 JMP.B b3lap, 0
b3clr SPL.B #0, $0
b3cl MOV.I b3cb, >b3cp
 DJN.F b3cl, {b3cp
 JMP.B b3cl, 0
b3st SPL.B #12719, $12719
b3cb DAT.F $0, $b3cb+1-b3cp
b3pick LDP.AB #40, b3vk
 MOD.AB #4, b3vk
 ADD.AB #1, b3vk
 STP.B b3vk, #40
 ADD.AB #b3tst0-b3vk-1, b3vk
 MOV.I @b3vk, b3st
 ADD.AB #4, b3vk
 MOV.I @b3vk, b3p
 JMP.B b3loop, 0
b3vk DAT.F $0, $0
b3tst0 SPL.B #12719, $12719
b3tst1 SPL.B #21679, $21679
b3tst2 SPL.B #7819, $7819
b3tst3 SPL.B #19411, $19411
 DAT.F #5926, #5935
 DAT.F #15362, #15371
 DAT.F #15362, #15371
 DAT.F #15362, #15371
b2boot MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 MOV.I -48, 12552
 JMP.B b3pick+12600, 0
b5pick LDP.AB #44, b5vk
 MOD.AB #4, b5vk
 ADD.AB #1, b5vk
 STP.B b5vk, #44
 ADD.AB #b5tst0-b5vk-1, b5vk
 MOV.I @b5vk, b5st
 ADD.AB #4, b5vk
 MOV.I @b5vk, b5scan
 JMP.B b5loop, 0
b5vk DAT.F $0, $0
b5tst0 SPL.B #18404, $18404
b5tst1 SPL.B #9332, $9332
b5tst2 SPL.B #10324, $10324
b5tst3 SPL.B #20924, $20924
 SNE.I $11251, $11245
 SNE.I $4024, $4018
 SNE.I $19331, $19325
 SNE.I $17632, $17626
b5cp DAT.F $3, $b5last+1-b5cp
b5st SPL.B #18404, $18404
b5cb DAT.F $3, $b5last+1-b5cp
b5pad0 DAT.F $0, $0
b5wipe MOV.I b5st, >b5cp
 MOV.I b5st, >b5cp
b5c DJN.B b5wipe, #0
b5loop ADD.F b5st, b5scan
b5scan SNE.I $11251, $11245
 ADD.F b5st, b5scan
 SEQ.I *b5scan, @b5scan
 SLT.A #722-8+8, b5scan
b5timer DJN.B b5loop, #11340
 JMZ.B b5clr, b5timer
 SLT.AB b5scan, #25176
 JMP.B b5loop, 0
 MOV.AB b5scan, b5cp
 MOV.AB #7, b5c
 JMP.B b5wipe, 0
b5clr MOV.I b5cb, b5st
 MOV.AB #0, b5c
b5last JMP.B b5wipe, 0
b6dfGap DAT.F $0, $0
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
b6dfField SPL.F <1, >8
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
b4boot MOV.I >b4copyFrom, >b4copyTo
 DJN.B b4boot, b4headCount
b4go SPL.B b5pick+12600, 0
b4tail MOV.I >b4copyFrom, >b4copyTo
 DJN.B b4tail, b4tailCount
 JMP.B b5loop+12600, 0
b4copyFrom DAT.F #0, #-338
b4copyTo DAT.F #0, #12261
b4headCount DAT.F #0, #26
b4tailCount DAT.F #0, #14
b8tStart SPL.B 1, 0
 SPL.B 1, 0
 SPL.B 1, 0
b8t0 SPL.B 3039, #0
 MOV.I >b8t0, }b8t0
 MOV.I <b8t0, {b8t1
b8t1 SPL.B 1607, #0
b8tDrop MOV.I #3287, }3287
b8tCarpet MOV.I b8tBomb, >2376
b8tBomb DAT.F <3287, <6574
b7boot MOV.I <b7copyFrom, <b7copyTo
 DJN.B b7boot, b7copyCount
 JMP.B b8tStart+12600, 0
b7copyFrom DAT.F #0, #-3
b7copyTo DAT.F #0, #12596
b7copyCount DAT.F #0, #10
b9start LDP.AB #0, b9result
 LDP.AB #60, b9choice
 MOD.AB #2, b9choice
 LDP.AB #62, b9ties
 ADD.AB #1, b9result
 SLT.AB #2, b9result
 JMP.B b9notie, 0
 ADD.AB #1, b9ties
 SLT.AB #3, b9ties
 JMP.B b9tdone, 0
 MOV.AB #2, b9result
b9notie MOV.AB #0, b9ties
b9tdone SUB.AB #1, b9result
 STP.B b9ties, #62
 SNE.AB #1, b9result
 ADD.AB #1, b9choice
b9keep MOD.AB #2, b9choice
 STP.B b9choice, #60
 ADD.AB #b9table-b9choice, b9choice
 JMP.B @b9choice, 0
b9result DAT.F #0, #0
b9choice DAT.F #0, #0
b9ties DAT.F #0, #0
b9table JMP.B b10boot, 0
 JMP.B b12boot, 0
b11pStart SPL.B 1, 0
 SPL.B 1, 0
 SPL.B 1, 0
b11pSilk SPL.B 718, #0
 MOV.I >b11pSilk, }b11pSilk
 ADD.A #725, b11pSeed
 MOV.F b11pSeed, b11pSilk
 JMP.B b11pSilk, 0
b11pSeed DAT.F #718, #0
b10boot MOV.I <b10copyFrom, <b10copyTo
 DJN.B b10boot, b10copyCount
 JMP.B b11pStart+12600, 0
b10copyFrom DAT.F #0, #-3
b10copyTo DAT.F #0, #12596
b10copyCount DAT.F #0, #9
b13pick LDP.AB #44, b13vk
 MOD.AB #4, b13vk
 ADD.AB #1, b13vk
 STP.B b13vk, #44
 ADD.AB #b13tst0-b13vk-1, b13vk
 MOV.I @b13vk, b13st
 ADD.AB #4, b13vk
 MOV.I @b13vk, b13scan
 JMP.B b13loop, 0
b13vk DAT.F $0, $0
b13tst0 SPL.B #18404, $18404
b13tst1 SPL.B #9332, $9332
b13tst2 SPL.B #10324, $10324
b13tst3 SPL.B #20924, $20924
 SNE.I $11251, $11245
 SNE.I $4024, $4018
 SNE.I $19331, $19325
 SNE.I $17632, $17626
b13cp DAT.F $3, $b13last+1-b13cp
b13st SPL.B #18404, $18404
b13cb DAT.F $3, $b13last+1-b13cp
b13pad0 DAT.F $0, $0
b13wipe MOV.I b13st, >b13cp
 MOV.I b13st, >b13cp
b13c DJN.B b13wipe, #0
b13loop ADD.F b13st, b13scan
b13scan SNE.I $11251, $11245
 ADD.F b13st, b13scan
 SEQ.I *b13scan, @b13scan
 SLT.A #324-8+8, b13scan
b13timer DJN.B b13loop, #11340
 JMZ.B b13clr, b13timer
 SLT.AB b13scan, #25176
 JMP.B b13loop, 0
 MOV.AB b13scan, b13cp
 MOV.AB #7, b13c
 JMP.B b13wipe, 0
b13clr MOV.I b13cb, b13st
 MOV.AB #0, b13c
b13last JMP.B b13wipe, 0
b14dfGap DAT.F $0, $0
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
b14dfField SPL.F <1, >8
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
b12boot MOV.I >b12copyFrom, >b12copyTo
 DJN.B b12boot, b12headCount
b12go SPL.B b13pick+12600, 0
b12tail MOV.I >b12copyFrom, >b12copyTo
 DJN.B b12tail, b12tailCount
 JMP.B b13loop+12600, 0
b12copyFrom DAT.F #0, #-338
b12copyTo DAT.F #0, #12261
b12headCount DAT.F #0, #26
b12tailCount DAT.F #0, #14
END
