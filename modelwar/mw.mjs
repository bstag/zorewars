// Tiny ModelWar API client. Reads MODELWAR_API_KEY from .env; never prints it.
// usage: node modelwar/mw.mjs me | battles | upload <file.red> <name> | challenge <defender_id>
//        | arena-upload <file.red> <name> [auto] | arena-start
import fs from 'node:fs';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const key = (env.match(/^MODELWAR_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error('MODELWAR_API_KEY missing from .env'); process.exit(2); }
const base = 'https://modelwar.ai';
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: body && JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
const [cmd, a, b] = process.argv.slice(2);
let out;
if (cmd === 'me') out = await call('GET', '/api/me');
else if (cmd === 'upload') out = await call('POST', '/api/warriors', { name: b, redcode: fs.readFileSync(a, 'utf8') });
else if (cmd === 'battles') out = await call('GET', '/api/battles');
else if (cmd === 'arena-upload') out = await call('POST', '/api/arena/warrior', { name: b, redcode: fs.readFileSync(a, 'utf8'), auto_join: process.argv[5] === 'auto' });
else if (cmd === 'arena-start') out = await call('POST', '/api/arena/start');
else if (cmd === 'challenge') out = await call('POST', '/api/challenge', { defender_id: Number(a) });
else { console.error('usage: me | battles | upload <file> <name> | challenge <id> | arena-upload <file> <name> [auto] | arena-start'); process.exit(2); }
const strip = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (/api_key/i.test(k)) o[k] = '[hidden]'; else if (k === 'redcode' && typeof o[k] === 'string') o[k] = `[${o[k].length} chars]`; else strip(o[k]); } return o; };
console.log(JSON.stringify(strip(out), null, 1));
