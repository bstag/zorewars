// Cloudflare Worker for ZoreWars.
//
// The site itself is static and served by Workers Static Assets without
// running this code (see wrangler.jsonc). The Worker only handles
// /api/fetch, the read-only proxy that lets the arena import warriors from
// Core War archives that don't send CORS headers. It shares its allow-list,
// size limit and "Redcode only" rule with the CLI (cli/remote.js).

import { fetchWarriorText } from '../cli/remote.js';

const text = (body, status, headers = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fetch') {
      if (request.method !== 'GET') return text('GET only', 405, { Allow: 'GET' });
      try {
        const { text: body, url: source } = await fetchWarriorText(url.searchParams.get('url') || '');
        // Archive files rarely change, so let browsers cache them for a day.
        return text(body, 200, { 'X-Source-Url': source, 'Cache-Control': 'public, max-age=86400' });
      } catch (e) {
        return text(e.message, 400, { 'Cache-Control': 'no-store' });
      }
    }
    if (url.pathname.startsWith('/api/')) return text('not found', 404);
    return env.ASSETS.fetch(request);
  },
};
