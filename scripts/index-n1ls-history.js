// Index the pinned public collection as Redcode data; never execute downloaded generators.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compile, RULESETS } from '../src/engine/index.js';
import { inspectSource, hash } from '../tools/blocks/inventory.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const commit = '615f2f3d75acfcb5420821eb5c1acc659377a7e2';
const treeSha = '0101c055147bc8e3633ca7bd05bed34776027abc';
const repository = 'https://github.com/n1LS/redcode-warriors';
const cache = path.join(root, 'imported/history/n1ls');
const corpus = path.join(cache, `redcode-warriors-${commit}`);
const tree = JSON.parse(fs.readFileSync(path.join(cache, 'tree.json'), 'utf8'));
if (tree.sha !== treeSha || tree.truncated || tree.tree.some(x => x.type !== 'blob' || x.mode !== '100644' || !/^[\w.-]+$/.test(x.path))) {
  throw new Error('Expected the complete flat, regular-file tree for the pinned snapshot');
}
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
// Verify the tree itself, then every extracted file against its Git blob hash.
const treeBytes = Buffer.concat([...tree.tree].sort((a,b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))
  .map(x => Buffer.concat([Buffer.from(`100644 ${x.path}\0`), Buffer.from(x.sha, 'hex')])));
if (digest('sha1', Buffer.concat([Buffer.from(`tree ${treeBytes.length}\0`), treeBytes])) !== treeSha) throw new Error('Tree hash mismatch');
const actualFiles = fs.readdirSync(corpus).sort();
const expectedFiles = tree.tree.map(x => x.path).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('Missing or extra files in extracted snapshot');
const verified = tree.tree.map(entry => {
  const bytes = fs.readFileSync(path.join(corpus, entry.path));
  const gitBlob = digest('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
  if (gitBlob !== entry.sha || bytes.length !== entry.size) throw new Error(`Snapshot mismatch: ${entry.path}`);
  return { entry, bytes, source: bytes.toString('utf8') };
});

const known = new Map();
const remember = (sha, reference) => { if (sha) known.set(sha, [...(known.get(sha) ?? []), reference]); };
const existing = JSON.parse(fs.readFileSync(path.join(root, 'docs/block-sources.json'), 'utf8'));
for (const item of [...existing.local, ...existing.public]) remember(item.hash, item.url ?? item.file);
const history = JSON.parse(fs.readFileSync(path.join(root, 'docs/warrior-history-sources.json'), 'utf8'));
for (const item of history.sources) remember(item.hash, item.url);
const groups = (sources, field) => {
  const map = new Map();
  for (const x of sources) map.set(x[field], [...(map.get(x[field]) ?? []), x.file]);
  return [...map.values()].filter(x => x.length > 1);
};
const anatomy = [];
const sources = verified.filter(x => /\.red$/i.test(x.entry.path)).map(({entry, bytes, source}) => {
  const lines = source.split(/\r?\n/);
  const values = tag => lines.flatMap((line, i) => {
    const m = line.match(new RegExp(`^\\s*;\\s*${tag}\\s+(.+)$`, 'i'));
    return m ? [{ line: i + 1, text: m[1].trim() }] : [];
  });
  const inspection = inspectSource(source);
  anatomy.push({ file: entry.path, ...inspection });
  const assembly = Object.fromEntries(Object.entries(RULESETS).map(([rules, settings]) => {
    const w = compile(source, 'redcode', settings);
    return [rules, { ok: w.ok, length: w.instructions.length, fits50: w.ok && w.instructions.length <= 50,
      ...(w.ok ? {assembledHash:hash(JSON.stringify({start:w.start,instructions:w.instructions.map(({line,...instruction})=>instruction)}))} : {}),
      errors: w.errors.slice(0,3).map(({line,message}) => ({line,message})) }];
  }));
  // Only lexical equality after stripping comments/whitespace: not semantic equivalence.
  const lexical = lines.map(line => line.split(';')[0].replace(/\s+/g,'').toUpperCase()).filter(Boolean).join('\n');
  return { file: entry.path, url: `${repository}/blob/${commit}/${encodeURIComponent(entry.path)}`,
    rawUrl: `https://raw.githubusercontent.com/n1LS/redcode-warriors/${commit}/${encodeURIComponent(entry.path)}`,
    cache: path.relative(root, path.join(corpus, entry.path)).replaceAll('\\','/'),
    sha256: hash(bytes), gitBlob: entry.sha, bytes: bytes.length,
    name: values('name')[0]?.text ?? null, author: values('author')[0]?.text ?? null,
    dialectHeader: lines.find(x => /^\s*;\s*redcode\b/i.test(x))?.trim() ?? null,
    strategy: values('strategy'), versionNotes: values('rem\\s+strategy'),
    dateEvidence: lines.flatMap((text,i) => /^\s*;/.test(text) && /\b(?:\d{1,4}[/-]\d{1,2}[/-]\d{1,4}|(?:19|20)\d{2})\b/.test(text)
      ? [{line:i+1,text:text.trim(),status:'source comment; date meaning requires review'}] : []),
    knownExactMatches: known.get(hash(bytes)) ?? [], lexicalHash: hash(lexical),
    familyHints: inspection.familyHints, sectionCount: inspection.sections.length, constantCount: inspection.constants.length,
    assembly, status: 'indexed; not behavior-tested or admitted to evolution' };
});
const report = { schemaVersion:1, repository, commit, tree:treeSha, repositoryCommitDate:'2018-04-27T10:04:48Z',
  retrievedOn:'2026-10-28', dateCaution:'Repository upload date is not a warrior creation date; source dates are unverified unless explicitly reviewed.',
  scope:'All 567 .red files in the pinned snapshot, plus listing.txt as a preserved auxiliary source. No downloaded code is executed as a host program.',
  license:'No repository license file in this snapshot; originals retained only in ignored imported/history/n1ls/. Original source attribution preserved.',
  compatibilityCaution:'Assembly is against local profiles only; a pass does not establish historical dialect, survival, strength, or a reusable block contract. A failure can reflect profile assumptions or assembler differences.',
  anatomy:'imported/history/n1ls/anatomy.json (regenerated by this script)',
  auxiliaryFiles: verified.filter(x => !/\.red$/i.test(x.entry.path)).map(x => ({file:x.entry.path,sha256:hash(x.bytes),gitBlob:x.entry.sha})),
  summary:{ sources:sources.length, named:sources.filter(x=>x.name).length, attributed:sources.filter(x=>x.author).length,
    withDateEvidence:sources.filter(x=>x.dateEvidence.length).length, withKnownExactMatches:sources.filter(x=>x.knownExactMatches.length).length,
    assembly:Object.fromEntries(Object.keys(RULESETS).map(r=>[r,{pass:sources.filter(x=>x.assembly[r].ok).length,fits50:sources.filter(x=>x.assembly[r].fits50).length}])) },
  exactDuplicateGroups:groups(sources,'sha256'), lexicalDuplicateGroups:groups(sources,'lexicalHash'),
  assembledDuplicateGroups:Object.fromEntries(Object.keys(RULESETS).map(r=>[r,groups(sources.filter(x=>x.assembly[r].ok).map(x=>({file:x.file,assembledHash:x.assembly[r].assembledHash})),'assembledHash')])), sources };
fs.writeFileSync(path.join(cache,'anatomy.json'),JSON.stringify(anatomy,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/n1ls-warrior-history.json'),JSON.stringify(report,null,2)+'\n');
const safe = x => String(x ?? 'unspecified').replaceAll('|','/').replace(/[\r\n]/g,' ');
fs.writeFileSync(path.join(root,'docs/n1ls-warrior-index.md'), '# n1LS warrior collection: source index\n\n'
  + 'Generated by `node scripts/index-n1ls-history.js`. See [history and interpretation](n1ls-warrior-history.md) and [full metadata, hashes and assembly diagnostics](n1ls-warrior-history.json). '
  + 'All sources are pinned to commit `' + commit + '`. Links open the attributed originals. Assembly passes indicate local compatibility only; these are not verified evolutionary building blocks.\n\n'
  + '| File | Name | Author | Assembly passes | Fits 50 in |\n|---|---|---|---|---|\n'
  + sources.map(x=>`| [${safe(x.file)}](${x.url}) | ${safe(x.name)} | ${safe(x.author)} | ${Object.entries(x.assembly).filter(([,v])=>v.ok).map(([k])=>k).join(', ') || 'none'} | ${Object.entries(x.assembly).filter(([,v])=>v.fits50).map(([k])=>k).join(', ') || 'none'} |`).join('\n')+'\n');
console.log(JSON.stringify({ ...report.summary, exactDuplicateGroups:report.exactDuplicateGroups.length,lexicalDuplicateGroups:report.lexicalDuplicateGroups.length },null,2));
