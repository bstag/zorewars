// Fetching warriors from public Core War archives, so the originals can be
// battled without being copied into this repository. Used by the CLI, the
// dev server's /api/fetch proxy and the Cloudflare Worker (worker/index.js),
// so it must only use web-standard APIs.
//
// Remote files are only ever assembled as Redcode. Nothing fetched from the
// network is executed as JavaScript, Python or C++.

// Hosts the arena's fetch proxy may contact. (The CLI accepts any URL the
// user types; the proxy is reachable from web pages, so it is restricted.)
export const ARCHIVE_HOSTS = [
  'gallium.inria.fr',          // Planar's (Damien Doligez's) archive
  'asdflkj.net',               // Koenigstuhl hills
  'www.asdflkj.net',
  'corewar.co.uk',
  'www.corewar.co.uk',
  'corewar.info',
  'www.corewar.info',
  'sal.discontinuity.info',
  'koth.org',
  'www.koth.org',
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
];

export const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 15000;

export function parseWarriorUrl(text, { anyHost = false } = {}) {
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`not a valid URL: ${text}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('only http and https URLs are supported');
  if (!anyHost && !ARCHIVE_HOSTS.includes(url.hostname)) {
    throw new Error(`${url.hostname} is not a known Core War archive. Allowed: ${ARCHIVE_HOSTS.join(', ')}`);
  }
  if (/\.(m?js|py|cpp|cc|cxx|exe|sh)$/i.test(url.pathname)) {
    throw new Error('only Redcode can be loaded from a URL; generator programs are never run from the network');
  }
  return url;
}

export async function fetchWarriorText(text, options = {}) {
  const url = parseWarriorUrl(text, options);
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  // Redirects must also stay on the allowed hosts.
  parseWarriorUrl(res.url || url.href, options);
  if (!res.ok) throw new Error(`${url.href}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (type && !/^text\/|application\/octet-stream/.test(type)) throw new Error(`${url.href}: not a text file (${type})`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error(`${url.href}: file is larger than ${MAX_BYTES / 1024} KB`);
  return { text: new TextDecoder().decode(buf), url: res.url || url.href };
}

// "Iron%20Gate%5B2%5D.txt" -> "IronGate". Used when a file has no ;name.
export function nameFromUrl(url) {
  const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'warrior');
  return base.replace(/\.[^.]+$/, '').replace(/\[\d+\]$/, '') || 'warrior';
}
