import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compile, RULESETS } from '../../src/engine/index.js';
import { OPCODES } from '../../src/engine/constants.js';
import { fetchWarriorText } from '../../cli/remote.js';
import { publicReviews } from './reviews.js';

export const hash = text => createHash('sha256').update(text).digest('hex');
const ops = [...OPCODES, 'CMP'];
const redInstruction = new RegExp(`^\\s*(?:([A-Za-z_][\\w]*):?\\s+)?(${ops.join('|')})(?:\\.([A-Z]+))?\\b`, 'i');
// This is a source navigator, not a parser or a proof that sections compose.
export function inspectSource(source, language = 'redcode') {
  const lines = source.split(/\r?\n/), labels = [], constants = [], found = new Set();
  lines.forEach((line, i) => {
    const code = language === 'redcode' ? line.split(';')[0] : line.replace(/\/\/.*$/, '');
    if (language === 'redcode') {
      const equ = code.match(/^\s*([A-Za-z_]\w*)\s+EQU\s+(.+)$/i);
      if (equ) constants.push({ name: equ[1], line: i + 1, expression: equ[2].trim() });
      const m = code.match(redInstruction);
      if (m) { found.add(m[2].toUpperCase()); if (m[1]) labels.push({ label: m[1], line: i + 1 }); }
      else if (/^\s*[A-Za-z_]\w*:\s*$/.test(code) || /^\s*[A-Za-z_]\w*\s*$/.test(code) && !/^\s*(END|ROF)\s*$/i.test(code)) labels.push({ label: code.trim().replace(':', ''), line: i + 1 });
    } else {
      for (const m of code.matchAll(/\blabel\(\s*['"]([^'"]+)['"]\s*\)/g)) labels.push({ label: m[1], line: i + 1 });
      for (const m of code.matchAll(new RegExp(`\\b(${ops.join('|')})(?:\\.[a-z]+)?\\s*\\(`, 'gi'))) found.add(m[1].toUpperCase());
    }
  });
  const sections = labels.map((item, i) => {
    const endLine = labels[i + 1] ? labels[i + 1].line - 1 : lines.length;
    const text = lines.slice(item.line - 1, Math.max(item.line, endLine)).join('\n');
    const mentions = new Set(text.match(/[A-Za-z_]\w*/g) || []);
    return { ...item, endLine: Math.max(item.line, endLine), references: [...new Set(labels.filter(x => x.label !== item.label && mentions.has(x.label)).map(x => x.label))], constantReferences: constants.filter(x => mentions.has(x.name)).map(x => x.name), status: 'candidate-boundary' };
  });
  const families = [];
  if (found.has('LDP') || found.has('STP')) families.push('pspace-control');
  if (found.has('TRN')) families.push('torus-heading');
  if (found.has('SEQ') || found.has('CMP') || found.has('SNE') || found.has('JMZ')) families.push('scan-or-condition');
  if (found.has('SPL') && found.has('MOV')) families.push('replication-or-stun');
  if (found.has('MOV') && found.has('DAT')) families.push('copy-or-bomb-or-clear');
  if (found.has('DJN')) families.push('counter-or-decrement-stream');
  return { hash: hash(source), lines: lines.length, opcodes: [...found].sort(), constants, sections, familyHints: families,
    confidence: 'lexical hints only; macros, generated labels and dataflow require review' };
}
function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const languageOf = file => ({ '.red': 'redcode', '.js': 'javascript', '.py': 'python', '.cpp': 'cpp' })[path.extname(file)];
function assemblyChecks(text) {
  return Object.fromEntries(Object.entries(RULESETS).map(([key, settings]) => {
    const c = compile(text, 'redcode', settings);
    return [key, { ok: c.ok, length: c.instructions.length, errors: c.errors.slice(0, 3).map(e => ({ line: e.line, message: e.message })) }];
  }));
}
export async function inventorySources(root, { publicSources = false, previous = null, fetchSource = fetchWarriorText } = {}) {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'warriors/index.json'), 'utf8'));
  const encyclopedia = JSON.parse(fs.readFileSync(path.join(root, 'warriors/encyclopedia.json'), 'utf8'));
  const local = ['warriors', 'examples'].flatMap(dir => filesUnder(path.join(root, dir))).filter(languageOf).map(file => {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const metadata = index.find(x => `warriors/${x.file}` === relative);
    const source = fs.readFileSync(file, 'utf8'), language = languageOf(file);
    return { file: relative, language, name: metadata?.name ?? path.basename(file), family: metadata?.family ?? null,
      dialect: metadata?.dialect ?? null, battlefield: metadata?.battlefield ?? 'unspecified', experimental: !!metadata?.experimental,
      derivedFrom: metadata?.sameAs ?? metadata?.convertedFrom ?? metadata?.adaptedFrom ?? null,
      provenance: 'repository source; preserve file attribution', ...inspectSource(source, language),
      ...(language === 'redcode' ? { assembly: assemblyChecks(source) } : { assembly: 'not run: inventory does not execute generators' }) };
  });
  const publicList = [];
  for (const entry of encyclopedia.hallOfFame) {
    const prior = previous?.public?.find(x => x.url === entry.url);
    let item = prior ?? { name: entry.name, author: entry.author, family: entry.family, url: entry.url, status: 'not-fetched', license: 'not-established; reference only' };
    if (publicSources) {
      try {
        const fetched = await fetchSource(entry.url);
        // Archive text is only inspected/assembled, never executed as a generator.
        const inspection = inspectSource(fetched.text);
        const cache = path.join(root, 'imported/block-sources', `${inspection.hash}.red`);
        fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, fetched.text);
        item = { name: entry.name, author: entry.author, family: entry.family, url: entry.url, resolvedUrl: fetched.url,
          fetchedAt: new Date().toISOString(), status: 'inspected', license: 'not-established; reference only',
          ...inspection, assembly: assemblyChecks(fetched.text) };
      } catch (error) { item = { ...item, status: 'fetch-failed', error: error.message }; }
    }
    const review = publicReviews.find(x => x.name === entry.name);
    if (review) item = { ...item, review: { ...review, status: item.hash === review.hash ? 'source-reviewed; not behavior-tested' : 'stale: source hash differs' } };
    publicList.push(item);
  }
  return { schemaVersion: 1, scope: 'All .red/.js/.py/.cpp in warriors/ and examples/, including conversions and prototypes; public sources are the curated hallOfFame list, not all published warriors.',
    warning: 'Heuristic source sections are not executable blocks. Duplicate languages and adaptations are not independent strategies.', local, public: publicList };
}

export function sourceIndexMarkdown(inventory) {
  const safe = value => String(value ?? '').replaceAll('|', '/').replaceAll('\n', ' ');
  return '# Warrior source index\n\nGenerated by `node scripts/blocks.js catalog`. Every label region is a discovery candidate, not an independently usable block. Full line ranges, symbolic dependencies, constants, hashes and assembly errors are in [block-sources.json](block-sources.json). Generator files are scanned as text, never run by the inventory. Assembly columns report syntax/settings compatibility only.\n\n## Local sources\n\n| Source | Language | Family | Sections | Derived from |\n|---|---|---|---:|---|\n' + inventory.local.map(x => `| [${x.file}](../${x.file}) | ${x.language} | ${safe(x.family ?? x.familyHints.join(', '))} | ${x.sections.length} | ${safe(x.derivedFrom)} |`).join('\n') + '\n\n## Public references\n\nOriginals are cached only under ignored `imported/block-sources/`, keyed by SHA-256. Attribution is retained; redistribution rights have not been established. This is the curated archive list, not a claim to catalog all published warriors.\n\n| Source | Author | Family | Sections | Assembly passes | Inspection |\n|---|---|---|---:|---|---|\n' + inventory.public.map(x => `| [${safe(x.name)}](${x.url}) | ${safe(x.author)} | ${safe(x.family)} | ${x.sections?.length ?? 0} | ${Object.entries(x.assembly ?? {}).filter(([,s]) => s.ok).map(([k]) => k).join(', ') || 'none recorded'} | ${x.status} |`).join('\n') + '\n\n## Reviewed public anatomy\n\n' + inventory.public.filter(x => x.review).map(x => `### [${x.name}](${x.url})\n\n${x.review.status}. Maps to catalog candidate \`${x.review.block}\`.\n\n${x.review.parts.map(p => `- Lines ${p.lines.join('–')}: ${p.role}.`).join('\n')}\n\n${x.review.contract}\n`).join('\n');
}
