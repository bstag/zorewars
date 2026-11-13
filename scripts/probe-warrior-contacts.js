#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {compile} from '../src/engine/index.js';
import {buildTree,leaves} from '../tools/algebra/index.js';
import {codeHash,points} from '../tools/comparison/paired.js';
import {selectWriterContacts,probeWrite} from '../tools/comparison/probe.js';

const argv=process.argv.slice(2),at=argv.indexOf('--out');
if(!argv[0]||at<0||!argv[at+1]){console.error('usage: node scripts/probe-warrior-contacts.js config.json --out directory');process.exit(2);}
const configFile=path.resolve(argv[0]),config=JSON.parse(fs.readFileSync(configFile)),base=path.resolve(path.dirname(configFile),config.baseDirectory??'.'),input=path.resolve(base,config.comparison),out=path.resolve(argv[at+1]),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),fileHash=p=>sha(fs.readFileSync(p)),write=(p,x)=>fs.writeFileSync(path.join(out,p),typeof x==='string'?x:JSON.stringify(x,null,2));
const prior=read(path.join(input,'manifest.json')),savedConfig=read(path.join(input,'replay.config.json')),report=read(path.join(input,'report.json')),settings=prior.settings,subjects={},trees={},sourceHashes={};
for(const side of ['baseline','candidate']){
 for(const draft of savedConfig[side].drafts??[]){if(!/^_[a-z0-9-]+\.js$/.test(draft))throw Error('Expected a bundled draft');const module=await import(pathToFileURL(path.join(repo,'tools/algebra/blocks',draft)).href);for(const b of [].concat(module.default))leaves[b.id]={...b,file:draft};}
 const source=fs.readFileSync(path.join(input,'inputs',side+'.red'),'utf8');assert.equal(sha(source),prior.inputHashes[side].sourceHash);const w=subjects[side]=compile(source,'redcode',settings);assert.ok(w.ok);assert.equal(codeHash(w,settings.coreSize),prior.inputHashes[side].compiledHash);sourceHashes[side]=sha(source);
 if(savedConfig[side].tree){const text=fs.readFileSync(path.join(input,'inputs',side+'.tree.json'),'utf8');assert.equal(sha(text),prior.inputHashes[side].treeHash);trees[side]=buildTree(JSON.parse(text),{rules:savedConfig.rules??'94nop',length:savedConfig.length??100,verification:'full'});assert.equal(codeHash(trees[side].w,settings.coreSize),codeHash(w,settings.coreSize));}
}
const opponents=read(path.join(input,'inputs/opponents.json')).map(o=>({...o,w:{...o.w,ok:true}}));
assert.equal(sha(JSON.stringify(opponents.map(o=>({id:o.id,name:o.w.name,hash:codeHash(o.w,settings.coreSize)})))),prior.inputHashes.opponents.programSetHash);
const implementationFiles=[];function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else if(p.endsWith('.js'))implementationFiles.push(p);}}
for(const d of ['src/engine','tools/comparison','tools/algebra'])walk(path.join(repo,d));implementationFiles.push(fileURLToPath(import.meta.url));
const implementation=sha(JSON.stringify(implementationFiles.sort().map(p=>[path.relative(repo,p).replaceAll('\\','/'),fileHash(p)]))),cases=report.cases.map(c=>({id:c.id,hash:fileHash(path.join(input,'cases',c.id+'.json'))})),fingerprint=sha(JSON.stringify({config,prior:prior.fingerprint,implementation,cases}));
fs.mkdirSync(path.join(out,'cases'),{recursive:true});if(fs.existsSync(path.join(out,'manifest.json')))assert.equal(read(path.join(out,'manifest.json')).fingerprint,fingerprint,'Use a different output directory for changed inputs/tooling');
write('manifest.json',{schema:'writer-pointer-probes-v1',fingerprint,implementation,config,sourceHashes,inputFingerprint:prior.fingerprint,inputCases:cases,selection:'For each previously selected round and version, use the first N retained contacts by the first address-diverging writer that the opponent later uses as an indirect pointer. Order by consumption step, writing step, ID. Do not fill missing pointer contacts with other writes.',intervention:'Restore changed numeric fields after the writing instruction: jointly, then A and B separately when distinct. One no-op control per nonempty version.'});
const results=[];
for(const selected of report.cases){
 const c=read(path.join(input,'cases',selected.id+'.json'));assert.equal(c.fingerprint,prior.fingerprint);
 for(const side of ['baseline','candidate']){
  const target=c.trace.divergence.firstAddresses?.[side],v=c.trace.versions[side],id=c.id+'-'+side,filename='cases/'+id+'.json';let row;
  if(fs.existsSync(path.join(out,filename))){row=read(path.join(out,filename));assert.equal(row.fingerprint,fingerprint);}else{
   const contacts=target?selectWriterContacts(v.contacts.contacts,{pc:target.pc,instruction:target.instruction,limit:config.contactsPerVersion??3}):[];
   row={id,fingerprint,opponent:c.opponent.name,caseId:c.id,side,originalWinner:v.winner,originalCycles:v.cycles,round:c.round,target,retention:v.contacts.retention,contacts:[],noOp:null};
   const options={built:trees[side]},enemy=opponents[c.opponent.index].w;
   const probe=(contact,extra)=>{const r=probeWrite(subjects[side],enemy,settings,c.round.plan,contact,{...options,...extra});if(r.applied){assert.equal(r.versions.reference.winner,v.winner);assert.equal(r.versions.reference.cycles,v.cycles);}return r;};
   if(contacts.length)row.noOp=probe(contacts[0],{noOp:true});
   for(const contact of contacts){const fields=contact.changedFields.filter(f=>['a','b'].includes(f)),sets=[fields,...fields.map(f=>[f])].filter((f,i,all)=>f.length&&all.findIndex(x=>JSON.stringify(x)===JSON.stringify(f))===i),probes=[];
    for(const subset of sets){const result=probe(contact,{fields:subset});probes.push({fields:subset,result,outcomeChanged:result.applied&&result.versions.intervention.winner!==v.winner,pointDelta:result.applied?points(result.versions.intervention.winner)-points(v.winner):null});}
    row.contacts.push({contact,probes});
   }
   write(filename,row);
  }
  results.push(row);console.log(JSON.stringify({id,contacts:row.contacts.length,changed:row.contacts.flatMap(c=>c.probes).filter(p=>p.outcomeChanged).length}));
 }
}
const probes=results.flatMap(r=>r.contacts.flatMap(c=>c.probes)),summary={schema:'writer-pointer-probes-v1',fingerprint,input:config.comparison,sourceHashes,selection:config,counts:{roundPairs:report.cases.length,versions:results.length,versionsWithContacts:results.filter(r=>r.contacts.length).length,contacts:results.reduce((n,r)=>n+r.contacts.length,0),probes:probes.length,applied:probes.filter(p=>p.result.applied).length,outcomeChanges:probes.filter(p=>p.outcomeChanged).length,noOpControls:results.filter(r=>r.noOp?.noOpParity).length,referenceParityChecks:probes.filter(p=>p.result.referenceParity).length+results.filter(r=>r.noOp?.referenceParity).length},cases:results.map(r=>({id:r.id,opponent:r.opponent,side:r.side,originalWinner:r.originalWinner,round:r.round.round,seed:r.round.seedBase,retention:r.retention,contacts:r.contacts.map(c=>({id:c.contact.id,cycle:c.contact.cycle,address:c.contact.address,use:c.contact.firstValueRead,probes:c.probes.map(p=>({fields:p.fields,applied:p.result.applied,winner:p.result.versions?.intervention.winner,cycles:p.result.versions?.intervention.cycles,outcomeChanged:p.outcomeChanged,pointDelta:p.pointDelta,firstAddressDivergence:p.result.divergence?.firstAddresses}))}))})),limits:['This is a bounded diagnostic sample from previously selected gains, regressions and a control, not a representative full-field test.','Contact retention was capped in the input. Missing contacts are unknown, not evidence of no pointer impact.','Restoration occurs after the writing instruction, retaining provenance and already-resolved effects. It is a host intervention, not a playable warrior.','Field restorations are separate interventions, not additive estimates of contribution. Outcome sensitivity does not establish a portable improvement.','Actor activity may execute foreign code and is censored at round end. Operand snapshots can include fields unused by an opcode; recorded pointer contacts establish which pointer field was read.']};
write('report.json',summary);const outcome=w=>w===0?'win':w===null?'tie':'loss';
write('report.md',`# Targeted writer pointer probes\n\n${JSON.stringify(summary.counts,null,2)}\n\n| Opponent / seed / round | Version | Contact cycle / cell | Restore fields | Outcome | Point change |\n|---|---|---|---|---|---:|\n${results.flatMap(r=>r.contacts.flatMap(c=>c.probes.map(p=>`| ${r.opponent} / ${r.round.seedBase} / ${r.round.round} | ${r.side} | ${c.contact.cycle} / ${c.contact.address} | ${p.fields.join('+')} | ${outcome(r.originalWinner)} → ${p.result.applied?outcome(p.result.versions.intervention.winner):'skipped'} | ${p.pointDelta??'—'} |`))).join('\n')}\n\n${summary.limits.map(l=>'- '+l).join('\n')}\n`);
console.log(JSON.stringify({complete:true,...summary.counts}));
