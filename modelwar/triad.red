;name Triad v1
;author ZoreWars
;strategy switch-score(boot(twin-scan,decoy-field),guard-stone,sweep)
;strategy P-space score boxes (win +1, loss -1, 4th tie in a row a loss) over three arms: a booted twin-scan
;strategy that leaves a decoy, a guard stone and a sweep. Built with scripts/algebra.js from modelwar/triad.json.
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
 SLT.AB #3, b0stk
 JMP.B b0tieok, 0
 JMP.B b0loss, 0
b0tieok STP.B b0stk, #25
 ADD.AB #0, b0sc
 JMP.B b0store, 0
b0loss ADD.AB #-1, b0sc
b0clear STP.AB #0, #25
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
 MOV.AB #1, b0pick
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
 JMP.B b4boot, 0
 JMP.B b5loop, 0
b2cp DAT.F $0, $268
b2st SPL.B #2228, $2228
b2cb DAT.F $0, $268
b2pad0 DAT.F $0, $0
b2wipe MOV.I b2st, >b2cp
 MOV.I b2st, >b2cp
b2c DJN.B b2wipe, #0
b2loop ADD.F b2st, b2scan
b2scan SNE.I $2227, $2221
 ADD.F b2st, b2scan
 SEQ.I *b2scan, @b2scan
 SLT.A #268-8+8, b2scan
b2timer DJN.B b2loop, #11340
 JMZ.B b2clr, b2timer
 SLT.AB b2scan, #25176
 JMP.B b2loop, 0
 MOV.AB b2scan, b2cp
 MOV.AB #7, b2c
 JMP.B b2wipe, 0
b2clr MOV.I b2cb, b2st
 MOV.AB #0, b2c
b2last JMP.B b2wipe, 0
b3dfField SPL.F <1, >8
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
 SPL.A $188, #514
 SPL.BA @189, <575
 SPL.F {190, @636
b1boot MOV.I <b1copyFrom, <b1copyTo
 DJN.B b1boot, b1copyCount
 JMP.B b2loop+12600, 0
b1copyFrom DAT.F #0, #-193
b1copyTo DAT.F #0, #12406
b1copyCount DAT.F #0, #22
b4cp DAT.F $0, $50
b4boot JMP.B b4s, $0
b4s ADD.AB #19164, b4p
 MOV.I b4bomb, @b4p
b4p MOV.I b4bomb, *17655
 JMZ.A b4s, b4guard
b4clr SPL.B #0, $0
b4cl MOV.I b4cb, >b4cp
 DJN.F b4cl, {b4cp
 JMP.B b4cl, 0
b4bomb MOV.I $9582, $1
b4cb DAT.F $0, $50
b4pad0 DAT.F $0, $0
b4pad1 DAT.F $0, $0
b4pad2 DAT.F $0, $0
b4pad3 DAT.F $0, $0
b4pad4 DAT.F $0, $0
b4pad5 DAT.F $0, $0
b4pad6 DAT.F $0, $0
b4guard DAT.F $0, $1
b5cp DAT.F $0, $30
b5trip DAT.F $0, $0
b5one DAT.F $1, $1
b5p DAT.F #5930, #5939
b5pad0 DAT.F $0, $0
b5pad1 DAT.F $0, $0
b5pad2 DAT.F $0, $0
b5loop ADD.F b5st, b5p
 SEQ.I *b5p, @b5p
 JMP.B b5hit, 0
 ADD.F b5st, b5p
 SEQ.I *b5p, @b5p
 JMP.B b5hit, 0
b5lap DJN.B b5loop, #3528
 JMP.B b5clr, 0
b5hit SLT.AB #30-(b5p-b5cp)+18, b5p
 JMP.B b5lap, 0
 MOV.AB #9, b5c
 ADD.AB #5, b5p
b5wipe MOV.I b5st, <b5p
 MOV.I b5st, <b5p
b5c DJN.B b5wipe, #0
 ADD.AB #13, b5p
 JMZ.B b5lap, b5trip
b5clr SPL.B #0, $0
b5cl MOV.I b5cb, >b5cp
 DJN.F b5cl, {b5cp
 JMP.B b5cl, 0
b5st SPL.B #12710, $12710
b5cb DAT.F $0, $30
END
