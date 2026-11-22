import { RULESETS } from '../src/engine/constants.js';
import { HILLS, HILL_ROUNDS, HILL_SEED, HILL_SIZE } from '../src/engine/discord-hills.js';

const escapeHtml = text => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));

const styles = `
:root {
  color-scheme: dark;
  --bg: #070b16;
  --panel: #0e1529;
  --line: #263553;
  --text: #e2e8f0;
  --muted: #a1afc4;
  --accent: #22d3ee;
  --pink: #f472b6;
  --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 1rem/1.5 Inter, system-ui, sans-serif; }
a { color: var(--accent); }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.shell { width: min(70rem, 100% - 3rem); margin-inline: auto; }
.topbar { border-bottom: 1px solid var(--line); }
.topbar .shell { min-height: 4.25rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; }
.wordmark { display: inline-flex; align-items: center; gap: .7rem; color: var(--text); text-decoration: none; font: 600 1rem var(--mono); letter-spacing: .1em; }
.wordmark strong { color: var(--accent); }
.mark { width: 1.15rem; height: 1.15rem; display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px; }
.mark i { border-radius: 2px; background: #334155; }
.mark i:first-child { background: var(--accent); }
.mark i:last-child { background: var(--pink); }
.arena { color: var(--muted); font-size: .875rem; text-decoration: none; }
.arena:hover { color: var(--text); }
main { padding-block: clamp(1.5rem, 4vw, 3.5rem) 3rem; }
.hill-nav { display: flex; gap: .5rem; margin-bottom: 1rem; }
.hill-nav a { padding: .42rem .9rem; border: 1px solid var(--line); border-radius: .4rem; color: var(--muted); text-decoration: none; font: 500 .875rem var(--mono); }
.hill-nav a:hover { background: var(--panel); }
.hill-nav a[aria-current="page"] { color: var(--accent); border-color: #28768a; background: #102635; }
.hero { position: relative; overflow: hidden; isolation: isolate; display: grid; gap: 1.75rem; padding: clamp(1.15rem, 4vw, 2.75rem);
  border: 1px solid var(--line); border-radius: .85rem;
  background: radial-gradient(ellipse at 98% 0%, #17364c 0%, transparent 62%), var(--panel); }
.hero::before { content: ""; position: absolute; z-index: -1; inset: 0 0 0 38%; opacity: .38;
  background-image: linear-gradient(to right, #347a91 1px, transparent 1px), linear-gradient(to bottom, #347a91 1px, transparent 1px);
  background-size: 25px 25px; mask-image: linear-gradient(105deg, transparent 9%, black); }
.hero h1 { margin: 0; font-size: clamp(2.65rem, 8vw, 5.25rem); line-height: 1; letter-spacing: -.065em; }
.rules { display: flex; flex-wrap: wrap; gap: 1rem clamp(1.4rem, 5vw, 3.2rem); margin: 0; }
.rules dt { color: var(--muted); font-size: .8125rem; }
.rules dd { margin: .2rem 0 0; font: 500 1.1rem var(--mono); }
.board { margin-top: 2rem; }
.board-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: .35rem 1rem; margin-bottom: .75rem; }
.board-head h2 { margin: 0; font-size: 1.35rem; letter-spacing: -.02em; }
.occupancy { color: var(--muted); font: .8125rem var(--mono); }
.table-frame, .empty { background: var(--panel); border: 1px solid var(--line); border-radius: .7rem; overflow: hidden; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { color: var(--muted); background: #111b30; font-size: .8125rem; }
th, td { padding: .85rem clamp(.4rem, 2vw, 1rem); text-align: left; }
thead th:first-child { width: 4rem; }
thead th:nth-child(3) { width: 8rem; }
thead th:last-child { width: 10rem; }
tbody tr { border-top: 1px solid var(--line); }
tbody tr:first-child { background: #102335; }
tbody tr:first-child td:first-child { box-shadow: inset 3px 0 var(--accent); color: var(--accent); }
tbody th { overflow-wrap: anywhere; font-weight: 600; }
tbody th .by { color: var(--muted); font-weight: 400; font-size: .875rem; }
td { font: .875rem var(--mono); }
.points, .record { text-align: right; white-space: nowrap; }
td.points { color: var(--accent); font-weight: 600; }
td.record { color: var(--muted); }
.empty { padding: 1.35rem; }
.empty p, .foot p { margin: 0; }
.foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .65rem 1.25rem; margin-top: 1rem; color: var(--muted); font-size: .875rem; }
code { color: var(--accent); font-family: var(--mono); }
@media (max-width: 38rem) {
  .shell { width: calc(100% - 2rem); }
  thead th:first-child { width: 2.5rem; }
  thead th:nth-child(3) { width: 4.2rem; }
  thead th:last-child { width: 5.5rem; }
  td { font-size: .76rem; }
}
`;

export function ladderPage(hill, rows) {
  const title = hill === 'nano' ? 'Nano' : 'Tiny';
  const description = `ZoreWars ${title} Hill standings and Discord submission instructions.`;
  const { coreSize, maxLength } = RULESETS[hill];
  const nav = HILLS.map(name => `<a href="/ladder/${name}"${name === hill ? ' aria-current="page"' : ''}>${name === 'nano' ? 'Nano' : 'Tiny'}</a>`).join('');
  const table = rows.map(row => `
          <tr>
            <td>${row.rank}</td>
            <th scope="row">${escapeHtml(row.name)}${row.author ? ` <span class="by">by ${escapeHtml(row.author)}</span>` : ''}</th>
            <td class="points">${row.pointsPerRound?.toFixed(3) ?? '—'}</td>
            <td class="record">${row.wins}/${row.losses}/${row.ties}</td>
          </tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#070b16">
  <title>${title} Hill · ZoreWars</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title} Hill · ZoreWars">
  <meta property="og:description" content="${description}">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;family=Inter:wght@400;500;600;700&amp;display=swap">
  <style>${styles}</style>
</head>
<body>
  <header class="topbar">
    <div class="shell">
      <a class="wordmark" href="https://zorewar.app/" aria-label="ZoreWars home">
        <span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>ZORE<strong>WARS</strong></span>
      </a>
      <a class="arena" href="https://zorewar.app/web/">Open arena <span aria-hidden="true">↗</span></a>
    </div>
  </header>
  <main class="shell">
    <nav class="hill-nav" aria-label="Hills">${nav}</nav>
    <section class="hero" aria-labelledby="hill-title">
      <h1 id="hill-title">${title} Hill</h1>
      <dl class="rules">
        <div><dt>Core cells</dt><dd>${coreSize}</dd></div>
        <div><dt>Instruction limit</dt><dd>${maxLength}</dd></div>
        <div><dt>Rounds per match</dt><dd>${HILL_ROUNDS}</dd></div>
      </dl>
    </section>
    <section class="board" aria-labelledby="standings-title">
      <div class="board-head">
        <h2 id="standings-title">Standings</h2>
        <span class="occupancy">${rows.length} / ${HILL_SIZE} entries</span>
      </div>
      ${rows.length ? `<div class="table-frame">
        <table aria-labelledby="standings-title">
          <thead><tr><th scope="col">Rank</th><th scope="col">Warrior</th>
            <th scope="col" class="points" aria-label="Points per round">Pts/Rd</th>
            <th scope="col" class="record" aria-label="Wins, losses, ties">W/L/T</th></tr></thead>
          <tbody>${table}</tbody>
        </table>
      </div>` : '<div class="empty"><p>The hill is empty. Submit a warrior to take the first spot.</p></div>'}
      <div class="foot">
        <p>Enter in Discord with <code>/submit hill:${hill}</code> and attach a <code>.red</code> file.</p>
        <p>Match seed <code>${HILL_SEED}</code></p>
      </div>
    </section>
  </main>
</body>
</html>`;
}
