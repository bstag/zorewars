import { HILLS, HILL_REVISION, HILL_SIZE, display } from '../src/engine/discord-hills.js';
import { ladderPage } from './ladder-page.js';

const PUBLIC_ORIGIN = 'https://battle.zorewar.app';

async function readHill(db, hill) {
  const row = await db.prepare('SELECT version, state FROM discord_hills WHERE hill = ?').bind(hill).first();
  if (!row) throw new Error('Hill schema has not been initialized');
  const state = JSON.parse(row.state);
  // Results scored under another revision can't be mixed with new ones, so a
  // changed HILL_REVISION starts the hill empty. The stored row is replaced by
  // the first submission under the new rules (the version check still applies).
  if (state.revision !== HILL_REVISION) {
    console.warn({ event: 'hill_revision_reset', hill, stored: state.revision, current: HILL_REVISION });
    return { revision: HILL_REVISION, entries: [], matches: [], receipts: [], version: row.version };
  }
  return { ...state, version: row.version };
}

function rank(entries, matches) {
  const scores = new Map(entries.map(entry => [entry.id, { ...entry, points: 0, rounds: 0, wins: 0, losses: 0, ties: 0 }]));
  for (const match of matches) {
    const pair = [scores.get(match.first), scores.get(match.second)];
    if (pair.some(entry => !entry)) continue;
    pair.forEach((entry, i) => {
      const score = match.scores[i];
      entry.points += score.score;
      entry.rounds += match.rounds;
      entry.wins += score.wins;
      entry.losses += score.losses;
      entry.ties += score.ties;
    });
  }
  // All entries face the same number of opponents. Exact ties favor incumbents.
  return [...scores.values()].sort((a, b) => b.points - a.points || a.joined - b.joined);
}

export async function readStandings(db, hill) {
  const { entries, matches } = await readHill(db, hill);
  return rank(entries, matches).map(({ name, wins, losses, ties, points, rounds }, i) => ({
    rank: i + 1, name, wins, losses, ties, pointsPerRound: rounds ? points / rounds : null,
  }));
}

export function standingsMessage(hill, rows) {
  const lines = rows.map(row => `${row.rank}. ${display(row.name)} · ${row.pointsPerRound?.toFixed(3) ?? 'Unranked'}`);
  return [`**ZoreWars · ${hill.toUpperCase()} Hill**`,
    ...(lines.length ? lines : ['The hill is empty. Enter with `/submit`.']),
    `[Full standings](${PUBLIC_ORIGIN}/ladder/${hill})`].join('\n');
}

export async function submitToHill(db, hill, interactionId, attachment, score, requestId) {
  const started = performance.now();
  const finish = (outcome, content) => {
    console.info({ event: 'hill_submission', requestId, hill, outcome, durationMs: Math.round(performance.now() - started) });
    return content;
  };
  const state = await readHill(db, hill);
  const receipt = state.receipts.find(item => item.id === interactionId);
  if (receipt) return finish('replayed', receipt.content);
  const result = await score(hill, attachment, state.entries.map(({ id, source }) => ({ id, source })));
  if (result.error) return finish('runner_rejected', result.error);
  if (result.duplicate) return finish('duplicate', 'That warrior is already on this hill.');
  const { entry, matches } = result;
  const ranked = rank([...state.entries, { ...entry, joined: state.version }], [...state.matches, ...matches]);
  const position = ranked.findIndex(candidate => candidate.id === entry.id) + 1;
  const entries = ranked.slice(0, HILL_SIZE).map(({ id, name, source, joined }) => ({ id, name, source, joined }));
  const active = new Set(entries.map(candidate => candidate.id));
  const retainedMatches = [...state.matches, ...matches].filter(match => active.has(match.first) && active.has(match.second));
  const publishedPosition = rank(entries, retainedMatches).findIndex(candidate => candidate.id === entry.id) + 1;
  const label = display(entry.name);
  const resultText = position > HILL_SIZE
    ? `**${label}** placed #${position} and missed the ${hill.toUpperCase()} top ${HILL_SIZE}.`
    : `**${label}** entered the ${hill.toUpperCase()} hill at #${publishedPosition}.`;
  const content = `${resultText}\n[Full standings](${PUBLIC_ORIGIN}/ladder/${hill})`;
  const next = {
    revision: HILL_REVISION,
    entries,
    matches: retainedMatches,
    receipts: [...state.receipts.slice(-99), { id: interactionId, content }],
  };
  const write = await db.prepare('UPDATE discord_hills SET version = version + 1, state = ? WHERE hill = ? AND version = ?')
    .bind(JSON.stringify(next), hill, state.version).run();
  if (write.meta.changes) return finish(position > HILL_SIZE ? 'missed_cut' : 'admitted', content);
  const current = await readHill(db, hill);
  const saved = current.receipts.find(item => item.id === interactionId);
  return saved ? finish('replayed', saved.content) :
    finish('conflict', 'The hill changed while your entry was fighting. Submit it again to face the current field.');
}

export async function publicStandings(request, db) {
  const match = /^\/ladder\/(nano|tiny)$/.exec(new URL(request.url).pathname);
  if (!match || !HILLS.includes(match[1])) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET') return new Response('Use GET', { status: 405, headers: { Allow: 'GET' } });
  if (!db) return new Response('Hill storage is unavailable', { status: 503 });
  const hill = match[1];
  const rows = await readStandings(db, hill);
  return new Response(ladderPage(hill, rows), {
    // Standings only change on a submission; a short cache spares D1 on repeat views.
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=30' },
  });
}
