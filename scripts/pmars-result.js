// pMARS assembly rejection is exit 3. Other process failures are not language
// verdicts (Windows access violations arrive as a numeric status, no signal).
export function referenceOutcome(result) {
  if ((result.error?.code ?? result.errorCode) === 'ETIMEDOUT') return 'timeout';
  if (result.error) return 'launch-error';
  if (result.signal || ![0, 3].includes(result.status) || /Error in asm\.c/.test(String(result.stderr ?? '') + String(result.stdout ?? ''))) return 'crash';
  // Some reference error paths print fatal diagnostics and a damaged listing
  // but return success. Such contradictory output is no language verdict.
  if (result.status === 0 && /^Error\b/m.test(String(result.stderr ?? ''))) return 'inconsistent';
  return result.status === 0 ? 'accepted' : 'rejected';
}
