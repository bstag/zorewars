"""ZoreWars warrior generator for Python.

Write a warrior as ordinary Python that *emits* Redcode:

    from zorewars import *

    name("Dwarf")
    author("You")
    label("loop"); add(imm(4), "bomb")
    mov.i("bomb", ind("bomb"))
    jmp("loop")
    label("bomb"); dat(imm(0), imm(0))

When the script finishes, the Redcode is printed to stdout (the CLI and the
browser both read it from there). Call `render()` to get it as a string.
"""

import atexit
import sys

CORESIZE = 8000
MAXPROCESSES = 8000
MAXCYCLES = 80000
MAXLENGTH = 100
MINDISTANCE = 100
# Torus battlefields (the plane): SIZEX x SIZEY x SIZEZ cells. On the classic
# ring SIZEX is CORESIZE and the others are 1.
SIZEX = 8000
SIZEY = 1
SIZEZ = 1

_OPCODES = ["DAT", "MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMP", "JMZ",
            "JMN", "DJN", "SPL", "SLT", "SEQ", "SNE", "NOP", "LDP", "STP", "CMP", "TRN"]
_MODIFIERS = ["A", "B", "AB", "BA", "F", "X", "I"]

_meta = {"name": None, "author": None, "strategy": []}
_lines = []
_pending_labels = []
_org = None
_auto_print = True
_count = 0  # instructions emitted, for curline()


def _operand(x):
    return str(x).strip()


def _emit(op, mod, args):
    if len(args) > 2:
        raise ValueError(f"{op} takes at most two operands")
    global _pending_labels, _count
    _count += 1
    label = " ".join(_pending_labels)
    _pending_labels = []
    opm = f"{op}.{mod}" if mod else op
    ops = ", ".join(_operand(a) for a in args)
    lead = f"{label + ' ' if label else '':<10}"  # at least one space after a label
    _lines.append(f"{lead}{opm:<8}{ops}".rstrip())


class _Op:
    def __init__(self, op):
        self._op = op
        for m in _MODIFIERS:
            setattr(self, m.lower(), self._with_mod(m))

    def _with_mod(self, mod):
        return lambda *args: _emit(self._op, mod, args)

    def __call__(self, *args):
        _emit(self._op, None, args)


dat, mov, add, sub, mul, div, mod, jmp, jmz, jmn, djn, spl, slt, seq, sne, nop, ldp, stp, cmp, trn = (
    _Op(o) for o in _OPCODES)


def vec(x, y=0, z=None):
    """A vector on a torus battlefield: vec(0, 1) is one step along y, written [0,1]."""
    return f"[{x},{y}]" if z is None else f"[{x},{y},{z}]"


def name(s): _meta["name"] = str(s)
def author(s): _meta["author"] = str(s)
def strategy(s): _meta["strategy"].append(str(s))
def label(n): _pending_labels.append(str(n))
def equ(n, value): _lines.append(f"{str(n):<10}EQU     {_operand(value)}")
def comment(text): _lines.append(f"; {text}")
def raw(line): _lines.append(str(line))
def curline(): return _count  # index of the next instruction, like CURLINE


def org(where):
    global _org
    _org = _operand(where)


def imm(x): return f"#{_operand(x)}"
def dir(x): return f"${_operand(x)}"  # noqa: A001 - mirrors the JS API
def ind(x): return f"@{_operand(x)}"
def aind(x): return f"*{_operand(x)}"
def predec(x): return f"<{_operand(x)}"
def apredec(x): return f"{{{_operand(x)}"
def postinc(x): return f">{_operand(x)}"
def apostinc(x): return f"}}{_operand(x)}"


def render():
    out = [f";name {_meta['name'] or 'Unnamed'}", f";author {_meta['author'] or 'Anonymous'}"]
    out += [f";strategy {s}" for s in _meta["strategy"]]
    if _org is not None:
        out.append(f"{'':<10}ORG     {_org}")
    out += _lines
    if _pending_labels:
        out.append(" ".join(_pending_labels))
    return "\n".join(out) + "\n"


def no_auto_print():
    """Stop render() from being printed automatically at exit."""
    global _auto_print
    _auto_print = False


def reset():
    global _lines, _pending_labels, _org, _count
    _count = 0
    _meta.update({"name": None, "author": None, "strategy": []})
    _lines, _pending_labels, _org = [], [], None


@atexit.register
def _print_at_exit():
    if _auto_print and (_lines or _meta["name"]):
        # Always UTF-8, so names and strategies with any characters survive
        # consoles that default to another encoding (such as Windows cp1252).
        try:
            sys.stdout.buffer.write(render().encode("utf-8"))
            sys.stdout.flush()
        except AttributeError:
            sys.stdout.write(render())


__all__ = [
    "dat", "mov", "add", "sub", "mul", "div", "mod", "jmp", "jmz", "jmn", "djn",
    "spl", "slt", "seq", "sne", "nop", "ldp", "stp", "cmp", "trn", "vec", "name", "author", "strategy",
    "label", "equ", "comment", "raw", "org", "curline", "imm", "dir", "ind", "aind",
    "predec", "apredec", "postinc", "apostinc", "render",
    "CORESIZE", "MAXPROCESSES", "MAXCYCLES", "MAXLENGTH", "MINDISTANCE", "SIZEX", "SIZEY", "SIZEZ",
]
