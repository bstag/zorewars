# Two-Pass Clear, converted from Redcode by ZoreWars.
# Verified: compiles to exactly the same instructions as the original.
from zorewars import *

name("Two-Pass Clear")
author("ZoreWars")
strategy("Sweeps the whole core twice. The first pass writes SPL 0, which")
strategy("makes any enemy process that touches it split uselessly; the second")
strategy("pass writes DAT, which kills every process still running.")

equ("len", "(last-ptr)")
equ("last", "(kill+1)")                     # one past our final instruction (pMARS drops labels after the last line)

org("start")
label("ptr"); dat.f(imm(0), imm("len"))     # next cell to write, starting just past our code
label("start"); mov.i("stun", postinc("ptr"))  # pass 1: write an SPL 0 and move on
djn.b("start", imm("CORESIZE-len"))         # one write per cell that isn't us
mov.ab(imm("len"), "ptr")                   # rewind the pointer
label("clear"); mov.i("kill", postinc("ptr"))  # pass 2: write a DAT and move on
jmp("clear")                                # stops on its own: when the pointer comes back
# around to ptr it keeps rewriting ptr itself
label("stun"); spl.b(imm(0), imm(0))
label("kill"); dat.f(imm(0), imm(0))
