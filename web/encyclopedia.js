import {settingsFor,fieldOf,card} from './encyclopedia-content.js';
// Renders the warrior encyclopedia from warriors/encyclopedia.json, the
// warrior source files (their comments become the line-by-line breakdown)
// and warriors/benchmarks.json.

import { compile } from '../src/engine/index.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function main() {
  const [data, library, bench] = await Promise.all([
    getJSON('../warriors/encyclopedia.json'),
    getJSON('../warriors/index.json'),
    getJSON('../warriors/benchmarks.json').catch(() => null),
  ]);
  const names = Object.fromEntries(library.map((e) => [e.file, e.name]));

  // Filters: battlefield and family chips, and a search over each card's text.
  const filter = { family: 'All', field: 'All' };
  const chips = (el, values, key) => {
    el.innerHTML = ['All', ...values].map((f) => `<button class="chip" aria-pressed="${f === filter[key]}" data-f="${esc(f)}">${esc(f === 'All' ? (key === 'field' ? 'All battlefields' : 'All families') : f)}</button>`).join('');
  };
  const families = [...new Set(data.warriors.map((w) => w.family))].sort();
  const fields = ['Ring', 'Plane', '3D'].filter((f) => data.warriors.some((w) => fieldOf(w) === f));
  const applyFilter = () => {
    const words = $('#encSearch').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    for (const c of document.querySelectorAll('.wcard')) {
      c.hidden = !((filter.family === 'All' || c.dataset.family === filter.family)
        && (filter.field === 'All' || c.dataset.field === filter.field)
        && words.every((w) => c.dataset.text.includes(w)));
      if (!c.hidden) n++;
    }
    $('#encCount').textContent = `${n} of ${data.warriors.length} warriors`;
  };
  for (const [el, values, key] of [[$('#filters'), families, 'family'], [$('#fieldFilters'), fields, 'field']]) {
    chips(el, values, key);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filter[key] = b.dataset.f;
      chips(el, values, key);
      applyFilter();
    });
  }
  $('#encSearch').addEventListener('input', applyFilter);

  // Ranking table.
  if (bench) {
    $('#ranking').innerHTML = `<table class="ref"><thead><tr><th>#</th><th>Warrior</th><th>Family</th><th>Pts/round</th></tr></thead><tbody>${
      bench.ranking.map((r) => {
        const entry = data.warriors.find((w) => w.file === r.file);
        const fam = entry?.family || library.find((l) => l.file === r.file)?.category || '';
        return `<tr><td>${r.rank}</td><td>${entry ? `<a href="#${esc(entry.id)}">${esc(names[r.file] || r.file)}</a>` : esc(names[r.file] || r.file)}</td><td>${esc(fam)}</td><td>${r.scorePerRound.toFixed(2)}</td></tr>`;
      }).join('')}</tbody></table>
      <p class="muted small">Round robin, ${bench.rounds} rounds per pairing, seed ${bench.seed}, generated ${esc(bench.generated)}. Regenerate with <code>node scripts/benchmark.js</code>.</p>`;
  }

  // Hall of fame: historical warriors, linked to their originals.
  const byId = Object.fromEntries(data.warriors.map((w) => [w.id, w]));
  // "Fight" imports the original into the arena against our version of the idea.
  // An original written for other rules (Frontwards: the 94x hill) brings them along.
  const fight = (h) => `index.html?url=${encodeURIComponent(h.url)}&vs=${encodeURIComponent(byId[h.ours]?.file || 'dwarf.red')}${
    h.rules ? `&rules=${encodeURIComponent(h.rules)}` : ''}${h.maxLength ? `&length=${h.maxLength}` : ''}`;
  $('#hof').innerHTML = `<table class="ref"><thead><tr><th>Year</th><th>Warrior</th><th>Author</th><th>Family</th><th>Why it matters</th><th>Ours</th><th></th></tr></thead><tbody>${
    data.hallOfFame.map((h) => `<tr><td class="yr">${esc(h.year)}</td><td><a href="${esc(h.url)}">${esc(h.name)}</a></td><td>${esc(h.author)}</td><td>${esc(h.family)}</td><td>${esc(h.note)}</td><td>${
      h.ours && byId[h.ours] ? `<a href="#${esc(h.ours)}">${esc(byId[h.ours].name)}</a>` : ''}</td><td><a class="btn fight" href="${fight(h)}" title="Load the original into the arena">Fight</a></td></tr>`).join('')
  }</tbody></table>`;

  // Warrior cards.
  // One warrior that can't be fetched gets a note; the rest still show.
  const cards = await Promise.all(data.warriors.map(async (entry) => {
    const r = await fetch(`../warriors/${entry.file}`).catch(() => null);
    if (!r?.ok) return `<article class="wcard" id="${esc(entry.id)}" data-family="${esc(entry.family)}" data-field="${fieldOf(entry)}" data-text="${esc(entry.name.toLowerCase())}"><header><div><h3>${esc(entry.name)}</h3></div></header><p class="bad">Could not load ${esc(entry.file)}${r ? ` (${r.status})` : ''}.</p></article>`;
    const source = await r.text();
    const compiled = entry.language === 'python' ? { name: entry.name, instructions: [] } : compile(source, entry.language, settingsFor(entry.battlefield));
    const conversions = library.filter((e) => e.convertedFrom === entry.file || e.adaptedFrom === entry.file);
    return card(entry, source, compiled, bench, names, conversions);
  }));
  $('#cards').innerHTML = cards.join('');
  applyFilter();
  $('#toc-warriors').innerHTML = data.warriors.map((w) => `<a href="#${esc(w.id)}">${esc(w.name)}</a>`).join('');
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

main().catch((e) => {
  $('#cards').innerHTML = `<p class="bad">Could not load the encyclopedia: ${esc(e.message)}. Serve the project with <code>npm start</code>.</p>`;
});
