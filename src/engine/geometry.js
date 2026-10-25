// Geometry for torus battlefields (see design/3d-battlefield.md).
//
// The core is still a flat array of CORESIZE = X*Y*Z cells, and every field
// still holds one number in [0, CORESIZE). What changes is what a number
// *means*: it is a point of the torus Z_X x Z_Y x Z_Z, written in balanced
// mixed radix: x in [-X/2, X/2), then y, then z. So small numbers (1, -1,
// 12) are steps along x exactly as in classic Redcode, and [0,1] (= X) is a
// step along y. This is a one-to-one mapping, so storage, P-space, replay and
// post-mortems are unchanged.
//
// Addresses, the next instruction and ADD/SUB/MUL/DIV/MOD work per axis,
// each axis wrapping on its own: that is the geometry. Counters (DJN),
// pointer increments (< > { }) and SLT stay plain numbers, so loops count
// normally and a >ptr clear sweeps the whole torus row by row.
//
// With Y = Z = 1 every operation reduces to classic arithmetic modulo X:
// torus(N,1,1) is the classic ring, which the tests check against the
// pMARS-verified warriors.

export function makeGeometry(settings) {
  if (settings.topology !== 'torus') return null;
  const X = settings.sizeX, Y = settings.sizeY ?? 1, Z = settings.sizeZ ?? 1;
  const N = X * Y * Z;
  if (!(X >= 1 && Y >= 1 && Z >= 1) || N !== settings.coreSize) {
    throw new Error(`torus ${X}x${Y}x${Z} needs coreSize ${N}, not ${settings.coreSize}`);
  }
  const hx = Math.floor(X / 2), hy = Math.floor(Y / 2), hz = Math.floor(Z / 2);
  const wrap = (v, m) => ((v % m) + m) % m;
  const bal = (v, m, h) => wrap(v + h, m) - h;          // into [-h, m-h)

  // number -> balanced components, and back
  function decode(v) {
    v = wrap(v, N);
    const x = ((v + hx) % X) - hx;
    let r = (v - x) / X;
    const y = ((r + hy) % Y) - hy;
    r = (r - y) / Y;
    const z = ((r + hz) % Z) - hz;
    return [x, y, z];
  }
  function encode(x, y, z = 0) {
    return wrap(bal(x, X, hx) + X * (bal(y, Y, hy) + Y * bal(z, Z, hz)), N);
  }
  // Where a cell is drawn: its components as 0..X-1, 0..Y-1, 0..Z-1.
  function position(cell) {
    const [x, y, z] = decode(cell);
    return [wrap(x, X), wrap(y, Y), wrap(z, Z)];
  }
  // Per-axis operations. MUL/DIV/MOD use the components as 0..size-1, like
  // classic Redcode uses 0..CORESIZE-1. DIV and MOD leave a component alone
  // where the divisor's component is 0, and fail (null) only when every
  // divisor component is 0.
  function lift(fn) {
    return (a, b) => {
      const [ax, ay, az] = decode(a), [bx, by, bz] = decode(b);
      return encode(fn(ax, bx, X), fn(ay, by, Y), fn(az, bz, Z));
    };
  }
  // ADD and SUB (and every address calculation) are the hot path, so they
  // work on the components directly without allocating.
  function addsub(a, b, sign) {
    const ax = ((a + hx) % X) - hx, ra = (a - ax) / X, ay = ((ra + hy) % Y) - hy;
    const bx = ((b + hx) % X) - hx, rb = (b - bx) / X, by = ((rb + hy) % Y) - hy;
    let az = 0, bz = 0;
    if (Z > 1) { az = ((((ra - ay) / Y) + hz) % Z) - hz; bz = ((((rb - by) / Y) + hz) % Z) - hz; }
    const x = ((((ax + sign * bx + hx) % X) + X) % X) - hx;
    const y = ((((ay + sign * by + hy) % Y) + Y) % Y) - hy;
    const z = Z > 1 ? ((((az + sign * bz + hz) % Z) + Z) % Z) - hz : 0;
    const v = (x + X * (y + Y * z)) % N;
    return v < 0 ? v + N : v;
  }
  const add = (a, b) => addsub(a, b, 1);
  const sub = (a, b) => addsub(a, b, -1);
  const mul = lift((p, q, m) => wrap(p, m) * wrap(q, m));
  function divmod(isMod) {
    return (a, b) => {
      const pa = decode(a), pb = decode(b), size = [X, Y, Z], out = [0, 0, 0];
      let any = false;
      for (let k = 0; k < 3; k++) {
        const p = wrap(pa[k], size[k]), q = wrap(pb[k], size[k]);
        if (q === 0) { out[k] = p; continue; }
        any = true;
        out[k] = isMod ? p % q : Math.floor(p / q);
      }
      return any ? encode(out[0], out[1], out[2]) : null;
    };
  }
  // Chebyshev distance on the torus: the largest per-axis gap.
  function distance(a, b) {
    const [ax, ay, az] = decode(a), [bx, by, bz] = decode(b);
    const d = (p, q, m) => { const t = wrap(p - q, m); return Math.min(t, m - t); };
    return Math.max(d(ax, bx, X), d(ay, by, Y), d(az, bz, Z));
  }
  // How a field value reads in Redcode: a plain number when it lies on the
  // x axis, otherwise a vector literal.
  function format(v) {
    const [x, y, z] = decode(v);
    if (y === 0 && z === 0) return String(x);
    return Z > 1 ? `[${x},${y},${z}]` : `[${x},${y}]`;
  }
  // A warrior's code runs along x, and its labels are plain numbers. Only
  // numbers in [-X/2, X/2) are pure steps along x, so a warrior may be at most
  // this long: then every label distance stays on its own row.
  const maxCodeLength = Math.min(X - hx, hx + 1);
  return { X, Y, Z, N, decode, encode, position, add, sub, mul, div: divmod(false), mod: divmod(true), distance, format, maxCodeLength };
}
