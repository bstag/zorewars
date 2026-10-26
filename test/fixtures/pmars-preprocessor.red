;redcode-94
;name pMARS preprocessor probe
;assert 1
; Every line checked against pMARS 0.9.5 (see the test in test/engine.test.js):
; EQUs are text (2*step is 7), a FOR count can use labels, an EQU that uses
; a FOR counter (off) or pastes it (lab&i), a multi-line EQU macro (fill),
; an EQU chain ending in a mode (win), registers a-z (f is 0, A is a), and
; a label just before END (last).
step  equ 7/2
lose  equ #2256
win   equ lose+1
off   equ 10*i
fill  equ for 2
      equ dat 9, 9
      equ rof
first:dat #2*step, #-step
second:dat 0, 0
      for second-first+1
      dat 3, 3
      rof
i     for 2
      dat #off, #lab&i
lab&i dat 0, 0
      rof
      fill
      ldp win, #0
      mov f, (a=5)
      mov A, last
      for CURLINE-17
      dat 7, 7
      rof
last
      end first
