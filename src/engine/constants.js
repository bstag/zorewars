// Shared tables for the ZoreWars virtual machine (ICWS'94-style Redcode).

export const OPCODES = [
  'DAT', 'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD',
  'JMP', 'JMZ', 'JMN', 'DJN', 'SPL', 'SLT', 'SEQ', 'SNE', 'NOP',
  'LDP', 'STP', // P-space: private memory that survives between rounds
  'TRN',        // torus battlefields: turn the process to face along A (see geometry.js)
];
// CMP is the historical name for SEQ.
export const OPCODE_ALIASES = { CMP: 'SEQ' };

export const MODIFIERS = ['A', 'B', 'AB', 'BA', 'F', 'X', 'I'];

// Mode characters, in a fixed order so they can be stored as small integers.
export const MODES = ['#', '$', '*', '@', '{', '<', '}', '>'];

export const OP = Object.fromEntries(OPCODES.map((o, i) => [o, i]));
export const MOD = Object.fromEntries(MODIFIERS.map((m, i) => [m, i]));
export const MODE = {
  IMMEDIATE: 0, // #
  DIRECT: 1,    // $
  A_INDIRECT: 2, // *
  B_INDIRECT: 3, // @
  A_PREDEC: 4,  // {
  B_PREDEC: 5,  // <
  A_POSTINC: 6, // }
  B_POSTINC: 7, // >
};

export const DEFAULT_SETTINGS = Object.freeze({
  coreSize: 8000,
  maxCycles: 80000,
  maxProcesses: 8000,
  maxLength: 100,
  minDistance: 100,
  rounds: 1,
});

// Standard hill rule sets (pMARS command lines in the comments). Tournaments
// such as the Core War Tournament Weekend use these with a shorter maximum
// length (--length 50) and no P-space. '94x-hill' is the Koenigstuhl X hill
// itself, where P-space is allowed (most of its leaders use it).
export const RULESETS = Object.freeze({
  '94nop': { coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, maxLength: 100, minDistance: 100, pSpace: false },   // pmars -s 8000 -p 8000 -c 80000 -d 100
  '88':    { coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, maxLength: 100, minDistance: 100, pSpace: false, dialect: '88' },   // pmars -8 ...
  lp:      { coreSize: 8000, maxProcesses: 8, maxCycles: 80000, maxLength: 100, minDistance: 200, pSpace: false },      // pmars -s 8000 -p 8 -c 80000 -d 200
  '94x':   { coreSize: 55440, maxProcesses: 10000, maxCycles: 500000, maxLength: 200, minDistance: 200, pSpace: false },  // pmars -s 55440 -p 10000 -c 500000 -l 200 -d 200
  '94x-hill': { coreSize: 55440, maxProcesses: 10000, maxCycles: 500000, maxLength: 200, minDistance: 200, pSpace: true },  // the same, with P-space
});

export const MODE_NAMES = {
  '#': 'immediate',
  '$': 'direct',
  '*': 'A-field indirect',
  '@': 'B-field indirect',
  '{': 'A-field predecrement indirect',
  '<': 'B-field predecrement indirect',
  '}': 'A-field postincrement indirect',
  '>': 'B-field postincrement indirect',
};

// Default P-space size, as pMARS computes it: the core size divided by its
// largest divisor up to 16 (500 for the standard 8000-cell core).
export function pSpaceSizeFor(settings) {
  if (settings.pSpaceSize) return settings.pSpaceSize;
  for (let i = 16; i > 0; i--) if (settings.coreSize % i === 0) return settings.coreSize / i;
  return settings.coreSize;
}

// Minimum distance between warriors' start addresses. pMARS uses the
// maximum length when no distance is given.
export function separationFor(settings) {
  return settings.minDistance || settings.maxLength;
}

// Points for each survivor of a round, pMARS's default (W*W-1)/S: with two
// warriors a win scores 3 and a tie 1.
export function roundPoints(warriors, survivors) {
  return survivors ? Math.floor((warriors * warriors - 1) / survivors) : 0;
}

// ICWS'94 rules for the modifier used when the source omits one.
export function defaultModifier(op, aMode, bMode) {
  switch (op) {
    case 'DAT':
    case 'NOP':
      return 'F';
    case 'MOV':
    case 'SEQ':
    case 'SNE':
      if (aMode === '#') return 'AB';
      if (bMode === '#') return 'B';
      return 'I';
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
    case 'MOD':
      if (aMode === '#') return 'AB';
      if (bMode === '#') return 'B';
      return 'F';
    case 'SLT':
    case 'LDP':
    case 'STP':
      return aMode === '#' ? 'AB' : 'B';
    default: // JMP JMZ JMN DJN SPL
      return 'B';
  }
}
