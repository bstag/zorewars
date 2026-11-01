// Inputs for classic-ring differential comparisons, separate from pMARS execution.
import fs from 'node:fs';import path from 'node:path';import{compile,listing}from'../src/engine/index.js';
export async function loadComparisonWarriors({root:ROOT,work:WORK,fetchWarriorText,warn=console.warn}) {
  const list = [];
  const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'warriors/index.json'), 'utf8'));
  for (const e of lib) {
    if (e.language === 'python' || e.convertedFrom || e.battlefield) continue;   // pMARS has no planes or volumes
    let file = path.join(ROOT, 'warriors', e.file);
    let text = fs.readFileSync(file, 'utf8');
    if (e.language === 'javascript') {
      text = listing(compile(text, 'javascript'));
      file = path.join(WORK, e.file.replace(/\.js$/, '.red'));
      fs.writeFileSync(file, text);
    }
    list.push({ id: e.file, file, text });
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'test/fixtures')).filter(f=>f.endsWith('.red'))) {
    const file = path.join(ROOT, 'test/fixtures', f);
    list.push({ id: f, file, text: fs.readFileSync(file, 'utf8'), fixture: true });
  }
  const hof = JSON.parse(fs.readFileSync(path.join(ROOT, 'warriors/encyclopedia.json'), 'utf8')).hallOfFame;
  for (const h of hof) {
    if (/Frontwards/.test(h.url)) continue; // written for '94x rules
    try {
      const { text } = await fetchWarriorText(h.url);
      const file = path.join(WORK, `${list.length}-${decodeURIComponent(h.url.split('/').pop())}`);
      fs.writeFileSync(file, text);
      list.push({ id: h.name, file, text });
    } catch (e) {
      warn(`skipping ${h.name}: ${e.message}`);
    }
  }
  return list;
}

