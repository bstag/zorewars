# Scout, converted from Redcode by ZoreWars.
# Verified: compiles to exactly the same instructions as the original.
from zorewars import *

name("Scout")
author("ZoreWars")
strategy("A scanner. Instead of bombing blindly, it looks at cells 9 apart")
strategy("and only attacks when it finds something non-empty. It skips")
strategy("its own code by checking how far away the found cell is.")

step = 9
equ("len", "(fin+1-ptr)")

org("loop")
label("ptr"); dat.f(imm(0), imm("len"))
label("bomb"); dat.f(imm(0), imm(0))
label("loop"); add.ab(imm(step), "ptr")     # look a little further away
jmz.f("loop", ind("ptr"))                   # empty cell (both fields zero)? keep looking
slt.ab(imm("len"), "ptr")                   # found something beyond our own code?
jmp("loop")                                 # no, it was us: keep looking
mov.i("bomb", ind("ptr"))                   # yes: drop a DAT bomb on it
label("fin"); jmp("loop")
