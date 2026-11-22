import { HILLS } from '../src/engine/discord-hills.js';
import { discordConfigured, isSnowflake, verifyDiscordSignature } from '../src/engine/discord-verify.js';
import { readStandings, standingsMessage, submitToHill } from './discord-hills.js';

const ENDPOINT = '/api/discord/interactions';
const MAX_BODY = 64 * 1024;
const DISCORD_API = 'https://discord.com/api/v10';

async function readBody(request) {
  const bytes = new Uint8Array(MAX_BODY);
  let length = 0;
  if (request.body) {
    for await (const chunk of request.body) {
      if (length + chunk.length > MAX_BODY) return null;
      bytes.set(chunk, length);
      length += chunk.length;
    }
  }
  return bytes.subarray(0, length);
}

async function finishDeferred(interaction, forwarded, send, observation) {
  let content = 'The arena is temporarily unavailable. Try again in a moment.';
  try {
    const response = await send(forwarded);
    if (!response.ok) throw new Error('Origin rejected interaction');
    const result = await response.json();
    // The Node service updates Discord itself after accepting a match.
    if (result.type === 5) {
      console.info({ event: 'battle_dispatched', ...observation, status: response.status });
      return;
    }
    if (result.type === 4 && typeof result.data?.content === 'string') content = result.data.content;
  } catch {
    console.error({ event: 'battle_origin_failed', ...observation });
  }
  await postResult(interaction, content, observation);
}

async function postResult(interaction, content, observation) {
  const callback = await fetch(`${DISCORD_API}/webhooks/${interaction.application_id}/${encodeURIComponent(interaction.token)}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(4000),
  });
  const log = callback.ok ? console.info : console.warn;
  log({ event: 'discord_reply', ...observation, status: callback.status });
  await callback.body?.cancel();
}

export async function handleDiscord(request, env, ctx, send) {
  const url = new URL(request.url);
  if (url.pathname !== ENDPOINT) return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return new Response('Use POST', { status: 405, headers: { Allow: 'POST' } });
  const { DISCORD_APPLICATION_ID: app, DISCORD_GUILD_ID: guild, DISCORD_PUBLIC_KEY: publicKey } = env;
  if (!discordConfigured(app, guild, publicKey)) {
    return new Response('Discord configuration missing', { status: 503 });
  }
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await readBody(request);
  if (!body) return new Response('Interaction too large', { status: 413 });
  if (!await verifyDiscordSignature(publicKey, signature, timestamp, body)) {
    return new Response('Invalid Discord signature', { status: 401 });
  }
  let interaction;
  try {
    interaction = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (interaction?.type === 1) return Response.json({ type: 1 });
  if (interaction?.type !== 2 || interaction.application_id !== app || interaction.guild_id !== guild ||
      !['battle', 'ladder', 'submit'].includes(interaction.data?.name) || typeof interaction.token !== 'string' || !interaction.token) {
    return new Response('Unsupported interaction', { status: 400 });
  }

  const requestId = crypto.randomUUID();
  const observation = { requestId, command: interaction.data.name };
  if (interaction.data.name !== 'battle') {
    const options = new Map((interaction.data.options ?? []).map(({ name, value }) => [name, value]));
    const hill = options.get('hill');
    const reject = content => Response.json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });
    if (!HILLS.includes(hill)) return reject('Choose Nano or Tiny.');
    if (!env.HILLS_DB) return reject('The hills are not configured yet.');
    if (interaction.data.name === 'ladder') {
      const started = performance.now();
      ctx.waitUntil(readStandings(env.HILLS_DB, hill)
        .then(rows => {
          console.info({ event: 'ladder_read', ...observation, hill, entries: rows.length, durationMs: Math.round(performance.now() - started) });
          return standingsMessage(hill, rows);
        })
        .catch((error) => {
          console.error({ event: 'ladder_read_failed', ...observation, hill, reason: String(error?.message ?? error) });
          return 'Could not read the hill standings. Try again shortly.';
        })
        .then(content => postResult(interaction, content, observation))
        .catch(() => console.error({ event: 'discord_reply_failed', ...observation, hill })));
      return Response.json({ type: 5 });
    }
    const attachment = interaction.data.resolved?.attachments?.[options.get('warrior')];
    if (!attachment || !/\.red$/i.test(attachment.filename) ||
        !Number.isInteger(attachment.size) || attachment.size < 1 || attachment.size > 32 * 1024) {
      return reject('Attach a .red file of up to 32 KiB.');
    }
    if (!env.DISCORD_HILL_SECRET) return reject('Hill submissions are not configured yet.');
    if (!isSnowflake(interaction.id)) return reject('Invalid submission ID.');
    ctx.waitUntil(submitToHill(env.HILLS_DB, hill, interaction.id, attachment, async (hill, attachment, members) => {
      const response = await send(new Request('http://container/internal/hill-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DISCORD_HILL_SECRET}`,
          'X-ZoreWars-Request-Id': requestId },
        body: JSON.stringify({ hill, attachment, members }),
      }));
      if (!response.ok) throw new Error('Hill origin rejected submission');
      return response.json();
    }, requestId).catch((error) => {
      console.error({ event: 'hill_submission_failed', ...observation, hill, reason: String(error?.message ?? error) });
      return 'The hill could not accept this submission. Try again shortly.';
    }).then(content => postResult(interaction, content, observation))
      .catch(() => console.error({ event: 'discord_reply_failed', ...observation, hill })));
    return Response.json({ type: 5 });
  }

  // Forward the original bytes so the Node service can verify Discord's signature too.
  const forwarded = new Request(`http://container${ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': signature,
      'X-Signature-Timestamp': timestamp,
      'X-ZoreWars-Request-Id': requestId,
    },
    body,
  });
  ctx.waitUntil(finishDeferred(interaction, forwarded, send, observation)
    .catch(() => console.error({ event: 'discord_reply_failed', ...observation })));
  return Response.json({ type: 5 });
}

export function sendToBattleOrigin(request, env) {
  if (!env.DISCORD_BATTLE_ORIGIN) return env.BATTLE_CONTAINER.getByName('battle').fetch(request);
  const origin = new URL(env.DISCORD_BATTLE_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('DISCORD_BATTLE_ORIGIN must be an HTTPS origin');
  }
  const path = new URL(request.url).pathname;
  return fetch(new Request(new URL(path, origin), request), {
    redirect: 'error', signal: AbortSignal.timeout(path === ENDPOINT ? 12000 : 19000),
  });
}

