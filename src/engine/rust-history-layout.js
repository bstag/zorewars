// One Rust history record per executed instruction. See the matching constants
// in tools/ring-duel-wasm.rs.
export const HISTORY_VERSION = 2;
export const HISTORY_BATCH = 128;
export const HISTORY_WORDS = 29;
export const HISTORY_WRITE_WORDS = 7;
export const HISTORY_SUCCESSORS = 22;
export const HISTORY_PSPACE = 24;
export const HISTORY_ACTOR = 26;
export const HISTORY_PC = 27;
export const HISTORY_CYCLE = 28;
export const HISTORY_NONE = 0xffffffff;
