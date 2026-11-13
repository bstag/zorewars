#!/usr/bin/env node
// Compare semantic replay results, allowing different config paths/fingerprints.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [left,right]=process.argv.slice(2);
if(!left||!right){console.error('usage: node scripts/verify-warrior-comparison.js first-output frozen-replay-output');process.exit(2);}
const read=(dir,file)=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
const a=read(left,'report.json'),b=read(right,'report.json');
assert.equal(a.schema,b.schema);assert.deepEqual(a.field,b.field);assert.deepEqual(a.selection,b.selection);
assert.equal(read(left,'manifest.json').implementation,read(right,'manifest.json').implementation);
assert.equal(a.cases.length,b.cases.length);
for(let i=0;i<a.cases.length;i++){
 const x=read(left,'cases/'+a.cases[i].id+'.json'),y=read(right,'cases/'+b.cases[i].id+'.json');
 for(const key of ['id','opponent','round','trace','controls'])assert.deepEqual(x[key],y[key],`${x.id}: ${key}`);
}
for(const opponent of a.selection)assert.deepEqual(read(left,'matches/'+opponent.index+'.json'),read(right,'matches/'+opponent.index+'.json'));
const verification={complete:true,sameImplementation:true,fieldAndSelectionIdentical:true,allPlansTracesAndControlsIdentical:true,opponents:a.selection.length,cases:a.cases.length,fullStateChecksBothRuns:a.cases.length*4,originalFingerprint:a.fingerprint,reproducedFingerprint:b.fingerprint};
fs.writeFileSync(path.join(right,'reproduction-verification.json'),JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification,null,2));
