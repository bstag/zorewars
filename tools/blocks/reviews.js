// Hand-reviewed anatomy of public reference sources, pinned to the bytes read.
// These notes do not license, copy, or admit their implementations to evolution.
export const publicReviews = [
  { name: 'MICE', hash: 'b2a9850a2ea6d7484ac59f7c66290419a40b714292b845637e3f24acff94da1a', block: 'paper-copy',
    parts: [{ lines: [11,12], role: 'Private counter and initialization' }, { lines: [13,14], role: 'Backward copy loop' }, { lines: [15,17], role: 'Launch copy, advance destination and restart' }, { lines: [18,18], role: 'Destination pointer storage' }],
    contract: 'Copy extent includes cells beyond the visible body; preserve initialization, both pointers and child entry together. Do not infer copy length from the number of source instructions.' },
  { name: 'Silk Warrior 1.3', hash: '96544c797149ae4cbd3948cc22bce2f044a2d2952834f695ab3248e477d8e0e4', block: 'silk-launch',
    parts: [{ lines: [19,23], role: 'Process launcher' }, { lines: [25,26], role: 'Child launch and copying' }, { lines: [27,31], role: 'Bombing, continuation and gate data' }],
    contract: 'Launcher scheduling, paper pointer side effects and gate data belong to one recipe. Its 8000-cell assertion is a real compatibility requirement, not merely an annotation.' },
  { name: 'Torch t18', hash: 'f23d573bcdb44fb1b40cafde481e8e20757d216ac7ab3c30f3616c675330c65b', block: 'relocate-copy',
    parts: [{ lines: [13,24], role: 'Two-process boot and pointer erasure' }, { lines: [29,35], role: 'Clear/gate state and padding' }, { lines: [36,40], role: 'Paired incendiary bombs and self-modifying transition' }, { lines: [41,46], role: 'Clear and second bomb component' }, { lines: [47,55], role: 'Padding and decoy data' }],
    contract: 'Booted regions are noncontiguous and share two processes. This boot cannot replace the catalog single-process copy; bomb arithmetic and self-triggered handoff also need their own contracts.' },
  { name: 'Iron Gate 1.5', hash: '83a62c4987614d363fc5e9fb27b6054111c57389fa3e8a5dd4ce23361f3ca4bd', block: 'compare-scan',
    parts: [{ lines: [6,7], role: 'Coupled spacing constants' }, { lines: [9,12], role: 'Compare scan and decrement stream' }, { lines: [13,16], role: 'Attack and scan pointer update' }, { lines: [17,21], role: 'SPL/JMP bombs and arithmetic data' }],
    contract: 'The scan and bombing sections modify each other through indirect references. Preserve pointer coupling and spacing constraints before trying to separate the attack.' },
];
