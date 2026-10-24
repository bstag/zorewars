// Dwarf, written in C++. Build and battle it with:
//   node cli/zorewars.js battle examples/dwarf.cpp @imp
#include "zorewars.hpp"
using namespace zw;

int main() {
  const int STEP = 4;
  static_assert(CORESIZE % STEP == 0, "STEP must divide CORESIZE");

  name("Dwarf (C++)");
  author("ZoreWars");
  strategy("The classic Dwarf bomber, generated from C++.");

  org("loop");
  label("loop"); add.ab(imm(STEP), "bomb");
  mov.i("bomb", ind("bomb"));
  jmp("loop");
  label("bomb"); dat.f(imm(0), imm(0));

  emit();
}
