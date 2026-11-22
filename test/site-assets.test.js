// Cloudflare publishes the repository root minus .assetsignore, so a new
// top-level folder would go public by default. Every tracked top-level entry
// must be either part of the website (below) or listed in .assetsignore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const SITE = ['index.html', 'robots.txt', 'sitemap.xml', 'web', 'src', 'warriors', 'lang', 'LICENSE', 'NOTICE'];

test('every top-level entry is either the website or kept out of the deployment', (t) => {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return t.skip('not a git checkout');
  }
  const ignored = readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const covered = (name) => SITE.includes(name) || ignored.includes(name) || ignored.includes(`/${name}`)
    || ignored.some((rule) => rule.startsWith('*.') && name.endsWith(rule.slice(1)))
    || ignored.some((rule) => rule.endsWith('*') && name.startsWith(rule.slice(0, -1)));
  const top = [...new Set(tracked.split('\n').filter(Boolean).map((file) => file.split('/')[0]))];
  const unlisted = top.filter((name) => !covered(name));
  assert.deepEqual(unlisted, [], `add to .assetsignore, or to SITE in this test if it belongs on the website: ${unlisted.join(', ')}`);
});

// The header is copied into each page (the site has no build step); this keeps
// the copies from drifting apart.
test('every page has the same navigation, a menu button and the menu script', () => {
  const pages = ['index.html', 'docs.html', 'warriors.html', 'blocks.html', 'hills.html', 'history.html'];
  const links = (file) => {
    const html = readFileSync(new URL(`../web/${file}`, import.meta.url), 'utf8');
    const nav = /<nav class="nav" id="siteNav">([\s\S]*?)<\/nav>/.exec(html);
    assert.ok(nav, `${file}: no #siteNav`);
    // The arena loads nav.js from app.js; the other pages include it directly.
    assert.ok(html.includes('id="menuBtn"') && (html.includes('src="nav.js"') || html.includes('src="app.js"')), `${file}: menu button or nav.js missing`);
    assert.ok(html.includes('rel="icon"'), `${file}: no favicon`);
    const current = [...nav[1].matchAll(/<a href="[^"]*" aria-current="page">/g)].length;
    assert.equal(current, 1, `${file}: exactly one link should be marked as the current page`);
    return [...nav[1].matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(([, href, text]) => `${href.replace(/^#cli$/, 'docs.html#cli')} ${text}`);
  };
  const expected = links(pages[0]);
  assert.ok(expected.length >= 5);
  for (const file of pages.slice(1)) assert.deepEqual(links(file), expected, file);
});
