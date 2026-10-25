#!/usr/bin/env node
// Bundles the parts of three.js the WebGL Avatars view uses (listed in
// scripts/three-entry.js) into web/vendor/three.js: one ES module, so the site
// keeps working with no build step on Cloudflare and GitHub Pages alike. The
// arena loads it only when the Avatars view opens. Run after changing the
// pinned three.js version in package.json or the entry, and commit the output.
//   npm run build:three

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'three', 'package.json'), 'utf8')).version;

const out = path.join(ROOT, 'web', 'vendor', 'three.js');
await build({
  entryPoints: [path.join(ROOT, 'scripts', 'three-entry.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  outfile: out,
  legalComments: 'none',
  banner: {
    js: `/* three.js ${version} (MIT License, Copyright © 2010-2026 three.js authors), https://threejs.org\n   Bundled for ZoreWars by scripts/build-three.js: only what web/avatars3d.js uses (scripts/three-entry.js) */`,
  },
});
fs.copyFileSync(path.join(ROOT, 'node_modules', 'three', 'LICENSE'), path.join(ROOT, 'web', 'vendor', 'LICENSE-three.txt'));
console.log(`wrote ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
