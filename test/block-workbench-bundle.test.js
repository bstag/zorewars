// The website has no build step, so the Block Lab's worker bundle is committed.
// This fails when tools/algebra changed without "npm run build:workbench".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundleWorkbench, WORKBENCH_BUNDLE } from '../scripts/build-block-workbench.js';

test('web/vendor/block-workbench.js matches its sources', async () => {
  const { outputFiles } = await bundleWorkbench({ write: false });
  const committed = readFileSync(WORKBENCH_BUNDLE, 'utf8').replaceAll('\r\n', '\n');
  assert.ok(outputFiles[0].text === committed, 'stale bundle: run "npm run build:workbench" and commit the result');
});
