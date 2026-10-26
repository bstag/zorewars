# Captured pMARS preprocessor probes

These 81 original Redcode programs are independent test inputs. Their expected stdout, stderr and exit codes were captured by running a freshly built pMARS 0.9.5 reference on 26 October 2026. No expected listing was calculated by ZoreWars or hand-authored.

See `../../docs/clean-room/pmars-preprocessor-behaviour.md` for the behavioural specification, source-review boundary, reference provenance, test conditions, case explanations and untested areas.

`manifest.json` is the corpus index. Run each case's `args` against the reference executable with this directory as the working directory. For example: `pmars-reference.exe -A equ-text.red`, or `pmars-reference.exe -A -8 88-for-equ.red`. Compare each output stream separately and check the exit code. All cases have a five-second reference-process timeout during capture; none timed out. File hashes protect the exact input and captured output bytes.

The corpus contains assembly-only output, not battle results. Successful reference exit is 0; rejection is 3. Warnings can accompany success. Some valid cases deliberately lack an assertion or instructions, or exercise surprising error recovery. Their names describe the construct, not an assumption that it must be accepted.

Raw text outputs use the reference's CRLF. For implementation tests that compare assembled instructions rather than rendering, parse the listing and normalize fields modulo the configured core size; preserve origin and accept/reject separately. Do not require ZoreWars to use pMARS's process exit code or exact error wording unless that is a deliberate compatibility requirement.

No reference source, executable, copied implementation, or capture runner is included. This directory is outside `test/fixtures` because the existing comparison tool treats every direct child of that directory as a warrior file. An implementation-side runner can consume this manifest without reading reference source.
