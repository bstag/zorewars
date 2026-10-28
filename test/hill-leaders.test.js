import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRanking, extractReference, hills, leaderMarkdown } from '../tools/blocks/hill-leaders.js';
import { hash } from '../tools/blocks/inventory.js';
import { compile, RULESETS } from '../src/engine/index.js';

test('ranking parser preserves rank, attribution, score and resolved source URL', () => {
  const html = ' 1 <a href="HILL32/a.red">A &amp; B</a>   First Author  180.001 (P-Space)\n 2 <a href="HILL32/b.red">Second</a> Other Author 170.000 (94)';
  const rows = parseRanking(html, 'https://asdflkj.net/COREWAR/X/hill32_rec.html', 2);
  assert.deepEqual(rows[0], { rank: 1, name: 'A & B', author: 'First Author', score: 180.001, style: 'P-Space', url: 'https://asdflkj.net/COREWAR/X/HILL32/a.red' });
  assert.throws(() => parseRanking(html.replace(' 2 <a', ' 3 <a'), 'https://example.com/', 2), /ranks/);
  assert.throws(() => parseRanking(html, 'https://example.com/', 3), /ranks/);
  assert.throws(() => parseRanking(html, 'https://example.com/', 0), /1..50/);
});

test('reviewed extraction preserves attribution and symbolic links; stale review cannot extract', () => {
  const source = ';name Reference\n;author Original\nstart JMP body\nbody JMP start\nEND start\n';
  const review = { hash: hash(source), extraction: { id: 'test', ranges: [[3,4]], entry: 'start' } };
  const output = extractReference(source, review);
  const w = compile(output, 'redcode', { ...RULESETS['94nop'], maxLength: 50 });
  assert.equal(w.ok, true);
  assert.equal(w.instructions.length, 2);
  assert.equal(w.author, 'Original');
  assert.throws(() => extractReference(source + ';changed', review), /stale/);
  const broken = extractReference(source, { ...review, extraction: { ...review.extraction, ranges: [[3,3]] } });
  assert.equal(compile(broken).ok, false); // unresolved body is not silently patched
});

test('documented switch removes only the conditional scanner at assembly time', () => {
  const source = ';name Test\nswitch equ 1 ; documented switch\nfor switch\nDAT #0,#0\nrof\nmain JMP main\nEND main\n';
  const output = extractReference(source, { hash: hash(source), extraction: { id: 'switch', switchOff: true } });
  assert.match(output, /switch equ 0 ; documented switch/);
  const w = compile(output, 'redcode', RULESETS['88']);
  assert.equal(w.ok, true);
  assert.equal(w.instructions.length, 1);
});

test('source hill settings are explicit and never change tournament presets', () => {
  assert.equal(hills.find(x=>x.id==='94x').settings.pSpace, true);
  assert.equal(hills.find(x=>x.id==='lp').settings.maxLength, 200);
  assert.equal(RULESETS['94x'].pSpace, false);
  assert.equal(RULESETS.lp.maxLength, 100);
  assert.equal(RULESETS.lp.pSpace, false);
});

test('recorded reviews have valid source bounds and show failures rather than eligibility claims', () => {
  const report = JSON.parse(fs.readFileSync(new URL('../docs/hill-leaders.json', import.meta.url), 'utf8'));
  for (const row of report.leaders.filter(x=>x.review?.current)) {
    assert.equal(row.review.hash, row.inspection.hash);
    for (const [a,b] of row.review.parts) assert.ok(a >= 1 && b >= a && b <= row.inspection.lines);
  }
  assert.ok(report.patterns.every(x => x.selectable === false));
  assert.match(leaderMarkdown(report), /not.*strength/i);
});
