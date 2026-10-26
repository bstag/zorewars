import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceOutcome } from '../scripts/pmars-result.js';

test('pMARS process failures are distinct from assembler rejection', () => {
  assert.equal(referenceOutcome({ status: 0 }), 'accepted');
  assert.equal(referenceOutcome({ status: 3, stderr: 'Bad expression' }), 'rejected');
  assert.equal(referenceOutcome({ status: 0, stderr: 'Error in line 3: bad\r\nToo many instructions' }), 'inconsistent');
  assert.equal(referenceOutcome({ status: 3, stderr: 'Error in line 3: bad' }), 'rejected');
  assert.equal(referenceOutcome({ status: 0, stderr: 'Warning: missing assertion' }), 'accepted');
  for (const status of [3221225477, -1073741819, 139, null]) assert.equal(referenceOutcome({ status }), 'crash');
  assert.equal(referenceOutcome({ status: null, signal: 'SIGSEGV' }), 'crash');
  assert.equal(referenceOutcome({ status: 3, stderr: 'Error in asm.c. Line: 846' }), 'crash');
  assert.equal(referenceOutcome({ status: null, error: { code: 'ETIMEDOUT' } }), 'timeout');
  assert.equal(referenceOutcome({ status: null, error: 'spawn ETIMEDOUT', errorCode: 'ETIMEDOUT' }), 'timeout');
  assert.equal(referenceOutcome({ status: null, error: { code: 'ENOENT' } }), 'launch-error');
});
