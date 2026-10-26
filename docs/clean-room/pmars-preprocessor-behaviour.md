# pMARS preprocessor behaviour handoff

This is a compatibility specification, written by a source-review agent for an implementer who does not receive the reference source. It describes externally observable rules and supplies original Redcode probes with outputs captured from the reference executable. It contains no reference implementation code or translated algorithms. No ZoreWars implementation or test runner was changed by this agent.

This separation applies to this handoff only. COMPLIANCE.md records earlier source-reading audits and implementation fixes. The new boundary does not establish retroactive clean-room provenance and is not a legal certification.

## Reference and evidence

Reference: pMARS v0.9.5, dated 03/01/2026 in its version banner; Windows x86_64 SERVER build. Source archive: <https://deb.debian.org/debian/pool/main/p/pmars/pmars_0.9.5.orig.tar.xz>. Archive SHA-256: `4c194226446e0b4b34a2c2e98641bf0d9435d9c0314bb6d8ee555d95b8de0511`.

The reviewer inspected the assembler, expression evaluator and tokenizer. These source files were compared by SHA-256 with the downloaded archive and matched. The archive was then unpacked afresh outside the repository and compiled with Zig 0.13.0 using `cc -O2 -w -DEXT94 -DPERMUTATE -DRWLIMIT -DSERVER` and the source list in COMPLIANCE.md. The resulting executable SHA-256 is `892c93d2dd3c75709bcb67e1ed3cc1287a921bf2dc2d13dd95a46818df43f8b2`. All 81 committed expectations were recaptured from that fresh build on 26 October 2026. Upstream source, executable, compiler and temporary capture tooling are not included in the repository.

The corpus is `test/pmars-clean-room/manifest.json`. For each case it records a source file, exact arguments, process exit code, signal/error, and separate raw stdout/stderr files. Commands run with `test/pmars-clean-room` as their working directory. A typical invocation is `pmars-reference.exe -A equ-text.red`; '88 probes add `-8`. `-A` assembles only, so no simulation results enter the expectations. Defaults are core 8000, processes 8000, cycles 80000, length 100, minimum distance 100, P-space 500, and one warrior. These are observable test conditions, not universal constants.

Expected listings are pMARS text, including signed printed field values, whitespace and CRLF. Compare numeric fields modulo core size when integrating with a differently formatted listing. Preserve warning/error distinctions separately from assembly success. Reference successful assembly exits 0; rejected probes exit 3. These are reference-process exit codes, not ZoreWars CLI exit codes.

## Observable order

1. Physical input selection, line continuation, metadata recognition and comment handling happen before expansion. In particular, metadata can be read after an END even though subsequent instructions are ignored.
2. Walk the selected text in order, expanding encountered EQUs and FOR bodies. FOR counts and standalone assertions are evaluated at this time. Instruction positions advance only for expanded instructions. Labels already encountered are available numerically in expansion-time expressions; forward labels generally are not.
3. Instruction expressions and entry directives are evaluated after expansion. This is why a later EQU or label can satisfy an earlier instruction operand, but cannot supply an earlier FOR count. The corpus is authoritative for the forward-EQU case; do not generalize it to arbitrary forward macro expansion.
4. Expression registers retain assignments made by assertions and FOR counts into instruction evaluation. Instruction operands evaluate in source order, A before B. Registers reset between assembled warriors. Register-reset-probe independently verifies their initial zero state; a multi-warrior reset fixture is still desirable.
5. Entry address, instruction length and syntax restrictions are checked, and warnings/errors are reported. Error recovery can suppress later diagnostics; compatibility of valid assembly should not depend on matching every cascading message.

## Input and lexical rules

Opcodes, modifiers and control keywords accept mixed case (`opcode-case`). User labels and EQU names are case-sensitive (`label-case`). `CURLINE` is recognized in uppercase; `curline` is an ordinary unresolved identifier (`curline-lowercase`). Registers a-z are case-insensitive if they are not resolved as labels; a defined lowercase `a` does not define uppercase `A` (`register-label`). Identifiers can start with a letter or underscore and contain digits (`identifier-underscore`).

A semicolon starts a comment. An inline `;assert` is merely a comment (`assert-inline`). A standalone comment beginning with the assert directive is active; directive matching is case-insensitive. Ordinary blank/comment lines consume no instruction position. An ordinary comment between EQU continuation lines does not break the macro in the tested SERVER build (`equ-multiline-comment`).

A backslash immediately before the physical newline joins the next line when no semicolon occurred in that physical input so far (`line-continuation`). A backslash inside a comment does not continue it (`comment-continuation`). Whitespace after the backslash, CR-only input, Unicode and non-ASCII identifiers remain untested.

The first `;redcode` marker discards preceding program text. The next marker ends the selected program (`redcode-selection`). A suffix such as `-94` is accepted. The marker keyword must immediately follow the semicolon; leading spaces before the semicolon are separate from spaces after it. Metadata directives include name, author, date and version; later declarations replace earlier ones. Assertions in discarded text do not count toward the missing-assert check. The corpus currently tests selected instructions and the missing-assert effect, not metadata values, because `-A` omits them from its listing.

## EQU and labels

EQU denotes textual substitution, with no implicit parentheses. Thus `stride equ 11/3` makes `2*stride` evaluate to 7, while `-stride` evaluates to -3 (`equ-text`). Mode symbols can come from an EQU chain (`equ-mode-chain`). An EQU may represent a whole instruction (`equ-instruction`), several instructions through following unlabeled EQU lines (`equ-multiline`), or a FOR block (`macro-for`).

Macro contents are interpreted where used: CURLINE, relative labels, loop counters and pasted loop labels reflect the invocation (`curline`, `equ-capture-label`, `equ-counter-use`, `equ-paste-late`). A macro is not a numeric value captured at definition. An unused self-recursive definition is accepted, but expanding a recursive chain is rejected (`equ-unused-recursive`, `equ-recursive`). An unlabeled EQU outside a continuation gives a warning (`equ-no-label`). Redefining an EQU is not equivalent to updating it (`equ-duplicate`).

Several labels may name the same instruction, with optional colons (`multiple-labels`). Forward references are accepted in instruction operands (`label-forward`). A label on END, or immediately before END, binds to the position after the last instruction (`label-end`, `label-before-end`). At bare EOF those pending labels are discarded with a warning, leaving references unresolved (`label-trailing`).

Inside normal instruction operands, a label means its position minus the current instruction position. In ORG/END it means its absolute position. During FOR counts and assertions it is relative to the current expanded instruction position: `anchor` at position 0 used by an assertion after one instruction is -1, not 0 (`for-assert-label`). Label differences cancel that offset (`for-count-labels`).

A duplicate instruction label causes the entire redefinition line to be ignored with a warning (`label-duplicate`). Consequently a repeated FOR body containing an unpasted fixed label may emit fewer instructions than the iteration count suggests (`for-duplicate-label`). Do not silently keep both instructions and merely discard the duplicate label.

## FOR, ROF, counters and concatenation

A FOR count is an integer expression evaluated when encountered, once per encounter. Positive N repeats the body N times. Fractional division truncates (`for-fraction`). Zero and negative counts suppress the body (`for-zero-skips`, `for-negative`). The suppression still balances nested FOR/ROF, but does not evaluate nested counts, invalid body instructions or assertions. Empty positive bodies are accepted (`for-empty`).

Counts may use already encountered labels, EQUs, predefined values, CURLINE and registers. Forward labels and later EQU definitions fail as counts (`for-forward-count`, `macro-forward-count`). An outer count is not recomputed for each iteration, but an inner count is evaluated on each encounter (`for-register-mutation`).

A label on a FOR is a scoped, one-based iteration counter (`for-counter`). Nested differently named counters remain independently visible (`for-nested`). Leaving the loop removes that counter binding; a one-letter name can then fall back to a zero-valued register (`for-counter-after`). Reusing an active counter name is not ordinary lexical shadowing; it produces redefinition and matching errors (`for-counter-shadow`).

`prefix&counter` pastes the active counter's decimal value with a minimum width of two digits: 1 becomes 01 and 10 becomes 10 (`for-paste`, `paste-width`). The counter must be an active FOR counter, not an ordinary numeric EQU (`paste-noncounter`). The pasted name can occur in definitions and references, including inside an EQU invoked by the loop (`equ-paste-late`). Whitespace around `&`, multiple consecutive pastes and values above 99 need additional probes.

END inside a positive loop ends expansion immediately, including remaining iterations and text after the loop (`for-end`). ROF without FOR is an error (`rof-unopened`). An unterminated positive FOR emits the first body occurrence, then warns about an unclosed ROF (`for-unclosed-positive`). An unterminated zero-count FOR emits nothing and, in the tested input, does not report the missing ROF (`for-unclosed-zero`). These surprising outcomes are observed behaviour, not suggested language design.

## CURLINE and predefined values

CURLINE is the zero-based number of expanded instructions before the current position. EQU definitions, directives, blank lines, comments and FOR/ROF markers do not increment it. Each emitted body copy advances it (`curline`, `for-count-labels`, `curline-org`). An EQU containing CURLINE observes its use site. CURLINE is not an ordinary definable label.

The reference supplies CORESIZE, MAXPROCESSES, MAXCYCLES, MAXLENGTH, MINDISTANCE, VERSION, PSPACESIZE and WARRIORS. Under the captured defaults, VERSION is 95, PSPACESIZE 500 and WARRIORS 1 (`predefined`). Values are reduced modulo core size in instruction fields, so the zero fields in that listing do not mean the original constants were zero. Parameterized capture at other core sizes is a follow-up requirement.

## Expressions and registers

Integer arithmetic supports unary plus, minus and logical not; multiplication, division, remainder; addition and subtraction; comparisons; logical AND and OR; assignment; and parentheses. Precedence from highest to lowest is unary, multiplicative, additive, all comparisons as one group, AND, OR, assignment. Comparisons at the same precedence associate left to right (`comparison-order`, `expression-precedence`). Division truncates toward zero, and remainder keeps the dividend's sign. Negative values are not wrapped before expression evaluation; only completed instruction fields are reduced modulo core size (`expression-wrap`).

Logical operators yield 0 or 1. They do not short-circuit: assignments in either logical operand occur, and even `0&&(1/0)` is an error (`expression-logical-side-effects`, `expression-no-shortcircuit`). Assignment returns its assigned value and can chain (`expression-assignment`). A subsequent operand sees the updated register (`register-order`).

Register assignments in expansion-time expressions precede all operand evaluation, including operands textually earlier than a later FOR count. `register-phase` and `for-register-mutation` are useful phase-order probes. Invalid expressions and division/remainder by zero are rejected. Integer overflow warnings and exact host integer width were inspected but are deliberately outside the verified compatibility contract: add bounded, process-isolated tests before reproducing overflow behaviour.

## Assertions, entry directives and '88

A false standalone assertion is an error (`assert-false`). An invalid assertion expression is a warning, not a false-assertion error (`assert-forward`); missing assertions also warn (`missing-assert`). Assertions execute during expansion, once per active loop occurrence (`assert-loop`), and can assign registers (`register-phase`). Skipped loop assertions have no effect. An inline assertion is ignored.

ORG sets the absolute entry position and later ORGs replace it (`org-multiple`, `org-forward`). END stops expansion. A zero-valued END argument leaves an earlier ORG intact (`org-end`); a nonzero END argument after a nonzero ORG is ignored with a warning (`org-end-conflict`). With no earlier nonzero origin, END can set entry from an absolute label (`end-label-absolute`). Entry must address an emitted instruction; add out-of-range cases before deciding how to mirror the reference diagnostic. Empty programs assemble with warnings under `-A` (`blank`); this is not evidence they can run.

`-8` retains FOR/EQU and END handling (`88-for-equ`, `88-end`) but rejects ORG, explicit modifiers, extended modes and '94-only instructions (`88-org`, `88-modifier`, `88-mode`). The full 11-opcode/mode restrictions already documented in COMPLIANCE.md are broader than this handoff's five targeted '88 fixtures. Do not infer that the accepted '94 listing format applies to '88: reference `-A -8` emits a different listing, including an END START line.

## Fuzzer priorities and remaining gaps

Use the committed cases as seeds, retaining stable minimized inputs and recording the reference version/options for every new expectation. Prioritize combinations rather than only isolated constructs:

- Expansion timing: forward EQU versus forward label in operands, counts and assertions; registers changed by later counts; CURLINE inside nested macros and loops.
- Text substitution: unary operators around unparenthesized EQU expressions, mode-bearing chains, whole-instruction/multiline macros, recursion that is unused versus reached, and macros producing controls.
- Scope and binding: pasted counters at 1/9/10/99/100, nested counters, repeated names, multiple labels, trailing labels with and without END, duplicate lines that disappear.
- Suppression: zero/negative nested loops with invalid counts, false assertions, malformed syntax or END; unmatched loops; empty programs.
- Evaluation: chained comparison associativity, nested assignment, operand ordering, non-short-circuit Boolean expressions, signed division/remainder, expression versus field normalization.
- Input selection: multiple redcode markers, continuation adjacent to comments, metadata before/after END, comment directives inside ignored material, line ending variants.
- Configuration: repeat a bounded matrix under `-8`, alternate core/length/process/P-space limits, and multiple input warriors. Apply timeouts and input/output limits, especially for huge counts, recursion and oversized tokens.

Not yet captured: full diagnostics recovery matrix; metadata values; multiple-warrior register reset; direct PIN behaviour; all predefined values under changed flags; limits on line/token length, label groups, total expansion and loop counts; counters beyond 99; platform overflow behaviour; debugger comment directives in non-SERVER builds; stdin concatenation; malformed no-space opcode tokenization; hostile binary input. Source review can identify these areas but does not supply measured expectations. Keep them explicitly unverified until a reference run is recorded.

This is a finite handoff, not a claim of exhaustive pMARS conformance. The implementer should use this document and the captured corpus, avoid consulting upstream source, and request additional behavioural probes through the reviewer when a gap matters.
