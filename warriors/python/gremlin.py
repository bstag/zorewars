# Gremlin (ring), converted from Redcode by ZoreWars.
# Verified: compiles to exactly the same instructions as the original.
from zorewars import *

name("Gremlin (ring)")
author("ZoreWars Evolver (from scratch)")
strategy("The evolved DJN stream of volume/gremlin.red, on the classic ring: one")
strategy("instruction walks back through memory taking one off both fields of")
strategy("every cell, breaking the exact arithmetic of clears and stones.")

org(0)
# Gremlin was evolved from random programs on the 40x20x10 volume (see
# warriors/volume/gremlin.red). Its strategy is classic ICWS'94 Redcode:
# lines 0-3 start processes, and line 13, DJN.F #10, {-10, is the stream
# (its pointer is line 3's A-field). Its 3D parts were leftovers: the TRN
# turned stray processes off into empty memory, and the vectors sat in lines
# that never matter. This version changes only those: each TRN is a NOP,
# and each vector is its x part. Everything else is exactly as evolved.

# On the ring it beats Two-Pass Clear 30-0, Vampire 28-1 and Dwarf 22-7,
# but scanners (Gatekeeper, Red Queen, Hedgehog) and papers beat it: 1.18
# points per round against the library and the classics.
spl.b(dir(1), dir(0))
spl.b(dir(11), dir(0))
spl.b(dir(1), dir(0))
jmp.b(dir(5), dir(0))
nop.f(ind(-7), apredec(-16))
slt.b(imm(9), apostinc(-3))
slt.ab(postinc(-5), aind(-6))
mul.b(aind(-1), aind(-5))
mul.a(aind(6), imm(11))
nop.x(aind(-13), aind(12))
nop.b(dir(0), dir(0))
add.x(apostinc(3), dir(-4))
add.x(imm(7), predec(-13))
djn.f(imm(10), apredec(-10))
mul.x(apredec(-10), postinc(18))
jmz.ba(aind(16), apredec(15))
dat.x(apredec(7), imm(10))
dat.x(dir(3), apredec(0))
