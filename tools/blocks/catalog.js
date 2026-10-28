import { OPCODES, MODES, MODIFIERS, MODE_NAMES, RULESETS } from '../../src/engine/constants.js';
import { leaderPatterns } from './leader-reviews.js';

export const standaloneRecipes = [{
  id: 'lifeboat-94x', family: 'stone with watchdog clear',
  purpose: 'Original contiguous boot, bounded guarded bomber and independent fallback process.',
  implementation: 'tools/blocks/airbag.js', runner: 'scripts/evolve-airbag.js',
  rules: ['94x'], topology: 'ring', instructions: '27/31 in place; 33/37 booted',
  parameters: ['BOOT','STEP','HOP','SHOTS','BOMB','BACKWARD','PHASE','STUN'],
  entry: 'One process at boot or launch; private pristine payload.',
  processes: 'Two processes during bombing; stone retires intentionally, watchdog exclusively owns clear counters; one final survivor in tested scenarios.',
  writes: 'Bombs and clear exclude the complete active payload. Probe, timers, flag and clear pointers are private mutable B-fields.',
  transitions: ['bombing count exhausted','watched stone instruction changed','watchdog timeout'],
  validation: { behaviorTest: 'test/airbag.test.js', benchmark: 'docs/lifeboat-results.json' },
  composition: 'A separate process-aware grammar; do not splice into single-process clear recipes.',
  limitations: 'Tests cover exact copy, attack coverage and selected injected faults, not arbitrary enemy damage. Initial search did not establish general superiority.',
}];

const contract = {
  topology: 'ring', dialects: ['88', '94'], rules: Object.keys(RULESETS),
  entry: 'Exactly one process; private pointers and counters; pristine image.',
  processEffect: 'One process throughout; SPL is written as a bomb, never executed locally.',
  cost: 'Measured after assembly, including data and linking instructions.',
  searchLimits: 'Current shared search: STEP 1..2048, HOP 256..7000, WAIT 1..768, STUN 1..4096. This deliberately bounded first grammar does not cover every landing site in 94x.',
  validation: { documented: true, behaviorTest: 'test/blocks.test.js', benchmark: null },
  limitations: 'Solo behavior does not guarantee safety after enemy writes. No arbitrary block ordering or shared-state concurrency.',
};
function usable(id, family, purpose, parameters, reads, writes, exit, sources) {
  return { id, family, purpose, parameters, ...contract, reads, writes, exit, sources,
    implementation: 'tools/blocks/recipes.js', selectable: true };
}
function candidate(id, family, purpose, sources, requirements) {
  return { id, family, purpose, sources, requirements, selectable: false,
    validation: { documented: true, behaviorTest: null, benchmark: null },
    limitation: 'Source reference only. Section boundaries are not a proven independent block.' };
}
export const blocks = [
  usable('opening-none', 'control', 'Skip attack and transfer immediately.', [], [], [], 'transition', ['examples/experimental-94x/molting-phases.js']),
  usable('opening-bomber', 'attack', 'Bounded stride DAT bombing with own-image guard.', ['STEP', 'WAIT'], ['probe', 'clock', 'clearKill'], ['probe.B', 'clock.B', 'core outside original image'], 'transition when timer reaches zero', ['warriors/dwarf.red', 'examples/experimental-94x/molting-phases.js']),
  usable('opening-bscan', 'scan', 'B-field scan with bounded SPL bombing and timer.', ['STEP', 'WAIT'], ['probe', 'clock', 'target.B', 'clearStun'], ['probe.B', 'clock.B', 'core outside original image'], 'transition when timer reaches zero', ['warriors/scanner.red', 'examples/experimental-94x/molting-phases.js']),
  usable('relocate-copy', 'movement', 'Backward copy of a self-contained payload; jump once into the copy.', ['HOP'], ['payload', 'copySource', 'copyTarget', 'copyCount'], ['copy pointers', 'copyCount.B', 'destination payload range'], 'payload at HOP', ['examples/experimental-94x/molting-phases.js', 'warriors/gemini.red']),
  usable('enter-in-place', 'control', 'Enter the payload in the original image.', [], [], [], 'payload', ['examples/experimental-94x/molting-phases.js']),
  usable('clear-dat', 'clear', 'Repeated bounded DAT passes excluding the complete active payload.', ['BACKWARD'], ['clearKill', 'clearPtr', 'remaining'], ['clearPtr.B', 'remaining.B', 'core outside active payload'], 'terminal loop', ['examples/experimental-94x/molting-phases.js']),
  usable('clear-stun-dat', 'clear', 'Short or full SPL pass, then reset pointer for repeated DAT passes.', ['BACKWARD', 'PHASE', 'STUN'], ['clearStun', 'clearKill', 'clearPtr', 'remaining'], ['clearPtr.B', 'remaining.B', 'core outside active payload'], 'terminal loop', ['warriors/twopass.red', 'examples/experimental-94x/molting-phases.js']),
  candidate('marker-trigger', 'trigger', 'Change phase when a remote marker is damaged, with timer fallback.', ['examples/experimental-94x/molting-phases.js'], 'Existing Molting verifier covers the whole template; extract sensor placement and marker ownership contracts.'),
  candidate('compare-scan', 'scan', 'Compare two cells to detect an opponent.', ['warriors/seeker.red', 'warriors/gatekeeper.js'], 'Preserve scan offsets, skip/jump coupling, self-scan exclusion and attack handoff.'),
  candidate('quickscan', 'scan', 'Unrolled early probes followed by a targeting decoder.', ['warriors/quickscan.js', 'warriors/blitz.js'], 'Tables, decoder constants and probe order form one linked section; measure instruction cost.'),
  candidate('one-shot', 'scan', 'Switch from scanning to a clear on the first hit.', ['warriors/oneshot.red'], 'Scanner and clear must agree on pointer interpretation and direction.'),
  candidate('vampire-fang', 'capture', 'Place a jump that transfers opponent processes to a pit.', ['warriors/vampire.red'], 'Fang and pit are linked by destination-relative arithmetic; copying a fang alone changes its target.'),
  candidate('paper-copy', 'replication', 'Copy a body and launch it elsewhere.', ['warriors/mice.red'], 'Per-copy counters, initialization and parent/child scheduling; safe overlap must be tested.'),
  candidate('silk-launch', 'replication', 'SPL/MOV replication using cooperating processes.', ['warriors/silk.red', 'warriors/fastsilk.js', 'warriors/papercut.js'], 'Process count and scheduling are part of the interface; incompatible with single-process clear counters.'),
  candidate('imp-spiral', 'survival', 'Launch mutually supporting imp processes.', ['warriors/impring.red', 'warriors/stoneimp.red'], 'Core-relative stride congruences, launch order and process budget; impring fails solo on 94x.'),
  candidate('decrement-gate', 'defense', 'Damage advancing imps or streams through a guarded cell.', ['warriors/gatekeeper.js', 'warriors/stunner.red'], 'Gate location and timing must match the clear; no blanket anti-imp guarantee.'),
  candidate('pspace-selector', 'control', 'Select behavior using persistent round outcomes.', ['warriors/chameleon.js', 'warriors/bandit.js'], 'Requires P-space-enabled profile, cell ownership and multi-round tests. Forbidden under 88, lp, 94nop and 94x.'),
  candidate('torus-turn', 'geometry', 'Turn and sweep across axes.', ['warriors/plane/raster.js', 'warriors/volume/battleship.js'], 'TRN extension, heading on entry/exit, dimension-specific bounds; not ring code.'),
  candidate('torus-replicate', 'replication', 'Distribute copies through a volume.', ['warriors/volume/scatter.js', 'warriors/volume/slant.js'], 'Vector offsets, heading inheritance, copy overlap and geometry-specific cycle coverage.'),
  candidate('anti-clear-relocation', 'movement', 'Watch a clear front and jump behind it.', ['warriors/volume/leapfrog.js', 'warriors/volume/adapter.js', 'warriors/prototypes/README.md'], 'Sensor direction, latency and safe landing; preserve negative hybrid evidence in prototypes README.'),
  ...leaderPatterns.map(p => candidate(p.id, 'leader-derived', p.contract, ['docs/hill-leaders.md'], p.tests.join('; '))),
];

const effects = {
  DAT: 'Terminates executing process; addressing side effects still matter.', MOV: 'Copies selected fields or whole instruction (.I).',
  ADD: 'Adds source to destination fields modulo core.', SUB: 'Subtracts source from destination fields modulo core.',
  MUL: 'Multiplies destination fields by source.', DIV: 'Integer division; zero divisor terminates process.', MOD: 'Remainder; zero divisor terminates process.',
  JMP: 'Transfers current process to A.', JMZ: 'Jumps when selected B fields are zero.', JMN: 'Jumps when selected B fields are nonzero.',
  DJN: 'Decrements selected B fields and conditionally jumps.', SPL: 'Adds a child process subject to process limit.',
  SLT: 'Skips next instruction when selected source fields are less.', SEQ: 'Skips next instruction on equality; CMP is an alias.', SNE: 'Skips next instruction on inequality.',
  NOP: 'No opcode action; addressing can still mutate pointers.', LDP: 'Loads P-space into core fields.', STP: 'Stores core fields into P-space.', TRN: 'ZoreWars torus extension: changes process heading.',
};
const old = new Set('DAT MOV ADD SUB JMP JMZ JMN DJN SPL SLT SEQ'.split(' '));
export function instructionCatalog() {
  return { profiles: RULESETS, supportedDialects: ['88', '94'], unsupportedHistoricalDialects: ['86'],
    modifiers: MODIFIERS, modes: MODES, modeNames: MODE_NAMES,
    modifierEffects: { A: 'A to A', B: 'B to B', AB: 'A to B', BA: 'B to A', F: 'A to A and B to B', X: 'A to B and B to A', I: 'Whole instruction for MOV/SEQ/SNE; numeric field behavior for other opcodes; see engine semantics' },
    directives: ['EQU', 'ORG', 'END', 'FOR', 'ROF', ';assert'],
    restrictions88: { modes: ['#', '$', '@', '<'], explicitModifiers: false, entry: 'END (ORG forbidden)',
      dat: '# or < operands only', immediateDestinationForbidden: ['MOV', 'ADD', 'SUB', 'CMP'], immediateTargetForbidden: ['JMP', 'JMZ', 'JMN', 'DJN', 'SPL'], equalitySpelling: 'CMP' },
    instructions: OPCODES.map(op => ({ op, effect: effects[op], dialect88: old.has(op), source88: op === 'SEQ' ? 'CMP' : op,
      requires: op === 'TRN' ? 'torus' : ['LDP', 'STP'].includes(op) ? 'P-space enabled' : 'none' })),
    authority: ['src/engine/assembler.js', 'src/engine/constants.js', 'src/engine/vm.js'],
    references: ['https://corewars.org/docs/94spec.html'],
    note: 'Describes this engine, including extensions; compilation is authoritative. Profiles are settings, not separate instruction sets. Assembly success is not behavioral compatibility.' };
}

export function catalogMarkdown(inventory) {
  const counts = inventory ? `\nInventory: ${inventory.local.length} local source files, ${inventory.public.length} public references (${inventory.public.filter(x => x.status === 'inspected').length} inspected). See [source map](block-sources.json) for hashes, line ranges, dependencies, family hints and failures.\n` : '';
  return `# Warrior block catalog\n\nGenerated by \`node scripts/blocks.js catalog\`. Edit definitions in \`tools/blocks/catalog.js\`.\n${counts}\n## Executable grammar\n\nOpening (none / timed bomber / timed B-scan) → transfer (in place / relocation) → terminal clear (DAT / short stun then DAT / full stun then DAT). Both directions are supported. Every recipe assembles with symbolic labels, measures its size, and passes a full solo behavioral gate before evolution can evaluate it. P-space and torus code are inventoried but cannot enter this ring grammar.\n\nThe '88 implementation uses explicit forward pointer increments, legal DAT operands, CMP spelling where needed and END entry. It is not a modifier-stripped '94 conversion. Source section discovery is heuristic; only the seven explicit implementations below are selectable.\n\n## Blocks\n\n| Block | Purpose | Admission | Parameters / extraction requirements |\n|---|---|---|---|\n` + blocks.map(b => `| ${b.id} | ${b.purpose} | ${b.selectable ? 'Executable; behavioral gate required' : 'Documented candidate'} | ${b.selectable ? b.parameters.join(', ') || 'none' : b.requirements} |`).join('\n') + `\n\nFull contracts and source references: [machine catalog](block-catalog.json). Behavioral evidence belongs to a recipe, settings and source hash, not to a strategy name. Benchmark evidence is separate from correctness.\n\n## Supported profiles\n\n| Profile | Core | Processes | Cycles | Default length | P-space |\n|---|---:|---:|---:|---:|---|\n` + Object.entries(RULESETS).map(([k,s]) => `| ${k} | ${s.coreSize} | ${s.maxProcesses} | ${s.maxCycles} | ${s.maxLength} | ${s.pSpace} |`).join('\n') + `\n\nFull instruction legality and effects: [instruction catalog](block-instructions.json). Historical '86 is not separately implemented. Torus is an engine extension with separate geometry requirements. The engine's profiles are the source of truth (including lp's current 100-instruction default).\n\n## Workflow\n\n1. Rebuild inventory: \`node scripts/blocks.js inventory\`. Add \`--public\` to refresh the 35 public archive references. Downloads stay in ignored \`imported/block-sources/\`; metadata is tracked. Failed fetches remain visible.\n2. Generate documentation: \`node scripts/blocks.js catalog\`.\n3. Make a legal, behavior-checked warrior: \`node scripts/blocks.js build --rules 94x --out evolved/blocks/sample\`. Writes Redcode, recipe/contract evidence and a JavaScript generator usable with the existing tuner.\n4. Evolve choices and parameters: \`node scripts/evolve-blocks.js --rules 94x --out evolved/block-search\`. Saved recipes include source hashes, parents and emitted section boundaries.\n5. Parameter tuning: \`node cli/zorewars.js tune evolved/blocks/sample.js --rules 94x --length 50 --candidates 12\`. Tuner output must pass \`blocks.js verify\` with its saved parameter object before promotion; the ordinary tuner does not call the block gate.\n6. Re-check a saved recipe: \`node scripts/blocks.js verify --recipe evolved/blocks/sample.recipe.json\`. Changing JSON parameters recompiles and rechecks; do not label hand-edited Redcode as verified by the old receipt.\n\n## Adding a family\n\nRecord provenance and source hash, find symbolic dependencies, define process/memory/entry/exit contracts, then implement an emitter and adversarial behavior tests. Demonstrate actual copy, attack and phase behavior at wrapping placements before admission. Keep old recipes reproducible by preserving their parameters, emitted source and version. Public code is reference material; an unknown license is not permission to redistribute it. Neither an inferred label boundary nor a successful assembly promotes a source into the grammar.\n\nResearch foundation: [annotated ICWS '94 draft](https://corewars.org/docs/94spec.html), local engine semantics, and archive URLs in the source map. The draft is historical; extensions are explicitly identified.\n`;
}
