#!/usr/bin/env node
// Bundles CodeMirror 6 into web/vendor/codemirror.js: one ES module, so the
// site keeps working with no build step and all packages share one copy of
// @codemirror/state. Run after changing the pinned CodeMirror versions in
// package.json, and commit the output.
//   npm run build:editor

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const versions = Object.entries(pkg.devDependencies)
  .filter(([n]) => n.startsWith('@codemirror/') || n.startsWith('@lezer/'))
  .map(([n, v]) => `${n}@${v}`).join(', ');

const out = path.join(ROOT, 'web', 'vendor', 'codemirror.js');
await build({
  entryPoints: [path.join(ROOT, 'scripts', 'editor-entry.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  outfile: out,
  legalComments: 'none',
  banner: {
    js: `/* CodeMirror 6 and Lezer (MIT License, Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others), https://codemirror.net\n   Bundled for ZoreWars by scripts/build-editor.js: ${versions} */`,
  },
});
console.log(`wrote ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
