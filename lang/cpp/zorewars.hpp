// ZoreWars warrior generator for C++17.
//
// Write a warrior as a C++ program that *emits* Redcode, then call
// zw::emit() at the end of main():
//
//   #include "zorewars.hpp"
//   using namespace zw;
//   int main() {
//     name("Dwarf");
//     label("loop"); add(imm(4), "bomb");
//     mov.i("bomb", ind("bomb"));
//     jmp("loop");
//     label("bomb"); dat(imm(0), imm(0));
//     emit();
//   }
//
// The CLI compiles and runs the program and reads the Redcode from stdout.
#pragma once

#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace zw {

constexpr int CORESIZE = 8000;
constexpr int MAXPROCESSES = 8000;
constexpr int MAXCYCLES = 80000;
constexpr int MAXLENGTH = 100;
constexpr int MINDISTANCE = 100;

// An operand: a number, a label, or an expression with an optional mode.
struct Arg {
  std::string text;
  Arg(int v) : text(std::to_string(v)) {}
  Arg(const char* s) : text(s) {}
  Arg(std::string s) : text(std::move(s)) {}
};

namespace detail {
struct State {
  std::string name = "Unnamed", author = "Anonymous", org;
  std::vector<std::string> strategy, lines, pending;
};
inline State& state() {
  static State s;
  return s;
}
inline std::string pad(const std::string& s, size_t w) {
  return s.size() >= w ? s + " " : s + std::string(w - s.size(), ' ');
}
inline void instr(const std::string& op, const std::string& mod, std::vector<Arg> args) {
  auto& st = state();
  std::string label;
  for (size_t i = 0; i < st.pending.size(); ++i) label += (i ? " " : "") + st.pending[i];
  st.pending.clear();
  std::string line = pad(label.empty() ? label : label + " ", 10) + pad(mod.empty() ? op : op + "." + mod, 8);
  for (size_t i = 0; i < args.size(); ++i) line += (i ? ", " : "") + args[i].text;
  while (!line.empty() && line.back() == ' ') line.pop_back();
  st.lines.push_back(line);
}
}  // namespace detail

struct Op {
  std::string op;
  void operator()() const { detail::instr(op, "", {}); }
  void operator()(Arg a) const { detail::instr(op, "", {a}); }
  void operator()(Arg a, Arg b) const { detail::instr(op, "", {a, b}); }
#define ZW_MOD(fn, M)                                                  \
  void fn(Arg a) const { detail::instr(op, M, {a}); }                  \
  void fn(Arg a, Arg b) const { detail::instr(op, M, {a, b}); }
  ZW_MOD(a, "A") ZW_MOD(b, "B") ZW_MOD(ab, "AB") ZW_MOD(ba, "BA")
  ZW_MOD(f, "F") ZW_MOD(x, "X") ZW_MOD(i, "I")
#undef ZW_MOD
};

inline const Op dat{"DAT"}, mov{"MOV"}, add{"ADD"}, sub{"SUB"}, mul{"MUL"},
    div{"DIV"}, mod{"MOD"}, jmp{"JMP"}, jmz{"JMZ"}, jmn{"JMN"}, djn{"DJN"},
    spl{"SPL"}, slt{"SLT"}, seq{"SEQ"}, sne{"SNE"}, nop{"NOP"}, ldp{"LDP"},
    stp{"STP"}, cmp{"CMP"};

inline void name(const std::string& s) { detail::state().name = s; }
inline void author(const std::string& s) { detail::state().author = s; }
inline void strategy(const std::string& s) { detail::state().strategy.push_back(s); }
inline void label(const std::string& s) { detail::state().pending.push_back(s); }
inline void org(Arg where) { detail::state().org = where.text; }
inline void equ(const std::string& n, Arg v) {
  detail::state().lines.push_back(detail::pad(n, 10) + "EQU     " + v.text);
}
inline void comment(const std::string& s) { detail::state().lines.push_back("; " + s); }
inline void raw(const std::string& s) { detail::state().lines.push_back(s); }

inline std::string imm(Arg x) { return "#" + x.text; }
inline std::string dir(Arg x) { return "$" + x.text; }
inline std::string ind(Arg x) { return "@" + x.text; }
inline std::string aind(Arg x) { return "*" + x.text; }
inline std::string predec(Arg x) { return "<" + x.text; }
inline std::string apredec(Arg x) { return "{" + x.text; }
inline std::string postinc(Arg x) { return ">" + x.text; }
inline std::string apostinc(Arg x) { return "}" + x.text; }

inline std::string render() {
  auto& st = detail::state();
  std::ostringstream out;
  out << ";name " << st.name << "\n;author " << st.author << "\n";
  for (auto& s : st.strategy) out << ";strategy " << s << "\n";
  if (!st.org.empty()) out << detail::pad("", 10) << "ORG     " << st.org << "\n";
  for (auto& l : st.lines) out << l << "\n";
  for (size_t i = 0; i < st.pending.size(); ++i) out << (i ? " " : "") << st.pending[i];
  if (!st.pending.empty()) out << "\n";
  return out.str();
}

inline void emit() { std::cout << render(); }

}  // namespace zw
