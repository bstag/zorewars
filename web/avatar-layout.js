// Body geometry and screen positions for the flat avatar view: no Canvas state.
export const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// A body's shape: segment centres and radius in body units (height 1, feet
// at y = 0, up is negative), laid along a spine that wiggles more the longer
// the warrior is, so a 100-instruction paper coils like a serpent.
export function spine(n) {
  const waves = n <= 8 ? 0 : Math.ceil(n / 10);
  const amp = n <= 8 ? 0 : 0.2;
  const top = n <= 8 ? 0.35 + n * 0.08 : 1;
  const pts = [];
  let len = 0;
  const S = 240;
  for (let k = 0; k <= S; k++) {
    const t = k / S;
    const p = [Math.sin(t * Math.PI * waves) * amp, -top * (1 - t) - 0.12];
    if (k) len += Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]);
    pts.push([...p, len]);
  }
  const r = Math.min(0.085, (len / Math.max(1, n)) * 0.6);
  const seg = [];
  for (let i = 0; i < n; i++) {
    const at = n === 1 ? 0 : (i / (n - 1)) * len;
    let k = 0;
    while (k < S && pts[k + 1][2] < at) k++;
    seg.push([pts[k][0], pts[k][1]]);
  }
  return { seg, r };
}

export function positionAvatar(b, warrior, alive, now) {
  const [bx, by] = b.base, s = b.scale, face = b.face;
  const elapsed = now - b.shake;
  const shake = elapsed >= 0 && elapsed < 300 ? (1 - elapsed / 300) * s * 0.03 : 0;
  const bob = alive ? Math.sin(now / 380 + warrior) * s * 0.012 : 0;
  const collapse = b.deadAt == null ? 0 : Math.min(1, Math.max(0, (now - b.deadAt) / 900));
  const r = b.r * s;
  for (let i = 0; i < b.cells.length; i++) {
    let lx = b.seg[i][0] * face, ly = b.seg[i][1];
    if (collapse) {
      lx = lx * (1 - collapse) + (hash(i + warrior * 101) - 0.5) * 0.5 * collapse;
      ly = ly * (1 - collapse) + (-b.r * (1 + hash(i * 7) * 1.5)) * collapse;
    }
    b.screen[i * 3] = bx + lx * s + (shake ? (hash(now + i) - 0.5) * shake * 2 : 0);
    b.screen[i * 3 + 1] = by + ly * s + bob;
    b.screen[i * 3 + 2] = i === 0 ? r * 1.45 : r;
  }
  b.center = [bx, by - s * 0.55];
  return { bob, collapse, r, dead: !alive };
}
