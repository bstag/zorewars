# Lifeboat 94x

An original ZoreWars recipe, informed by the stone/fallback pattern in the
[leader study](../../../docs/hill-leaders.md). It does not copy that reference's
instructions, launcher or controller. It boots one contiguous image and starts
two processes: a guarded bomber and a watchdog. The watchdog exclusively owns
the clear's pointers and counters.

The default is **37 instructions**. Direct DAT fallback removes four
instructions; running in place removes the six-instruction boot. The fallback
starts when the bombing count finishes, the watched stone instruction changes,
or a separate timer expires. The stone process's final DAT is intentional
retirement; the warrior remains alive through the clear process.

`lifeboat.js` / `lifeboat.red` preserve the declared default. `lifeboat-ga-4247.js`
is the best screening specimen from the first search, not a recommended upgrade:
its training score improved while comparison performance fell. Both remain
outside the default warrior library.

```sh
node cli/zorewars.js check examples/experimental-94x/lifeboat/lifeboat.js --rules 94x --length 50 --json
node scripts/airbag.js verify --generator examples/experimental-94x/lifeboat/lifeboat.js
node scripts/airbag.js build --out evolved/my-lifeboat
node scripts/evolve-airbag.js --out evolved/lifeboat-run2 --seed 4248
node cli/zorewars.js tune evolved/my-lifeboat.js --rules 94x --length 50 --candidates 20
node scripts/airbag.js verify --generator evolved/my-lifeboat.js
```

The generator exposes BOOT, STEP, HOP, SHOTS, BOMB, BACKWARD, PHASE and STUN.
HOP is inactive in place; STUN is inactive for direct DAT/full-stun modes.
The watchdog deadline is derived from SHOTS rather than mutated independently.
To tune numbers only, restrict SPACE to STEP, HOP, SHOTS and STUN while keeping
all fields in P. Check the saved generator after tuning: ordinary CLI tuning
does not itself run this family's full behavioral gate.

Admission checks compare the entire copied image at normal positions and with
either the source or destination wrapping across the core boundary,
check expected bomb locations/counts and protected state, require two processes
and a single final survivor, verify SPL/DAT phase behavior, and inject fatal
damage into the watched instruction and an unwatched instruction. The latter
must fall back through the timeout. These are selected fault tests, not a
guarantee against arbitrary opponent writes.

The first CPU experiment ran 5,808 battle rounds. The public stone reference
remains much stronger. See [results](../../../docs/lifeboat-results.json) and
[journal E7](../../../docs/molting-94x-journal.md) for controls and uncertainty.
The [family history](../../../docs/warrior-family-history.md) explains why boot,
transition logic and process scheduling need separate comparisons.
