import { DurableObject } from 'cloudflare:workers';
import { handleDiscord, sendToBattleOrigin } from './discord.js';
import { publicStandings } from './discord-hills.js';

const PORT = 8788;
const IDLE_MS = 60000;

export class BattleContainer extends DurableObject {
  async fetch(request) {
    const container = this.ctx.container;
    const hill = new URL(request.url).pathname === '/internal/hill-match';
    const requestId = request.headers.get('x-zorewars-request-id');
    const started = performance.now();
    const coldStart = !container.running;
    if (!container.running) {
      container.start({
        enableInternet: true,
        env: {
          DISCORD_APPLICATION_ID: this.env.DISCORD_APPLICATION_ID,
          DISCORD_GUILD_ID: this.env.DISCORD_GUILD_ID,
          DISCORD_PUBLIC_KEY: this.env.DISCORD_PUBLIC_KEY,
          DISCORD_HILL_SECRET: this.env.DISCORD_HILL_SECRET ?? '',
        },
      });
    }
    await container.setInactivityTimeout(IDLE_MS);
    const port = container.getTcpPort(PORT);
    const deadline = Date.now() + (hill ? 7000 : 12000);
    while (Date.now() < deadline) {
      try {
        const health = await port.fetch('http://container/health', { signal: AbortSignal.timeout(1000) });
        if (health.ok) {
          console.info({ event: 'arena_ready', requestId, coldStart, durationMs: Math.round(performance.now() - started) });
          return port.fetch(new Request(request, { signal: AbortSignal.timeout(hill ? 19000 : 3000) }));
        }
      } catch {
        // The container can be running before Node starts listening.
      }
      await scheduler.wait(200);
    }
    console.warn({ event: 'arena_start_timeout', requestId, coldStart, durationMs: Math.round(performance.now() - started) });
    return new Response('Arena is starting', { status: 503 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/ladder/')) {
      const started = performance.now();
      const response = await publicStandings(request, env.HILLS_DB)
        .catch(() => new Response('Hill storage is unavailable', { status: 503 }));
      const hill = pathname === '/ladder/nano' ? 'nano' : pathname === '/ladder/tiny' ? 'tiny' : undefined;
      if (hill) console.info({ event: 'ladder_view', hill, status: response.status, durationMs: Math.round(performance.now() - started) });
      return response;
    }
    return handleDiscord(request, env, ctx, forwarded => sendToBattleOrigin(forwarded, env));
  },
};
