# Carpet Bomber in Python: the inner loop is unrolled by a Python for-loop.
from zorewars import *

name("Carpet Bomber (Python)")
author("ZoreWars")

N, GAP = 4, 16
LENGTH = N + 4
assert CORESIZE % GAP == 0 and LENGTH + N <= GAP

org("loop")
label("ptr"); dat.f(imm(0), imm(LENGTH))
label("loop")
for _ in range(N):
    mov.i("bomb", postinc("ptr"))
add.ab(imm(GAP - N), "ptr")
jmp("loop")
label("bomb"); dat.f(imm(0), imm(0))
