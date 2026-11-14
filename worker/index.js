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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fetch') {
      if (request.method !== 'GET') return text('GET only', 405, { Allow: 'GET' });
      const started = performance.now();
      const importWarrior = async span => {
        try {
          const { text: body, url: source } = await fetchWarriorText(url.searchParams.get('url') || '');
          span?.setAttribute('zorewars.outcome', 'ok');
          console.info({ event: 'archive_import', outcome: 'ok', durationMs: Math.round(performance.now() - started) });
          // Archive files rarely change, so let browsers cache them for a day.
          return text(body, 200, { 'X-Source-Url': source, 'Cache-Control': 'public, max-age=86400' });
        } catch (e) {
          span?.setAttribute('zorewars.outcome', 'failed');
          console.warn({ event: 'archive_import', outcome: 'failed', durationMs: Math.round(performance.now() - started) });
          return text(e.message, 400, { 'Cache-Control': 'no-store' });
        }
      };
      return ctx?.tracing ? ctx.tracing.enterSpan('zorewars.archive_import', importWarrior) : importWarrior();
    }
    if (url.pathname.startsWith('/api/')) return text('not found', 404);
    return env.ASSETS.fetch(request);
  },
};
