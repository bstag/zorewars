import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { battleCommand, createDiscordServer } from '../cli/discord.js';
import { RULESETS } from '../src/engine/constants.js';
import { handleDiscord, sendToBattleOrigin } from '../worker/discord.js';
import { publicStandings, readStandings, submitToHill } from '../worker/discord-hills.js';

test('Discord verifies requests, acknowledges matches, and posts CLI-equivalent results', { timeout: 10000 }, async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const applicationId = '123456789012345678';
  const guildId = '234567890123456789';
  const paths = ['dwarf.red', 'evolvedsilk.red'].map(name => new URL(`../warriors/${name}`, import.meta.url));
  const files = await Promise.all(paths.map(async path => ({
    filename: path.pathname.split('/').pop(), source: await readFile(path, 'utf8'),
  })));
  files.push({ filename: 'broken.red', source: ';name Broken\nMOV.I $missing, $0\n' },
    { filename: 'imp.red', source: ';name <Nano Imp>\nMOV.I 0, 1\n' },
    { filename: 'dat.red', source: ';name Nano DAT\nDAT 0, 0\n' });
  const attachments = Object.fromEntries(files.map(({ filename, source }, i) => [i, {
    filename, size: Buffer.byteLength(source),
    url: `https://cdn.discordapp.com/${i === 0 ? 'ephemeral-attachments' : 'attachments'}/1/${i}/${filename}?ex=abc&is=def&hm=123`,
  }]));
  const callbacks = new Map();
  const server = createDiscordServer({
    applicationId, guildId, hillSecret: 'test-secret',
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    async fetch(url, options) {
      if (url.hostname === 'cdn.discordapp.com') {
        assert.equal(options.redirect, 'error');
        assert.equal(url.search, '?ex=abc&is=def&hm=123');
        return new Response(files[Number(url.pathname.split('/')[3])].source);
      }
      assert.equal(options.method, 'PATCH');
      const token = url.split('/').at(-3);
      assert.equal(url, `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`);
      callbacks.get(token)(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    },
  });
  function request(interaction, validSignature = true, path = '/api/discord/interactions') {
    const body = JSON.stringify(interaction);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = validSignature ? sign(null, Buffer.from(timestamp + body), privateKey).toString('hex') : '00'.repeat(64);
    const input = Object.assign(Readable.from([Buffer.from(body)]), {
      method: 'POST', url: path,
      headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp,
        authorization: validSignature ? 'Bearer test-secret' : 'Bearer invalid' },
    });
    return new Promise(resolve => {
      const output = {
        writeHead(status) { this.status = status; this.headersSent = true; },
        end(payload) { resolve({ status: this.status, body: JSON.parse(payload) }); },
      };
      server.emit('request', input, output);
    });
  }
  function battle(token, second, extraOptions = []) {
    const result = new Promise(resolve => callbacks.set(token, resolve));
    const ack = request({
      type: 2, application_id: applicationId, guild_id: guildId, token,
      data: {
        name: 'battle', resolved: { attachments },
        options: [{ name: 'first', value: '0' }, { name: 'second', value: second }, ...extraOptions],
      },
    });
    return { ack, result };
  }

  assert.equal((await request({ type: 1 }, false)).status, 401);
  assert.deepEqual((await request({ type: 1 })).body, { type: 1 });

  const seed = 48172;
  const valid = battle('valid', '1', [{ name: 'seed', value: seed }]);
  assert.deepEqual((await valid.ack).body, { type: 5 });
  const expected = JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(new URL('../cli/zorewars.js', import.meta.url)), 'battle', ...paths.map(path => fileURLToPath(path)),
    '--rules', 'lp', '--rounds', '50', '--seed', String(seed), '--json', '--no-execution-history',
  ], { encoding: 'utf8' }));
  const result = await valid.result;
  for (const warrior of expected.warriors) {
    assert.ok(result.content.includes(`${warrior.name} · ${warrior.score} pts · ${warrior.wins} W / ${warrior.losses} L / ${warrior.ties} T`));
  }
  assert.ok(result.content.includes(`LP · 50 rounds · Seed \`${seed}\``));
  assert.deepEqual(result.allowed_mentions, { parse: [] });

  const choices = battleCommand.options.find(({ name }) => name === 'rules').choices.map(({ value }) => value);
  assert.deepEqual(new Set(choices), new Set(Object.keys(RULESETS)));
  const tiny = battle('tiny', '0', [
    { name: 'rules', value: 'tiny' }, { name: 'rounds', value: 2 }, { name: 'seed', value: seed },
  ]);
  assert.deepEqual((await tiny.ack).body, { type: 5 });
  assert.match((await tiny.result).content, /TINY .* 2 rounds/);

  const invalid = battle('broken', '2');
  assert.deepEqual((await invalid.ack).body, { type: 5 });
  assert.match((await invalid.result).content, /Warrior 2, line 2.*missing/i);
  const absent = (await battle('absent', '999').ack).body;
  assert.equal(absent.type, 4);
  assert.equal(absent.data.flags, 64);
  assert.match(absent.data.content, /Warrior 2 needs a .red attachment/);

  const initial = () => ({ version: 0, state: JSON.stringify({ revision: 1, entries: [], matches: [], receipts: [] }) });
  const rows = new Map([['nano', initial()], ['tiny', initial()]]);
  const db = { prepare: () => ({ bind: (...args) => ({
    first: async () => ({ ...rows.get(args[0]) }),
    run: async () => {
      const [state, hill, version] = args;
      if (rows.get(hill).version !== version) return { meta: { changes: 0 } };
      rows.set(hill, { version: version + 1, state });
      return { meta: { changes: 1 } };
    },
  }) }) };
  const score = async (hill, attachment, members) =>
    (await request({ hill, attachment, members }, true, '/internal/hill-match')).body;

  assert.deepEqual(await readStandings(db, 'nano'), []);
  assert.deepEqual(await readStandings(db, 'tiny'), []);
  assert.equal((await request({}, false, '/internal/hill-match')).status, 401);
  assert.match(await submitToHill(db, 'nano', 'one', attachments[3], score), /entered.*#1/);
  assert.equal(JSON.parse(rows.get('nano').state).matches.length, 0);
  assert.match(await submitToHill(db, 'nano', 'two', attachments[4], score), /entered.*#2/);
  assert.equal(JSON.parse(rows.get('nano').state).matches.length, 1);
  assert.match(await submitToHill(db, 'nano', 'two', attachments[4], () => assert.fail('Submission replay rescored')), /entered.*#2/);
  assert.match(await submitToHill(db, 'nano', 'three', attachments[4], score), /already on this hill/);
  assert.deepEqual((await readStandings(db, 'nano')).map(({ name, wins }) => [name, wins]), [['<Nano Imp>', 50], ['Nano DAT', 0]]);
  assert.deepEqual(await readStandings(db, 'tiny'), []);
  const page = await publicStandings(new Request('https://battle.zorewar.app/ladder/nano'), db);
  assert.match(await page.text(), /&lt;Nano Imp&gt;/);
});

test('Cloudflare answers Discord before the origin is ready and forwards signed bytes', async t => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const env = {
    DISCORD_APPLICATION_ID: '123456789012345678',
    DISCORD_GUILD_ID: '234567890123456789',
    DISCORD_PUBLIC_KEY: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const url = 'https://battle.zorewar.app/api/discord/interactions';
  let deferred;
  const ctx = { waitUntil(task) { deferred = task; } };
  const run = (body, signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex')) =>
    handleDiscord(new Request(url, {
      method: 'POST', body, headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp },
    }), env, ctx, request => sendToBattleOrigin(request, env));

  assert.equal((await run('{"type":1}', '00'.repeat(64))).status, 401);
  assert.deepEqual(await (await run('{"type":1}')).json(), { type: 1 });
  assert.equal(deferred, undefined);

  const payload = {
    type: 2, application_id: env.DISCORD_APPLICATION_ID, guild_id: env.DISCORD_GUILD_ID,
    token: 'callback', data: { name: 'battle' },
  };
  assert.equal((await run(JSON.stringify({ ...payload, guild_id: 'other' }))).status, 400);
  const body = JSON.stringify(payload, null, 2);
  let forwarded;
  let finish;
  env.BATTLE_CONTAINER = {
    getByName(name) {
      assert.equal(name, 'battle');
      return { fetch(request) {
        forwarded = request;
        return new Promise(resolve => { finish = resolve; });
      } };
    },
  };
  assert.deepEqual(await (await run(body)).json(), { type: 5 });
  assert.equal(await forwarded.text(), body);
  assert.equal(forwarded.headers.get('x-signature-ed25519'), sign(null, Buffer.from(timestamp + body), privateKey).toString('hex'));
  finish(Response.json({ type: 5 }));
  await deferred;

  env.DISCORD_BATTLE_ORIGIN = 'https://battle-origin.zorewar.app';
  let callback;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input, options) => {
    if (input instanceof Request) {
      assert.equal(input.url, `${env.DISCORD_BATTLE_ORIGIN}/api/discord/interactions`);
      assert.equal(await input.text(), body);
      assert.equal(options.redirect, 'error');
      return Response.json({ type: 4, data: { content: 'Warrior 2 needs a .red attachment.' } });
    }
    assert.match(input, /\/webhooks\/123456789012345678\/callback\/messages\/@original$/);
    assert.equal(options.method, 'PATCH');
    callback = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(await (await run(body)).json(), { type: 5 });
  await deferred;
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.equal(callback.content, 'Warrior 2 needs a .red attachment.');
});
