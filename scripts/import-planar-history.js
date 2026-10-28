// Optional historical ingestion. Downloads are treated only as Redcode/text data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, RULESETS } from '../src/engine/index.js';
import { hash, inspectSource } from '../tools/blocks/inventory.js';
import { blocks } from '../tools/blocks/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, 'imported/history/planar');
const base = 'https://gallium.inria.fr/~doligez/corewar/';
const download = process.argv.includes('--download');
if (process.argv.slice(2).some(x => x !== '--download')) throw new Error('Usage: node scripts/import-planar-history.js [--download]');
fs.mkdirSync(path.join(cache,'files'), {recursive:true});
const receiptFile = path.join(cache,'downloads.json');
const receipts = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile,'utf8')) : {};
const saveReceipts = () => fs.writeFileSync(receiptFile,JSON.stringify(receipts,null,2)+'\n');
const relative = file => path.relative(root,file).replaceAll('\\','/');
function decode(bytes) {
  try { return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),encoding:'utf-8'}; }
  catch { return {text:new TextDecoder('windows-1252').decode(bytes),encoding:'windows-1252 fallback'}; }
}
const plain = html => html.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
function link(href, parent = base+'by-date/complete.htm') {
  // The old archive uses literal percent signs in several filenames.
  const escaped = href.trim().replace(/%(?![0-9a-f]{2})/gi,'%25');
  return new URL(escaped.replace(/&amp;/g,'&'),parent).href;
}
function safeUrl(url) {
  const u=new URL(url);
  if(u.origin!==new URL(base).origin || !u.pathname.startsWith(new URL(base).pathname)) throw new Error('Outside archive: '+url);
}
async function obtain(url) {
  safeUrl(url);
  const old=receipts[url];
  if(old?.status==='downloaded') {
    const file=path.resolve(root,old.cache);
    if(!file.startsWith(cache+path.sep)) throw new Error('Cache path outside archive');
    const bytes=fs.readFileSync(file);
    if(hash(bytes)!==old.sha256) throw new Error('Cached file changed: '+url);
    return bytes;
  }
  if(!download) return null;
  let error;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
      safeUrl(response.url);
      if(!response.ok) throw new Error('HTTP '+response.status);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>2*1024*1024) throw new Error('File exceeds 2 MiB');
      if(/\.txt(?:$|[?#])/.test(url) && /<html|<!doctype html/i.test(bytes.subarray(0,200).toString())) throw new Error('HTML returned for text source');
      const file=path.join(cache,'files',hash(url)+'.txt');
      fs.writeFileSync(file,bytes);
      receipts[url]={status:'downloaded',resolvedUrl:response.url,cache:relative(file),sha256:hash(bytes),bytes:bytes.length,retrievedAt:new Date().toISOString()};
      return bytes;
    } catch(e) {error=e.message;}
  }
  receipts[url]={status:'fetch-failed',error};
  return null;
}
const indexes={};
for(const [id,url] of Object.entries({home:base,date:base+'by-date/complete.htm',name:base+'by-name/complete.htm',types:base+'by-types/idx.htm'})) {
  const bytes=await obtain(url);
  if(!bytes) {saveReceipts();throw new Error('Missing index: '+url+'; run with --download');}
  indexes[id]={url,...receipts[url],...decode(bytes)};
}
function parseIndex(text) {
  const rows=text.split(/\r?\n/).filter(line=>/href="\s*\.\.\/rc\//.test(line));
  return rows.map(line=>{
    const m=line.match(/^<a href="\s*(\.\.\/rc\/[^\"]+)">(.*?)<\/a>\s*\((.*?)\)\s+([\d?-]+)\s+\[(.*)\]\s*(.*?)<br>\s*$/);
    if(!m) throw new Error('Unrecognized archive row: '+line);
    return {url:link(m[1]),name:plain(m[2]),author:plain(m[3]),archiveDate:m[4],
      datePrecision:m[4].includes('?')?'uncertain':m[4].length===10?'day':m[4].length===7?'month':'year',
      provenanceLabel:plain(m[5]),references:[...m[5].matchAll(/<a href="([^\"]+)">([^<]*)<\/a>/g)].map(x=>({url:link(x[1]),label:plain(x[2])})),
      components:plain(m[6]).split(',').map(x=>x.trim()).filter(Boolean)};
  });
}
const entries=parseIndex(indexes.date.text), named=parseIndex(indexes.name.text);
if(!entries.length || JSON.stringify(entries.map(x=>x.url).sort())!==JSON.stringify(named.map(x=>x.url).sort())) throw new Error('Name/date index coverage mismatch');
const categories=[...indexes.types.text.matchAll(/<dt><a href="([^\"]+)">([^<]+)<\/a>\s*<dd>([\s\S]*?)(?=<dt>|<\/dl>)/g)]
  .map(x=>({id:x[2],url:link(x[1],indexes.types.url),definition:plain(x[3]).replace(/\s+/g,' ')}));
if(categories.length!==14) throw new Error('Expected 14 archive component types');
if(entries.some(x=>x.components.some(c=>!categories.some(t=>t.id===c)))) throw new Error('Unknown component tag; inspect index parser');
saveReceipts();
const referenceUrls=[...new Set(entries.flatMap(x=>x.references.map(r=>r.url)))].filter(url=>url.startsWith(base)&&url.endsWith('.txt'));
const tasks=[...new Set([...entries.map(x=>x.url),...referenceUrls,...categories.map(x=>x.url)])];
let cursor=0,done=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor<tasks.length) {
    await obtain(tasks[cursor++]);
    done++;
    if(done%100===0) {saveReceipts();console.log(`Cached/checked ${done}/${tasks.length} archive resources`);}
  }
}));
saveReceipts();
console.log('Downloads complete; indexing sources and component memberships');
const membershipIssues=[];
for(const category of categories) {
  const bytes=await obtain(category.url);
  if(!bytes) {category.status='fetch-failed';continue;}
  category.status='indexed';
  const members=[...decode(bytes).text.matchAll(/href="\s*(\.\.\/rc\/[^\"]+)"/g)].map(x=>link(x[1]));
  category.members=[...new Set(members)].sort();
  const expected=entries.filter(x=>x.components.includes(category.id)).map(x=>x.url);
  category.missingFromTypePage=expected.filter(x=>!category.members.includes(x));
  category.extraOnTypePage=category.members.filter(x=>!expected.includes(x));
  if(category.missingFromTypePage.length||category.extraOnTypePage.length) membershipIssues.push(category.id);
}
const n1ls=JSON.parse(fs.readFileSync(path.join(root,'docs/n1ls-warrior-history.json'),'utf8'));
const exact=new Map(), assembled=new Map(), known=new Map();
const add=(map,key,value)=>map.set(key,[...(map.get(key)??[]),value]);
for(const s of n1ls.sources) {
  add(exact,s.sha256,s.file);
  for(const [rules,result] of Object.entries(s.assembly)) if(result.ok) add(assembled,rules+':'+result.assembledHash,s.file);
}
const oldHistory=JSON.parse(fs.readFileSync(path.join(root,'docs/warrior-history-sources.json'),'utf8'));
const oldInventory=JSON.parse(fs.readFileSync(path.join(root,'docs/block-sources.json'),'utf8'));
for(const s of [...oldHistory.sources,...oldInventory.local,...oldInventory.public]) if(s.hash) add(known,s.hash,s.url??s.file);
const anatomy=[], sources=[];
for(const entry of entries) {
  const receipt=receipts[entry.url],bytes=await obtain(entry.url);
  if(!bytes) {sources.push({...entry,status:'fetch-failed',error:receipt?.error??'not cached'});continue;}
  const {text,encoding}=decode(bytes), inspection=inspectSource(text);
  anatomy.push({url:entry.url,...inspection});
  const assembly=Object.fromEntries(Object.entries(RULESETS).map(([rules,settings])=>{
    const w=compile(text,'redcode',settings);
    const assembledHash=w.ok?hash(JSON.stringify({start:w.start,instructions:w.instructions.map(({line,...instruction})=>instruction)})):null;
    return [rules,{ok:w.ok,length:w.instructions.length,fits50:w.ok&&w.instructions.length<=50,
      ...(assembledHash?{assembledHash,n1lsMatches:assembled.get(rules+':'+assembledHash)??[]}:{}),
      errors:w.errors.slice(0,3).map(({line,message})=>({line,message}))}];
  }));
  sources.push({...entry,...receipt,status:'indexed; not behavior-tested',encoding,
    sourceRole:'maintainer assembly copy; references lead to original posts or publication evidence',
    admission:entry.components.some(x=>x==='factor'||x==='sort')?'special-purpose task; exclude from battle pools pending review':'requires behavioral review',
    headerName:text.match(/^\s*;\s*name\s+(.+)$/im)?.[1]?.trim()??null,
    headerAuthor:text.match(/^\s*;\s*author\s+(.+)$/im)?.[1]?.trim()??null,
    sectionCount:inspection.sections.length,constantCount:inspection.constants.length,
    n1lsExactMatches:exact.get(receipt.sha256)??[],knownExactMatches:known.get(receipt.sha256)??[],assembly});
}
const typeMap={stone:['opening-bomber'],paper:['paper-copy','silk-launch'],vamp:['vampire-fang'],stun:['clear-stun-dat'],imp:['imp-spiral'],clear:['clear-dat','clear-stun-dat'],scan:['opening-bscan','compare-scan','one-shot'],pspace:['pspace-selector'],boot:['relocate-copy'],gate:['decrement-gate'],quick:['quickscan'],factor:[],sort:[],other:[]};
for(const c of categories) {
  c.catalogCandidates=typeMap[c.id]??[];
  c.catalogStatus=c.catalogCandidates.map(id=>{
    const b=blocks.find(x=>x.id===id);
    if(!b) throw new Error('Unknown local block: '+id);
    return {id,selectableInExistingGrammar:b.selectable,behaviorTest:b.validation.behaviorTest,
      caveat:'Status describes our existing implementation, not a block extracted from this archive'};
  });
}
const good=sources.filter(x=>x.assembly), uniqueGood=[...new Map(good.map(x=>[x.url,x])).values()], years=good.map(x=>x.archiveDate.slice(0,4));
const sharedSourceUrls=[...new Set(entries.map(x=>x.url))].map(url=>({url,entries:entries.filter(x=>x.url===url).map(({name,author,archiveDate})=>({name,author,archiveDate}))})).filter(x=>x.entries.length>1);
for(const s of sources) if(sharedSourceUrls.some(x=>x.url===s.url)) {
  s.identityWarning='Multiple archive names share this source URL; do not treat the downloaded code as verified for every named version';
  s.admission='ambiguous source identity; exclude from battle pools pending review';
}
const report={schemaVersion:1,requestedUrl:'http://moscova.inria.fr/~doligez/corewar/',resolvedArchive:base,
  snapshotIndexes:Object.fromEntries(Object.entries(indexes).map(([key,{text,...value}])=>[key,value])),
  scope:'Every source linked by the name/date indexes, plus their same-archive .txt references and all 14 component pages; not a recursive mirror or the entire Olympus/binary archive.',
  attribution:'Damien Doligez (Planar), archive maintainer; individual warrior authors retained separately.',
  dateCaution:'Maintainer release dates, sometimes partial or uncertain, are not verified invention dates. Original posts are stored separately from maintainer assembly copies.',
  taxonomyCaution:'Archive component tags and local candidate mappings are discovery hints, not verified block contracts or historical rulesets.',
  summary:{homepageAdvertisedWarriors:1689,indexedEntries:entries.length,uniqueSourceUrls:new Set(entries.map(x=>x.url)).size,downloadedEntries:good.length,downloadedSources:new Set(good.map(x=>x.url)).size,failedEntries:sources.length-good.length,
    dateRange:[years.reduce((a,b)=>a<b?a:b),years.reduce((a,b)=>a>b?a:b)],
    uncertainDates:sources.filter(x=>x.datePrecision==='uncertain').length,
    partialDates:sources.filter(x=>['year','month'].includes(x.datePrecision)).length,
    componentPages:categories.length,membershipIssues,
    textReferences:referenceUrls.length,downloadedTextReferences:referenceUrls.filter(u=>receipts[u]?.status==='downloaded').length,
    n1lsExactOverlap:uniqueGood.filter(x=>x.n1lsExactMatches.length).length,
    n1lsAssemblyOverlap94nop:uniqueGood.filter(x=>x.assembly['94nop'].n1lsMatches?.length).length,
    specialPurposeEntries:good.filter(x=>x.admission.startsWith('special')).length,
    assemblyCounting:'Unique source URLs, not repeated index rows',
    assembly:Object.fromEntries(Object.keys(RULESETS).map(r=>[r,{pass:uniqueGood.filter(x=>x.assembly[r].ok).length,fits50:uniqueGood.filter(x=>x.assembly[r].fits50).length}]))},
  sharedSourceUrls,categories,sources,referenceDocuments:referenceUrls.map(url=>({url,...receipts[url]})),
  failures:Object.entries(receipts).filter(([,x])=>x.status==='fetch-failed').map(([url,x])=>({url,...x}))};
fs.writeFileSync(path.join(cache,'anatomy.json'),JSON.stringify(anatomy,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/planar-warrior-history.json'),JSON.stringify(report,null,2)+'\n');
const safe=x=>String(x).replaceAll('|','/').replace(/[\r\n]/g,' ');
fs.writeFileSync(path.join(root,'docs/planar-warrior-index.md'),'# Planar archive: warriors by release date\n\n'
  +'Generated by `node scripts/import-planar-history.js`. [History and taxonomy](planar-warrior-history.md) · [Full metadata and diagnostics](planar-warrior-history.json). '
  +'Dates and component tags come from the maintainer; partial dates and question marks are preserved. Source links open maintainer assembly copies. '
  +'The metadata retains original-post links separately. Assembly passes are local compatibility only.\n\n'
  +'| Source | Author | Archive release date | Components | Assembly passes |\n|---|---|---|---|---|\n'
  +sources.map(x=>`| [${safe(x.name)}](${x.url}) | ${safe(x.author)} | ${x.archiveDate} | ${x.components.join(', ')} | ${Object.entries(x.assembly??{}).filter(([,v])=>v.ok).map(([r])=>r).join(', ')||'none'} |`).join('\n')+'\n');
fs.writeFileSync(path.join(root,'docs/planar-components.md'),'# Historical component taxonomy and our blocks\n\n'
  +'Generated from Planar’s 14 component pages and our existing block catalog. [Archive notes](planar-warrior-history.md) · [Warrior index](planar-warrior-index.md) · [Full membership data](planar-warrior-history.json). '
  +'Counts are unique source URLs per component, so a composite warrior appears in several rows. Definitions are the archive maintainer’s classification. '
  +'Local mappings identify related implementations or design candidates; they do not certify archive code for composition.\n\n'
  +'| Archive component | Sources | Related local blocks |\n|---|---:|---|\n'
  +categories.map(c=>`| [${c.id}](${c.url}) | ${c.members?.length??0} | ${c.catalogStatus.map(x=>`\`${x.id}\` (${x.selectableInExistingGrammar?'selectable in existing grammar':'candidate only'})`).join(', ')||'No battle-block mapping'} |`).join('\n')
  +'\n\nBoot relocation here does not imply our implementation also supplies the archive’s decoy behavior. Quick covers both quick scanning and quick bombing; our mapping is only to quickscan. '
  +'P-space requires a profile that enables it, such as 94x-hill, rather than 94x. Factor and sort are tournament computation tasks, with no automatic battle-pool admission. '
  +'Other requires individual inspection. Every proposed extraction still needs entry/exit, pointer, process, length and ruleset contracts.\n\n'
  +'The [focused other-category review](planar-other-review.md) surveys all 305 sources, examines selected mechanisms and records compact-source experiments.\n');
console.log(JSON.stringify(report.summary,null,2));
if(report.failures.length) {console.log(JSON.stringify(report.failures));process.exitCode=1;}
