// Shared lockstep SPL fan layout for contracts and code emission.
export function fanLines(n) {
  let m = n, lines = [];
  while (m > 1 && m % 2 === 0) { lines.push('1'); m /= 2; }
  if (m === 3) lines = ['2', '1', ...lines]; else if (m !== 1) return null;
  return lines.length ? lines : null;
}
