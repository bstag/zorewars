# pMARS preprocessor behaviour handoff

This is a compatibility specification, written by a source-review agent for an implementer who does not receive the reference source. It describes externally observable rules and supplies original Redcode probes with outputs captured from the reference executable. It contains no reference implementation code or translated algorithms. No ZoreWars implementation or test runner was changed by this agent.

This separation applies to this handoff only. COMPLIANCE.md records earlier source-reading audits and implementation fixes. The new boundary does not establish retroactive clean-room provenance and is not a legal certification.

## Reference and evidence

Reference: pMARS v0.9.5, dated 03/01/2026 in its version banner; Windows x86_64 SERVER build. Source archive: <https://deb.debian.org/debian/pool/main/p/pmars/pmars_0.9.5.orig.tar.xz>. Archive SHA-256: `4c194226446e0b4b34a2c2e98641bf0d9435d9c0314bb6d8ee555d95b8de0511`.

The reviewer inspected the assembler, expression evaluator and tokenizer. These source files were compared by SHA-256 with the downloaded archive and matched. The archive was then unpacked afresh outside the repository and compiled with Zig 0.13.0 using `cc -O2 -w -DEXT94 -DPERMUTATE -DRWLIMIT -DSERVER` and the source list in COMPLIANCE.md. The resulting executable SHA-256 is `892c93d2dd3c75709bcb67e1ed3cc1287a921bf2dc2d13dd95a46818df43f8b2`. All 81 committed expectations were recaptured from that fresh build on 26 October 2026. Upstream source, executable, compiler and temporary capture tooling are not included in the repository.

The corpus is `test/pmars-clean-room/manifest.json`. For each case it records a source file, exact arguments, process exit code, signal/error, and separate raw stdout/stderr files. Commands run with `test/pmars-clean-room` as their working directory. A typical invocation is `pmars-reference.exe -A equ-text.red`; '88 probes add `-8`. Assembly probes use `-A`. The metadata probe instead runs `-r 1 -c 1` to expose the program name in the listing header; its battle score is not a compatibility expectation. Defaults are core 8000, processes 8000, cycles 80000, length 100, minimum distance 100, P-space 500, and one warrior. These are observable test conditions, not universal constants.

Expected listings are pMARS text, including signed printed field values, whitespace and CRLF. Compare numeric fields modulo core size when integrating with a differently formatted listing. Preserve warning/error distinctions separately from assembly success. Reference successful assembly exits 0; rejected probes exit 3. These are reference-process exit codes, not ZoreWars CLI exit codes.

## Observable order

1. Physical input selection, line continuation, metadata recognition and comment handling happen before expansion. In particular, metadata can be read after an END even though subsequent instructions are ignored.
2. Walk the selected text in order, expanding encountered EQUs and FOR bodies. FOR counts and standalone assertions are evaluated at this time. Instruction positions advance only for expanded instructions. Labels already encountered are available numerically in expansion-time expressions; forward labels generally are not.
3. Instruction expressions and entry directives are evaluated after expansion. This is why a later EQU or label can satisfy an earlier instruction operand, but cannot supply an earlier FOR count. The corpus is authoritative for the forward-EQU case; do not generalize it to arbitrary forward macro expansion.
4. Expression registers retain assignments made by assertions and FOR counts into instruction evaluation. Instruction operands evaluate in source order, A before B. Registers reset between assembled warriors. Register-reset-probe independently verifies their initial zero state; a multi-warrior reset fixture is still desirable.
5. Entry address, instruction length and syntax restrictions are checked, and warnings/errors are reported. Error recovery can suppress later diagnostics; compatibility of valid assembly should not depend on matching every cascading message.

## Input and lexical rules

Opcodes, modifiers and control keywords accept mixed case (`opcode-case`). User labels and EQU names are case-sensitive (`label-case`). `CURLINE` is recognized in uppercase; `curline` is an ordinary unresolved identifier (`curline-lowercase`). Registers a-z are case-insensitive if they are not resolved as labels; a defined lowercase `a` does not define uppercase `A` (`register-label`). Identifiers can start with a letter or underscore and contain digits (`identifier-underscore`).

A semicolon starts a comment. An inline `;assert` is merely a comment (`assert-inline`). A standalone comment beginning with the assert directive is active; directive matching is case-insensitive. Ordinary blank/comment lines consume no instruction position. Comments and blank lines between EQU continuation lines do not break the macro in the tested SERVER build (`equ-multiline-comment`, `fuzz-multiline-blank-continuation`).

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

Integer arithmetic supports unary plus, minus and logical not; multiplication, division, remainder; addition and subtraction; comparisons; logical AND and OR; assignment; and parentheses. Precedence from highest to lowest is unary, multiplicative, additive, all comparisons as one group, AND, OR, assignment. Comparisons at the same precedence associate left to right (`comparison-order`, `expression-precedence`). There is an additional measured syntax restriction: a chained `==` rejects an unparenthesized binary arithmetic expression in the immediately preceding comparison's right operand. For example, `1<2*3==4` rejects, while `1<(2*3)==4`, `1<-2==3`, and `1<2+3!=4` accept (`fuzz-comparison-middle-product-reject`, `fuzz-comparison-middle-parenthesized`, `fuzz-comparison-middle-unary`, `fuzz-comparison-middle-not-equal`). A later comparison resets the restriction to its own right operand (`fuzz-comparison-middle-chain-reject`). This was checked with all 36 pairs of comparison operators and four middle-operand forms. Division truncates toward zero, and remainder keeps the dividend's sign. Negative values are not wrapped before expression evaluation; only completed instruction fields are reduced modulo core size (`expression-wrap`).

Logical operators yield 0 or 1. They do not short-circuit: assignments in either logical operand occur, and even `0&&(1/0)` is an error (`expression-logical-side-effects`, `expression-no-shortcircuit`). Assignment returns its assigned value and can chain (`expression-assignment`). A subsequent operand sees the updated register (`register-order`).

Register assignments in expansion-time expressions precede all operand evaluation, including operands textually earlier than a later FOR count. `register-phase` and `for-register-mutation` are useful phase-order probes. Invalid expressions and division/remainder by zero are rejected. Integer overflow warnings and exact host integer width were inspected but are deliberately outside the verified compatibility contract: add bounded, process-isolated tests before reproducing overflow behaviour.

## Assertions, entry directives and '88

A false standalone assertion is an error (`assert-false`). An invalid assertion expression is a warning, not a false-assertion error (`assert-forward`); missing assertions also warn (`missing-assert`). Failure to expand a recursive EQU in an assertion is fatal before expression evaluation (`fuzz-assert-recursion-minimal`). Assertions execute during expansion, once per active loop occurrence (`assert-loop`), and can assign registers (`register-phase`). Skipped loop assertions have no effect. An inline assertion is ignored.

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

## Findings from differential fuzzing (black box)

This section was added on the implementer's side after the handoff. Nothing in it comes from reading pMARS's source. `scripts/fuzz-pmars.js` generated random programs and mutations of the probes above, assembled each with the pMARS executable (`-A`) and with ZoreWars, and shrank every disagreement. The rules below are what the executable was observed to do. Each has a minimal probe (`fuzz-*.red`), captured from the executable by `scripts/capture-pmars-probes.js`; its manifest entry carries `"origin": "differential-fuzzer"` and the reference version.

**EQU text reaches labels**
- An EQU name in label position is replaced by its text too.
  - After `gap equ z`, a second `gap equ 7` defines `z` (`fuzz-equ-label-rename`).
  - After `lbl equ start`, `lbl dat 1,2` defines the label `start` (`fuzz-equ-label-define`).
- If the text isn't a name, the line is an error: `k equ 5` then `k dat 1,2` (`fuzz-equ-label-number`), or a repeated `payload equ dat #3,#4` (`fuzz-equ-instruction-redefine`). This is also why redefining a numeric EQU fails (`equ-duplicate`).
- Substitution that comes back to itself is an error: `alpha equ alpha` twice (`fuzz-equ-recursive-redefine`).
- So is a chain that grows without end: `K2 equ cmp #(top), @-K2 && 1` (`fuzz-equ-self-reference`). ZoreWars caps EQU expansion at 20,000 characters, so hostile input like this fails quickly instead of exhausting memory.
- Becoming `CURLINE` is an error ("reserved keyword"; `fuzz-equ-curline-reserved`).
- A duplicate label produced by this substitution drops only the label, with a warning, and the instruction stays (`fuzz-label-from-equ-duplicate`). A plain duplicate drops the whole line (`label-duplicate`).
- An EQU that stands for a whole instruction is still expanded where it is used as one.
- A one-line EQU whose text is a FOR line (`block equ for 2`), used alone, evaluates its count. A positive count consumes the remaining program text without emitting its body and produces an "Unclosed ROF" warning (`fuzz-equ-for-text`). Zero and negative counts suppress the body without that warning (`fuzz-macro-for-zero`, `fuzz-macro-for-negative`), balancing nested physical FOR/ROF lines and resuming after the matching ROF (`fuzz-macro-for-zero-resume`). A subsequent extra ROF is an error (`fuzz-macro-for-zero-extra-rof`); with no closing ROF, the rest is suppressed. An undefined count rejects the program (`fuzz-macro-for-unknown`), rather than silently ending expansion.
- A multi-line EQU can't be defined twice (`fuzz-macro-redefine`). This also applies when the same definition is encountered on a later loop iteration (`fuzz-multiline-equ-loop-redefine`); expanding the macro text before loops must not erase this definition event.
- Definitions in a skipped loop have no effect, including a would-be redefinition of a multiline macro (`fuzz-campaign-8675309-003`). A ROF before a macro is still a loop terminator, never a pending label or macro alias (`fuzz-campaign-20261026-001`, `fuzz-campaign-8675309-002`); an unmatched ROF remains an error (`fuzz-campaign-42-004`).
- A label followed by multiple bare EQU lines defines a multiline macro, with every continuation retained (`fuzz-campaign-42-005`). A duplicate label already naming an earlier instruction is discarded before binding pending macro aliases, so it cannot create a false recursive reference (`fuzz-campaign-42-007`).
- Pending labels can alias a multi-line EQU as well (`fuzz-multiline-pending-alias`). A macro referring to its own alias rejects when expanded (`fuzz-multiline-pending-recursion`); leaving it unused, suppressing it with FOR 0, or placing it after END does not reject the program (`fuzz-multiline-recursion-unused`, `fuzz-multiline-recursion-skipped`, `fuzz-multiline-recursion-after-end`).
- Redefining a one-line FOR EQU substitutes its FOR text too. A zero count suppresses the following body without a warning (`fuzz-macro-for-redefine-zero`); a positive count rejects the misplaced EQU after that count (`fuzz-macro-for-redefine-positive`).
- A FOR left unclosed inside a multi-line macro ends expansion there, the same as an unclosed FOR at the end of the program: a second use of the macro emits nothing more (`fuzz-macro-unclosed-for-twice`).

**EQUs and labels**
- An EQU whose name is already a label is ignored with a warning (`fuzz-equ-over-label`). So is one whose name is a loop's active counter (`fuzz-equ-in-loop-then-use`).
- Labels on lines of their own just before an EQU name that EQU too, rather than the next instruction (`fuzz-pending-label-equ`). That includes an EQU line with no name of its own: `payload` then ` equ dat #5,#6` defines `payload` (`fuzz-pending-label-bare-equ`).
- Repeating the same pending label still defines only one EQU alias (`fuzz-repeated-pending-equ`), rather than a duplicate EQU that fails when used.
- An EQU redefinition can expand its name into text beginning with an already placed label, before punctuation. That label's redefinition discards the line before the remaining substituted text is parsed (`fuzz-loop-equ-existing-label`), including a trailing label separated from the EQU by a FOR line (`fuzz-loop-equ-trailing-label`). This is an observed ordering rule, not permission to accept arbitrary punctuation in a new label.
- An EQU defined inside a loop keeps its text as written; the counter is filled in where it is used. A use before the definition sees the raw text, such as `cell&i`, and fails (`fuzz-equ-in-loop-forward`).
- Its name does get the counter: `pt&i equ (cell&i+i)` defines `pt01`, `pt02` and so on. A use such as `#pt&i` is pasted to `pt01` first, then `pt01`'s text is written in and gets the counter too (`fuzz-loop-equ-pasted-name`; the Hall of Fame's Impfinity v4g1 relies on this).
- Label-position substitution is itself a use: when a later loop iteration redefines `ref equ cell&i`, the existing EQU name becomes the current pasted label, such as `cell02`, before the new declaration is parsed (`fuzz-config-88-97-1-001`, `fuzz-config-94-97-1-001`). The EQU value still keeps its raw text for operand uses; this is not eager capture at definition time.

**Labels**
- **Labels on a FOR line are fixed where they stand.** Unlike labels on a line of their own, they don't merge with a later label at the same place, and a later definition of the same name is ignored (`fuzz-for-label-fixed`). A FOR line whose own label is redefined (in a loop's second pass) is ignored entirely, so its `rof` is left unmatched (`fuzz-for-label-in-loop`).
- These fixed labels survive EOF even if a zero-count FOR emits no instructions (`fuzz-for-trailing-fixed-label`). A pending label on its own line before a FOR is also fixed at that point and survives EOF (`fuzz-campaign-20261026-002`), and a later definition of it is then a redefinition (`fuzz-pending-label-fixed-by-for`).
- The FOR line's own labels may repeat those waiting labels: they name the same place, so the line is not ignored (`fuzz-for-label-repeats-waiting`).
- **The same label twice for one place** (`top` on its own line, then `top: dat …`; or a label repeated before END) is one label, not a redefinition (`fuzz-label-same-place`, `fuzz-label-end-same-place`).
- **At most 7 labels per instruction,** counting repeats and labels on earlier lines of their own; the 8th is an error (`fuzz-label-limit-7`, `fuzz-label-limit-8`).
- The limit also applies to pending label declarations that reach EOF without an instruction; repeatedly emitting a label-only loop body does not evade it (`fuzz-campaign-42-006`).
- **Labels after the last instruction** are discarded at the end of the program ("Discarding these labels"; `fuzz-trailing-label-discarded`), unless an ORG or END follows them or they stand on that line. Then they name the position just past the last instruction (`fuzz-trailing-label-before-org`, `fuzz-trailing-label-on-org`).
- **Labels on an ORG line are fixed there,** like a FOR line's: a second `mid org 9` after `mid org 0` is a redefinition and ignored, so the first ORG stands (`fuzz-org-label-fixed`).
- **`&j` in a label outside a loop with counter `j`** is an error ("Unable to derefer and concatenate"), even on a line that a label redefinition leaves out (`fuzz-paste-outside-loop-duplicate`).
- **`CURLINE` can't be a label** (uppercase only; `curline` is an ordinary name): "CURLINE is a reserved keyword" (`fuzz-curline-label`).
- **A label glued to an operator** (`mid||VERSION`) is still read as the label `mid`, so a redefinition ignores the line (`fuzz-label-glued`).

**Loops**
- **Redefining a loop counter.** In a loop that runs, a line that defines an active counter as a label is ignored with a warning. That includes a nested `i for N` inside `i for N`, which then opens no block, so the next `rof` closes the outer loop (`fuzz-counter-redefine-rof`, `fuzz-counter-redefine-nested`). A loop that doesn't run never looks inside, so its nested FOR lines balance as usual (`fuzz-counter-redefine-zero`).
- This redefinition check also applies when EQU substitution exposes an active counter before punctuation: inside `top for 3`, repeated `imm equ top, CORESIZE` lines are ignored when their substituted leading label is `top` (`fuzz-config-88-80-1-002`).

**Expansion**
- **After END** instruction expansion stops, so a stray `rof` there is not an error (`fuzz-after-end`). Metadata is still read from the selected physical input: `;name after` following END replaces `;name before` (`fuzz-after-end-metadata`).
- **CURLINE exists only while expanding.**
  - It is filled in where each line is expanded, including through EQUs defined earlier (`fuzz-curline-earlier-equ`), and after `&&` (`fuzz-curline-after-andand`).
  - An EQU defined after its use can't supply it: the reference reports CURLINE as undefined (`fuzz-curline-forward-equ`).
- **An EQU standing for an instruction can't be used in an expression:** in a `;assert` it is an error, not just an invalid assert (`fuzz-assert-instruction-equ`).
- **Every ORG is evaluated,** so an error in one that a later ORG replaces still rejects the warrior (`fuzz-org-replaced-error`).
- **An ORG that is 0 modulo the core size doesn't count:** `ORG CORESIZE` with `END 1` starts at 1, as if no ORG had been given (`fuzz-org-coresize-end`).

**Observed but not modelled by ZoreWars, so the fuzzer leaves them out:**
- **Labels inside multi-line EQU macros.** The reference records such a label when the macro is defined, so each use redefines it, with knock-on effects (an extra instruction, or an "improper END") that weren't characterised.
- **A name that is both a label and an assigned register,** as in `(a=7)` with a label `a`. The reference accepts some of these and rejects others as "Bad expression", depending on where the label is and whether the name is also read. The rule wasn't pinned down, so ZoreWars assigns the register, and the fuzzer doesn't use single-letter labels that are also assigned.
- **A start outside the program.** The reference warns "Execution starts from outside of the program" and keeps an entry ZoreWars wouldn't.
- **Empty programs.** These are accepted by `-A` but can't run.
- **Internal reference errors.** One input made the reference stop with "Error in asm.c. Line: 846": a line holding only `MAXLENGTH` at the end of the file with no final newline. Another exits with Windows access violation status `3221225477` (`0xC0000005`), with no signal and only `Error` on stderr (`fuzz-reference-access-violation`). Neither is a language rejection or behaviour to copy. Reference assembly acceptance is exit 0 and rejection is exit 3; signals, internal-error reports and other statuses are classified as process failures. The fuzzer records their inputs and process results separately, with distinct counts for crashes, timeouts and launch errors. The corpus retains the captured access violation to test classification; assembler conformance comparisons exclude it.
- **32-bit overflow.** Expressions whose intermediate values leave the 32-bit range give platform-dependent results in the reference build; ZoreWars doesn't copy them, and the fuzzer counts such cases as out of scope.
- **Contradictory reference results.** With some error-heavy oversized loops, pMARS prints fatal `Error` diagnostics (including "Too many instructions") and an over-length listing, yet exits 0 (`fuzz-config-94-80-1-002`, also at core sizes 97, 800 and 8000). These captures are classified as `inconsistent`, preserved as reference-failure evidence and excluded from language conformance. They are not instructions for accepting over-length programs. A straightforward `MAXLENGTH+1`-instruction loop is rejected normally in both dialects at all five tested core sizes (`fuzz-config-88-80-length`, `fuzz-config-94-80-length` and their configured counterparts).

## Configured reference runs

Every configured case records the exact command arguments in the manifest. The implementer must use that case's core size for field normalization and mirror its `-s`, `-p`, `-c`, `-l`, `-d`, `-S` and `-r` settings. Without `-d`, the reference minimum distance equals maximum length. `-8` selects the dialect; the source header alone does not enforce it. '88 listings omit modifiers, so comparisons use opcode, modes, fields and entry address rather than inventing reference modifiers. The paired `fuzz-config-88-*-modifier` and `fuzz-config-94-*-modifier` cases demonstrate the different verdict for the same `MOV.I` instruction.

The configuration matrix uses cores 80, 97, 800, 8000 and 55440, lengths 5, 10, 20, 100 and 200, process limits 80, 97, 800, 8000 and 10000, and cycle limits 800, 970, 8000, 80000 and 500000, respectively, with minimum distance equal to length. Each dialect/core pair has captured predefined-constant, field-wrap, entry-point, modifier and length controls. These are explicit test configurations, not a claim that all represent standard hill rules.
