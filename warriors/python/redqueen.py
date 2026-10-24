# Red Queen, converted from Redcode by ZoreWars.
# Verified: compiles to exactly the same instructions as the original.
from zorewars import *

name("Red Queen")
author("Chip Wendell (Mice, 1986) and ZoreWars (Gatekeeper; combination found by the ZoreWars evolver)")
strategy("A compare scanner and a slow replicator side by side: Gatekeeper")
strategy("hunts, and a copy of Mice spreads in the background without")
strategy("taking the scanner's turns. Our evolver came upon this pairing.")

org(0)
# Where it comes from. Our evolver ("zorewars evolve": Red Queen rounds of
# MAP-Elites, started from Hedgehog, Hydra and Fast Silk as champions) found
# this combination, but it invented neither half:
# - Mice is Chip Wendell's replicator, winner of the first ICWS tournament
# in 1986 (adapted for ZoreWars in mice.red). Its body is here unchanged.
# - Gatekeeper is ZoreWars' compare scanner, which follows the line of
# Wayne Sheppard's Iron Gate (1993) and Stefan Strack's Agony (1988/1994).
# What evolution contributed is putting them together, the three launch
# lines, and a leftover fragment at the end. The comments were added
# afterwards; the instructions are exactly as evolved.

# ---- launch (evolved): one SPL per extra part ----
spl.b(dir(35), dir(0))                      # a process to the leftover at the end
spl.b(dir(27), dir(0))                      # a process to Mice
jmp.b(dir(3), dir(0))                       # this process runs Gatekeeper

# ---- Gatekeeper (ZoreWars): compare scanner, SPL carpets, two-pass clear ----
dat.f(imm(0), imm(0))                       # imp gate
dat.f(imm(0), imm(0))                       # clear pointer
add.f(dir(16), dir(1))                      # move both probes
seq.i(dir(21), dir(29))                     # two cells 8 apart identical?
jmp.b(dir(8), dir(0))                       # no: carpet them
djn.b(dir(-3), dir(14))                     # yes: next pair
mov.ab(imm(23), dir(-5))                    # lap done: clear from just past Gatekeeper
mov.i(dir(15), postinc(-6))                 # pass 1: SPL 0 everywhere
jmn.b(dir(-1), dir(-7))
mov.ab(imm(23), dir(-8))
mov.i(dir(13), postinc(-9))                 # pass 2: DAT everywhere
jmp.b(dir(-1), predec(-11))                 # ...decrementing the imp gate
mov.ab(dir(-9), dir(8))                     # carpet: aim at the find
add.ab(imm(-23), dir(7))
mov.ab(imm(22), dir(7))
mov.i(dir(7), postinc(5))                   # 22 SPL 0 stun bombs
djn.b(dir(-1), dir(5))
jmp.b(dir(-12), dir(0))                     # back to scanning
dat.f(imm(24), imm(24))                     # probe step
dat.f(imm(0), imm(331))                     # scan count
dat.f(imm(0), imm(0))                       # carpet pointer
dat.f(imm(0), imm(0))                       # carpet count
spl.b(imm(0), imm(0))                       # the stun bomb
dat.f(imm(0), imm(0))                       # the kill bomb

# ---- Mice (Chip Wendell, 1986): copy itself, start the copy, repeat ----
dat.f(imm(0), imm(0))                       # copy pointer
mov.ab(imm(12), dir(-1))                    # copy 12 cells...
mov.i(ind(-2), predec(5))                   # ...one at a time, last cell first
djn.b(dir(-1), dir(-3))
spl.b(ind(3), dir(0))                       # start a process in the copy
add.ab(imm(653), dir(2))                    # next copy 653 cells further on
jmz.b(dir(-5), dir(-6))                     # and again
dat.f(imm(0), imm(833))                     # destination

# ---- leftover (evolved): writes two cells, then runs off into empty core ----
mov.i(dir(4), postinc(-3))
mov.i(dir(3), postinc(-4))
add.ab(imm(12), dir(-5))
