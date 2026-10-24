# Vampire, converted from Redcode by ZoreWars.
# Verified: compiles to exactly the same instructions as the original.
from zorewars import *

name("Vampire")
author("ZoreWars, after the classic \"vampire\" design")
strategy("Instead of DAT bombs, it drops JMP \"fangs\". A fang's A-field is")
strategy("adjusted so that, wherever it lands, it jumps to the vampire's pit.")
strategy("An enemy process that runs into a fang is pulled into the pit and")
strategy("dies there.")

org("start")
label("step"); dat.f(imm(-7), imm(7))       # A-field moves back, B-field moves forward
label("start"); add.f("step", "fang")
mov.i("fang", ind("fang"))                  # drop the fang where its B-field points
jmp("start")
label("fang"); jmp("pit", 0)                # A-field always points at the pit
label("pit"); dat.f(imm(0), imm(0))         # captured processes die here
