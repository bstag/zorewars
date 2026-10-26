;assert 1
dat #CURLINE,0
foo equ CURLINE
dat #foo,#CURLINE
for 2
dat #foo,#CURLINE
rof
