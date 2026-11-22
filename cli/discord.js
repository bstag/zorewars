import { randomInt, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { RULESETS } from '../src/engine/constants.js';
import { HILLS, HILL_ROUNDS, HILL_SEED, HILL_SIZE, display, ladderCommand, submitCommand } from '../src/engine/discord-hills.js';
import { discordConfigured, isSnowflake, verifyDiscordSignature } from '../src/engine/discord-verify.js';

const API = 'https://discord.com/api/v10';
const ENDPOINT = '/api/discord/interactions';
const DEFAULT_RULES = 'lp';
const RULE_CHOICES = [DEFAULT_RULES, ...Object.keys(RULESETS).filter(name => name !== DEFAULT_RULES)];
const DEFAULT_ROUNDS = 50;
const MAX_ROUNDS = 100;
const MAX_UPLOAD = 32 * 1024;
const MAX_SEED = 2147483646;
const MAX_MATCHES = 2;
const FILE_OPTIONS = ['first', 'second'];
const CDN_HOSTS = ['cdn.discordapp.com', 'media.discordapp.net'];

export const battleCommand = {
  name: 'battle',
  type: 1,
  description: 'Run two Redcode warriors in ZoreWars',
  options: [
    ...FILE_OPTIONS.map((name, i) => ({
      name, type: 11, description: `Warrior ${i + 1} (.red file)`, required: true,
    })),
    { name: 'rules', type: 3, description: 'Hill ruleset (default LP)', choices: RULE_CHOICES.map(value => ({ name: value, value })) },
    { name: 'rounds', type: 4, description: 'Rounds to play (default 50)', min_value: 1, max_value: MAX_ROUNDS },
    { name: 'seed', type: 4, description: 'Seed to replay a previous match', min_value: 1, max_value: MAX_SEED },
  ],
};

class BattleError extends Error {}

function recordArena(event, observation, fields) {
  console.info(JSON.stringify({ event, ...observation, ...fields }));
}

function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function message(content) {
  return { content, allowed_mentions: { parse: [] } };
}

function matchOptions(data) {
  const options = new Map((data.options ?? []).map(({ name, value }) => [name, value]));
  const rules = options.get('rules') ?? DEFAULT_RULES;
  const rounds = options.get('rounds') ?? DEFAULT_ROUNDS;
  const seed = options.get('seed') ?? randomInt(1, MAX_SEED + 1);
  if (!RULE_CHOICES.includes(rules) || !Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS ||
      !Number.isInteger(seed) || seed < 1 || seed > MAX_SEED) {
    throw new BattleError('Choose a supported ruleset, 1–100 rounds, and a valid replay seed.');
  }
  const attachments = FILE_OPTIONS.map((name, i) => {
    const file = data.resolved?.attachments?.[options.get(name)];
    if (!file || !/\.red$/i.test(file.filename)) throw new BattleError(`Warrior ${i + 1} needs a .red attachment.`);
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_UPLOAD) {
      throw new BattleError(`Warrior ${i + 1} must be between 1 byte and 32 KiB.`);
    }
    return file;
  });
  return { rules, rounds, seed, attachments };
}

async function download(file, index, fetch) {
  const warrior = `warrior ${index + 1}`;
  let url;
  try {
    url = new URL(file.url);
  } catch {
    throw new BattleError(`Discord returned an invalid attachment URL for ${warrior}.`);
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !CDN_HOSTS.includes(url.hostname) || !/^\/(?:ephemeral-)?attachments\//.test(url.pathname)) {
    throw new BattleError(`Discord returned an unsupported attachment URL for ${warrior}.`);
  }

  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new BattleError(`Discord's CDN could not serve ${warrior} (HTTP ${response.status}). Try uploading it again.`);
    }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let source = '';
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD) throw new BattleError(`The download for ${warrior} exceeded 32 KiB.`);
      source += decoder.decode(chunk, { stream: true });
    }
    source += decoder.decode();
    return { source, filename: file.filename };
  } catch (error) {
    if (error instanceof BattleError) throw error;
    if (error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA') {
      throw new BattleError(`The file for ${warrior} is not valid UTF-8.`);
    }
    throw new BattleError(`Could not download ${warrior} from Discord's CDN. Try uploading it again.`);
  }
}

async function runBattle(workerData, timeoutMs = 20000) {
  const worker = new Worker(new URL('./discord-match.js', import.meta.url), {
    workerData, resourceLimits: { maxOldGenerationSizeMb: 64 },
  });
  let timeout;
  try {
    return await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new BattleError('The arena ran out of time. Try again.')), timeoutMs);
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.once('exit', () => reject(new Error('Match worker exited')));
    });
  } finally {
    clearTimeout(timeout);
    await worker.terminate();
  }
}

function compilationError(errors) {
  return ['**Redcode compilation failed**', ...errors.map(({ slot, line, message }) =>
    `Warrior ${slot}${line ? `, line ${line}` : ''} · ${display(message, 150)}`)].join('\n');
}

function scoreboard({ scores, errors }, { rules, rounds, seed }) {
  if (errors) return compilationError(errors);
  const [a, b] = scores;
  const names = scores.map(({ name }) => display(name));
  const winner = a.score === b.score ? 'Match tied' : `${names[+(b.score > a.score)]} wins`;
  const rows = scores.map((s, i) => `${i + 1}. ${names[i]} · ${s.score} pts · ${s.wins} W / ${s.losses} L / ${s.ties} T`);
  return [`**ZoreWars · ${winner}**`, ...rows, `${rules.toUpperCase()} · ${rounds} rounds · Seed \`${seed}\``].join('\n');
}

export function createDiscordServer({ applicationId, guildId, publicKey, hillSecret, fetch = globalThis.fetch }) {
  if (!discordConfigured(applicationId, guildId, publicKey)) {
    throw new Error('Set DISCORD_APPLICATION_ID, DISCORD_GUILD_ID and DISCORD_PUBLIC_KEY.');
  }
  let active = 0;

  async function handle(request, response) {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(204);
      response.end();
      return;
    }
    const hillRequest = request.url === '/internal/hill-match';
    const requestId = request.headers['x-zorewars-request-id'];
    const observation = { requestId: /^[a-f0-9-]{36}$/i.test(requestId) ? requestId : undefined,
      command: hillRequest ? 'submit' : 'battle' };
    if (request.url !== ENDPOINT && !hillRequest) return reply(response, 404, { error: 'Not found' });
    if (request.method !== 'POST') return reply(response, 405, { error: 'Use POST' });
    if (hillRequest) {
      const supplied = Buffer.from(request.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${hillSecret}`);
      if (!hillSecret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return reply(response, 401, { error: 'Unauthorized' });
      }
      if (active >= MAX_MATCHES) {
        recordArena('arena_busy', observation, { active });
        return reply(response, 200, { error: 'The arena is busy. Try again shortly.' });
      }
      active++;
      const started = performance.now();
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) return reply(response, 413, { error: 'Hill request too large' });
          chunks.push(chunk);
        }
        const { hill, attachment, members } = JSON.parse(Buffer.concat(chunks));
        if (!HILLS.includes(hill) || !Array.isArray(members) || members.length > HILL_SIZE ||
            typeof attachment?.filename !== 'string' || !/\.red$/i.test(attachment.filename) ||
            !Number.isInteger(attachment.size) || attachment.size < 1 || attachment.size > MAX_UPLOAD) {
          return reply(response, 400, { error: 'Invalid hill submission' });
        }
        const file = await download(attachment, 0, fetch);
        const simulation = performance.now();
        const result = await runBattle({ files: [file], rules: hill, rounds: HILL_ROUNDS, seed: HILL_SEED, members }, 10000);
        recordArena('arena_match', observation, {
          rules: hill, opponents: members.length, outcome: result.errors ? 'compile_error' : result.duplicate ? 'duplicate' : 'ok',
          downloadMs: Math.round(simulation - started), simulationMs: Math.round(performance.now() - simulation),
        });
        return reply(response, 200, result.errors ? { error: compilationError(result.errors) } : result);
      } catch (error) {
        recordArena('arena_match_failed', observation, { durationMs: Math.round(performance.now() - started) });
        return reply(response, 200, { error: error instanceof BattleError ? error.message : 'The arena could not score this entry.' });
      } finally {
        active--;
      }
    }

    const chunks = [];
    let length = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      length += chunk.length;
      if (length > 64 * 1024) {
        request.resume();
        return reply(response, 413, { error: 'Interaction too large' });
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const signature = request.headers['x-signature-ed25519'];
    const timestamp = request.headers['x-signature-timestamp'];
    if (!await verifyDiscordSignature(publicKey, signature, timestamp, body)) {
      return reply(response, 401, { error: 'Invalid Discord signature' });
    }
    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch {
      return reply(response, 400, { error: 'Invalid JSON' });
    }
    if (interaction?.type === 1) return reply(response, 200, { type: 1 });
    if (interaction?.type !== 2 || interaction.application_id !== applicationId ||
        interaction.guild_id !== guildId || interaction.data?.name !== battleCommand.name ||
        typeof interaction.token !== 'string' || !interaction.token) {
      return reply(response, 400, { error: 'Unsupported interaction' });
    }

    const immediateError = content => reply(response, 200, { type: 4, data: { ...message(content), flags: 64 } });
    let match;
    try {
      match = matchOptions(interaction.data);
    } catch (error) {
      if (!(error instanceof BattleError)) throw error;
      return immediateError(error.message);
    }
    if (active >= MAX_MATCHES) {
      recordArena('arena_busy', observation, { active });
      return immediateError('The arena is busy. Try again when a match finishes.');
    }
    active++;
    reply(response, 200, { type: 5 });
    const started = performance.now();
    try {
      let content;
      try {
        const { attachments, ...settings } = match;
        const uploads = await Promise.allSettled(attachments.map((file, i) => download(file, i, fetch)));
        const files = uploads.map(upload => {
          if (upload.status === 'rejected') throw upload.reason;
          return upload.value;
        });
        const simulation = performance.now();
        const result = await runBattle({ files, ...settings });
        recordArena('arena_match', observation, {
          rules: settings.rules, rounds: settings.rounds, outcome: result.errors ? 'compile_error' : 'ok',
          downloadMs: Math.round(simulation - started), simulationMs: Math.round(performance.now() - simulation),
        });
        content = scoreboard(result, settings);
      } catch (error) {
        content = error instanceof BattleError ? error.message : 'The arena could not finish this match. Try again.';
        recordArena('arena_match_failed', observation, { durationMs: Math.round(performance.now() - started) });
      }
      const callback = await fetch(`${API}/webhooks/${applicationId}/${encodeURIComponent(interaction.token)}/messages/@original`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message(content)),
        signal: AbortSignal.timeout(8000),
      });
      recordArena('discord_reply', observation, { status: callback.status, durationMs: Math.round(performance.now() - started) });
      await callback.body?.cancel();
    } catch {
      recordArena('discord_reply_failed', observation, { durationMs: Math.round(performance.now() - started) });
    } finally {
      active--;
    }
  }

  return createServer((request, response) => {
    handle(request, response).catch(() => {
      console.error('Discord interaction failed');
      if (!response.headersSent) reply(response, 500, { error: 'Interaction failed' });
    });
  });
}

async function main() {
  const { DISCORD_APPLICATION_ID: applicationId, DISCORD_GUILD_ID: guildId,
    DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_TOKEN: token, DISCORD_HILL_SECRET: hillSecret, PORT = '8788' } = process.env;
  if (process.argv[2] === 'register') {
    if (!isSnowflake(applicationId) || !isSnowflake(guildId) || !token) {
      throw new Error('Set DISCORD_APPLICATION_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN.');
    }
    for (const command of [battleCommand, ladderCommand, submitCommand]) {
      const response = await fetch(`${API}/applications/${applicationId}/guilds/${guildId}/commands`, {
        method: 'POST',
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Discord could not register /${command.name} (HTTP ${response.status}): ${(await response.text()).slice(0, 500)}`);
      await response.body?.cancel();
      console.log(`Registered /${command.name} in the test server.`);
    }
  } else if (process.argv.length === 2) {
    const server = createDiscordServer({ applicationId, guildId, publicKey, hillSecret });
    server.listen(Number(PORT), () => console.log(`ZoreWars Discord endpoint listening on port ${server.address().port}${ENDPOINT}`));
  } else {
    throw new Error('Usage: node cli/discord.js [register]');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
