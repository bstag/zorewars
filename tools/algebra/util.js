// Helpers shared by the blocks.

// The step of an N-point imp spiral: N steps land one cell past the start. 0 when there is none.
export function modInverse(n, core) { for (let s = 1; s < core; s++) if ((n * s) % core === 1) return s; return 0; }
