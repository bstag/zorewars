#!/usr/bin/env node
// Empty a Discord hill (nano, tiny or both) in its D1 database.
//
//   node scripts/hill-reset.js nano                 show what would happen (local database)
//   node scripts/hill-reset.js nano --remote        the same, against the live database
//   node scripts/hill-reset.js all --remote --yes   empty both live hills
//
// Use it when a hill has to start over: a stored warrior no longer assembles
// after an engine change (every submission then fails), or the scoring changed.
// It writes an empty hill at the current HILL_REVISION, so it needs no deploy;
// bumping HILL_REVISION in src/engine/discord-hills.js and deploying has the
// same effect for every hill at once.
//
// The row's version goes up by one, so a submission that was being scored
// while the hill was emptied is told to submit again instead of resurrecting
// the old entries.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HILLS, HILL_REVISION } from '../src/engine/discord-hills.js';

const DATABASE = 'zorewars-hills';
const CONFIG = fileURLToPath(new URL('../wrangler.discord.jsonc', import.meta.url));

export function parseRequest(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const names = argv.filter((a) => !a.startsWith('--'));
  const unknown = flags.filter((f) => !['--remote', '--yes'].includes(f));
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}`);
  if (names.length !== 1 || !(names[0] === 'all' || HILLS.includes(names[0]))) {
    throw new Error(`name one hill: ${HILLS.join(', ')} or all`);
  }
  return { hills: names[0] === 'all' ? [...HILLS] : [names[0]], remote: flags.includes('--remote'), yes: flags.includes('--yes') };
}

// The statement that empties the hills. Hill names come from HILLS only.
export function resetStatement(hills) {
  if (!hills.length || hills.some((hill) => !HILLS.includes(hill))) throw new Error('unknown hill');
  // Built by SQLite with single quotes only: double quotes in the statement
  // do not survive the shell, and would store text that is not JSON.
  const empty = `json_object('revision', ${Number(HILL_REVISION)}, 'entries', json_array(), 'matches', json_array(), 'receipts', json_array())`;
  return `UPDATE discord_hills SET version = version + 1, state = ${empty} WHERE hill IN (${hills.map((hill) => `'${hill}'`).join(', ')})`;
}

function d1(command, remote) {
  const args = ['wrangler', 'd1', 'execute', DATABASE, remote ? '--remote' : '--local', '--config', `"${CONFIG}"`, '--json', '--command', `"${command}"`];
  // npx is a .cmd on Windows, which needs a shell. Every argument is fixed
  // text from this file (hill names are checked against HILLS).
  const r = spawnSync('npx', args, { encoding: 'utf8', shell: true });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'wrangler failed').trim().split('\n').slice(-3).join('\n'));
  return JSON.parse(r.stdout)[0];
}

function main() {
  const { hills, remote, yes } = parseRequest(process.argv.slice(2));
  const where = remote ? 'the LIVE database' : 'the local development database';
  const list = hills.map((hill) => `'${hill}'`).join(', ');
  const before = d1(`SELECT hill, version, json_array_length(json_extract(state, '$.entries')) AS entries FROM discord_hills WHERE hill IN (${list})`, remote);
  for (const row of before.results) console.log(`${row.hill}: ${row.entries} entr${row.entries === 1 ? 'y' : 'ies'} (version ${row.version})`);
  if (!before.results.length) throw new Error(`no hill rows in ${where}; apply the migrations first (see DEPLOY.md)`);
  if (!yes) {
    console.log(`\nNothing changed. This would remove every entry from ${hills.join(' and ')} in ${where}.`);
    console.log('It cannot be undone. Add --yes to do it.');
    return;
  }
  d1(resetStatement(hills), remote);
  // Read it back: the stored state must be an empty hill the Worker can parse.
  const after = d1(`SELECT hill, json_valid(state) AS valid, json_extract(state, '$.revision') AS revision, json_array_length(json_extract(state, '$.entries')) AS entries FROM discord_hills WHERE hill IN (${list})`, remote);
  const bad = after.results.filter((row) => !row.valid || row.revision !== HILL_REVISION || row.entries !== 0);
  if (bad.length) throw new Error(`the reset did not take for ${bad.map((row) => row.hill).join(', ')}; check the table by hand`);
  console.log(`\nEmptied ${hills.join(' and ')} in ${where}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`hill-reset: ${error.message}`);
    process.exitCode = 1;
  }
}
