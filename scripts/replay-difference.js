// First structural mismatch used to diagnose replay divergence.
export function difference(actual, wanted, where = '') {
  if (Object.is(actual, wanted)) return null;
  if (actual === null || wanted === null || typeof actual !== 'object' || typeof wanted !== 'object') return { path: where, actual, expected: wanted };
  if (Array.isArray(actual) !== Array.isArray(wanted)) return { path: where, actualType: typeof actual, expectedType: typeof wanted };
  const aKeys = Object.keys(actual).sort(), bKeys = Object.keys(wanted).sort();
  if (JSON.stringify(aKeys) !== JSON.stringify(bKeys)) return { path: where, actualKeys: aKeys, expectedKeys: bKeys };
  for (const key of aKeys) { const diff = difference(actual[key], wanted[key], where + '/' + key); if (diff) return diff; }
  return null;
}
