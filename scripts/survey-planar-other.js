// Discovery survey: comment signals are not verified mechanism classifications.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile,RULESETS} from '../src/engine/index.js';
import {hash,inspectSource} from '../tools/blocks/inventory.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/planar-warrior-history.json'),'utf8'));
const signals={
  'repair-refresh':/repair|regenerat|refresh|restor|checksum|zero.sum/i,
  'damage-response':/airbag|watchdog|monitor|damag|bomb dodg/i,
  'movement-dodging':/dodg|jump.*(away|ahead|over)|crawl|leap|moving|move.*memor/i,
  'remote-workers':/spawn|deploy|copies.*(fighter|dwarf)|bomb.*(routines|programs)|many dwarfs/i,
  'borrow-enemy-code':/opponent.s code|enemy code|execute.*(enemy|opponent|program)|leech|snatch|copykat/i,
  'arithmetic-disruption':/mutagen|mutations|alter.*instruction|decrement|djn.?stream|disrupt/i,
  'environment-sensing':/read.*limit|writ.*limit|addressing range|how large core|process.*limit|boot.*distance|process.*find/i,
  'tournament-protocol':/handshake|cooperat|defect|self.fight|self.win|\-F\s*\d|look.up table|score.*point/i,
  'nonbattle-or-intentional-loss':/validation|prime numbers|algorithm|sorting|shell sort|starfield|fractal|find.*(lcd|mod)|lose always|lose.*100%|lose points|suicide more efficiently/i,
  'evolution-history':/evolv|evolution|genetic|random soup/i,
  'vampire-backtracking':/trac.*(snare|vamp|pit)|vampires.*afraid|anti.vamp/i,
};
const sources=manifest.sources.filter(x=>x.components.includes('other')).map(x=>{
  const bytes=fs.readFileSync(path.join(root,x.cache));
  if(hash(bytes)!==x.sha256)throw new Error('Changed source: '+x.url);
  const source=new TextDecoder(x.encoding.startsWith('utf-8')?'utf-8':'windows-1252').decode(bytes);
  const comments=source.split(/\r?\n/).flatMap((line,i)=>line.includes(';')?[{line:i+1,text:line.slice(line.indexOf(';')+1).trim()}]:[]);
  const commentSignals=Object.entries(signals).flatMap(([id,re])=>{
    const evidence=comments.filter(c=>re.test(c.text)).slice(0,3);
    return evidence.length?[{id,evidence,status:'keyword hint; requires source review'}]:[];
  });
  const w=compile(source,'redcode',{...RULESETS['94x'],maxLength:50});
  return {name:x.name,author:x.author,url:x.url,sha256:x.sha256,archiveDate:x.archiveDate,components:x.components,references:x.references,
    strategyComments:comments.filter(c=>/^strategy\b/i.test(c.text)),assertions:comments.filter(c=>/^assert\b/i.test(c.text)),
    opcodes:inspectSource(source).opcodes,commentSignals,
    compact94x:{ok:w.ok,instructions:w.instructions.length,errors:w.errors.slice(0,3)},
    reviewStatus:'surveyed metadata/comments and compile compatibility; not an individual behavioral review'};
});
const report={schemaVersion:1,scope:'All 305 Planar other-category sources. Keyword signals only prioritize reading; no automatic strategy or evolution admission.',
  rules:{...RULESETS['94x'],maxLength:50},summary:{sources:sources.length,compact94xPass:sources.filter(x=>x.compact94x.ok).length,
    pspaceSyntax:sources.filter(x=>x.opcodes.some(op=>['LDP','STP'].includes(op))).length,
    withCommentSignals:sources.filter(x=>x.commentSignals.length).length,
    signalCounts:Object.fromEntries(Object.keys(signals).map(id=>[id,sources.filter(x=>x.commentSignals.some(s=>s.id===id)).length]))},sources};
if(sources.length!==305||new Set(sources.map(x=>x.url)).size!==305)throw new Error('Category snapshot changed; review scope before replacing survey');
fs.writeFileSync(path.join(root,'docs/planar-other-survey.json'),JSON.stringify(report,null,2)+'\n');
const safe=x=>String(x).replaceAll('|','/').replace(/[\r\n]/g,' ');
fs.writeFileSync(path.join(root,'docs/planar-other-index.md'),'# Survey of Planar’s other category\n\n'
  +'All 305 sources are listed. [Review and experiments](planar-other-review.md) · [Source mechanism notes](planar-other-mechanisms.md) · [Survey evidence](planar-other-survey.json). '
  +'Reading signals are keyword matches in comments, not confirmed classifications. The 94x column compiles unchanged sources with an actual 50-instruction limit, which may change MAXLENGTH-dependent expansion. '
  +'A pass is not a behavioral gate; most entries have not been simulated in this review.\n\n'
  +'| Source | Archive date | Reading signals | 94x with length 50 |\n|---|---|---|---|\n'
  +sources.map(x=>`| [${safe(x.name)}](${x.url}) | ${x.archiveDate} | ${x.commentSignals.map(s=>s.id).join(', ')||'Read source individually'} | ${x.compact94x.ok?x.compact94x.instructions+' instructions':'fails: '+safe(x.compact94x.errors[0]?.message??'unknown error')} |`).join('\n')+'\n');
console.log(JSON.stringify(report.summary,null,2));
