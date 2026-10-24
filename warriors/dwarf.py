# Dwarf, written in Python. Like JavaScript warriors, Python warriors
# generate Redcode; the Redcode is what fights in the arena.
from zorewars import *

name("Dwarf (Python)")
author("ZoreWars")
strategy("The classic Dwarf bomber, generated from Python.")

STEP = 4
assert CORESIZE % STEP == 0, "STEP must divide CORESIZE"

org("loop")
label("loop"); add.ab(imm(STEP), "bomb")
mov.i("bomb", ind("bomb"))
jmp("loop")
label("bomb"); dat.f(imm(0), imm(0))
