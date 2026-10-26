;redcode-94
;assert 1
top:
K2 equ cmp #(top), @-K2 && 1
nop $K2, 0
