#!/usr/bin/env node
// Compare a saved CPU round robin with the shared strict-GPU runner.
// Programs, effective settings, seed and roster order must be pinned by the
// manifest; legacy round-robin saves do not contain all of those inputs.
// node scripts/check-roundrobin-gpu.js --manifest manifest.json --out results
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createGpuPool} from '../tools/gpu.js';
import {roundRobin} from '../tools/pushoff.js';
import {pushOff} from '../src/engine/pushoff.js';
const args=process.argv.slice(2);
const option=key=>{const i=args.indexOf(key);if(i<0||!args[i+1])throw Error(key+' is required');return args[i+1];};
const manifestFile=path.resolve(option('--manifest')),out=path.resolve(option('--out'));
const manifestText=fs.readFileSync(manifestFile,'utf8'),m=JSON.parse(manifestText);
const baselineText=fs.readFileSync(m.fixture,'utf8'),baseline=JSON.parse(baselineText);
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
assert.equal(sha(baselineText),m.fixtureHash,'Saved CPU matrix changed');
assert.ok(Number.isSafeInteger(m.seed)&&m.seed>=0,'Original seed is required');
assert.equal(m.seedProtocol,'row seed+i; opponent seed+7*(j-i), self fights included');
assert.equal(m.self,true);assert.equal(m.rounds,baseline.rounds);
assert.ok(Number.isSafeInteger(m.settings.minDistance)&&m.settings.minDistance>0,'Effective separation is required');
assert.equal(typeof m.settings.pSpace,'boolean','Effective P-space policy is required');
const n=m.programs.length,programs=m.programs.map(p=>p.w);
assert.equal(n,baseline.warriors.length);assert.equal(baseline.results.length,n);
const norm=v=>((v%m.settings.coreSize)+m.settings.coreSize)%m.settings.coreSize;
const canonical=w=>({start:norm(w.start),instructions:w.instructions.map(({op,mod,aMode,a,bMode,b})=>({op,mod,aMode,a:norm(a),bMode,b:norm(b)}))});
m.programs.forEach((p,i)=>{assert.equal(p.w.name,baseline.warriors[i].name);assert.equal(p.entry,baseline.warriors[i].entry);assert.equal(sha(canonical(p.w)),p.programHash);});
const pairs=[];
for(let i=0;i<n;i++){
 assert.equal(baseline.results[i].length,n);
 for(let j=i;j<n;j++){
  const expected=baseline.results[i][j];
  assert.ok(expected&&['w','l','t'].every(k=>Number.isInteger(expected[k])&&expected[k]>=0));
  assert.equal(expected.w+expected.l+expected.t,m.rounds);assert.equal(expected.rounds,m.rounds);
  if(i!==j)assert.deepEqual(baseline.results[j][i],{w:expected.l,l:expected.w,t:expected.t,rounds:m.rounds});
  pairs.push({i,j,seed:m.seed+i+7*(j-i),expected});
 }
}
if(fs.existsSync(path.join(out,'parity-report.json')))throw Error('Use a new output directory');
fs.mkdirSync(out,{recursive:true});
const root=fileURLToPath(new URL('../',import.meta.url));
const files=['tools/pushoff.js','tools/hill.js','tools/gpu.js','src/engine/gpu/pool.js','src/engine/gpu/kernel.js','src/engine/match.js','src/engine/random.js','src/engine/constants.js','src/engine/geometry.js','src/engine/topology.js','src/engine/vm.js','src/engine/battle.js','src/engine/pushoff.js'];
const engineHashes=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const started=performance.now();
const report={status:'running',startedAt:new Date().toISOString(),manifest:manifestFile,manifestHash:sha(manifestText),baseline:m.fixture,baselineHash:m.fixtureHash,bracket:m.bracket,backend:'gpu',strictGpu:true,seed:m.seed,settings:m.settings,coverage:m.coverage,engineHashes,scheduledPairs:0,checkedPairs:0,completedRows:0,checks:[],mismatches:[]};
const reportFile=path.join(out,'parity-report.json');
// Updating in place avoids Windows rename locks from concurrent file watchers.
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,1));save();
let gpu;
const update=()=>{report.elapsedSeconds=(performance.now()-started)/1000;if(gpu)report.execution=structuredClone(gpu.stats);save();};
const heartbeat=setInterval(()=>{update();console.error(m.bracket+': '+report.checkedPairs+'/'+pairs.length+' pairs checked, '+report.mismatches.length+' mismatches, '+report.elapsedSeconds.toFixed(1)+' seconds');},30000);heartbeat.unref();
try{
 gpu=await createGpuPool({batchSize:m.batchSize});assert.equal(gpu.backend,'gpu');
 const checked={backend:'gpu',match(task){
  const p=pairs[report.scheduledPairs++];assert.ok(p,'Unexpected extra match');
  assert.equal(task.seed,p.seed,'Pair seed changed');assert.deepEqual(task.settings,{...m.settings,rounds:m.rounds});
  assert.equal(sha(canonical(task.a)),m.programs[p.i].programHash);assert.equal(sha(canonical(task.b)),m.programs[p.j].programHash);
  return gpu.match(task).then(result=>{
   const actual={w:result.w,l:result.l,t:result.t,rounds:m.rounds};
   const matches=['w','l','t','rounds'].every(key=>Object.is(actual[key],p.expected[key]));
   const check={...p,actual,matches};report.checks.push(check);report.checkedPairs++;
   if(!matches)report.mismatches.push(check);
   if(report.checkedPairs%128===0||!matches)update();
   return result;
  });
 }};
 console.error('Checking '+m.bracket+': '+n+' pinned warriors, '+pairs.length+' pairs, '+m.rounds+' rounds per pair');
 const actual=await roundRobin(checked,programs,{settings:m.settings,rounds:m.rounds,seed:m.seed,self:true,onProgress:()=>{report.completedRows++;}});
 update();assert.equal(report.scheduledPairs,pairs.length);assert.equal(report.checkedPairs,pairs.length);
 fs.writeFileSync(path.join(out,'gpu.json'),JSON.stringify({rounds:m.rounds,settings:baseline.settings,warriors:baseline.warriors,...actual},null,1));
 assert.equal(report.mismatches.length,0,JSON.stringify(report.mismatches.slice(0,3)));
 assert.deepEqual(actual.results,baseline.results);assert.deepEqual(actual.scores,baseline.scores);
 const rankingFile=m.fixture.replace(/\.json$/,'.out');
 if(fs.existsSync(rankingFile)){
  const old=JSON.parse(fs.readFileSync(rankingFile,'utf8'));
  const ranked=pushOff(actual.scores,baseline.warriors.map(w=>w.name),{...old.variant,results:actual.results}).map(({index,...r})=>({...r,entry:baseline.warriors[index].entry}));
  assert.deepEqual(ranked,old.ranking);report.savedRankingMatches=true;report.savedRankingHash=sha(fs.readFileSync(rankingFile));
 }
 assert.equal(sha(fs.readFileSync(m.fixture)),m.fixtureHash,'CPU reference changed during replay');
 for(const [file,hash] of Object.entries(engineHashes))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'Engine changed during replay');
 report.status='passed';report.allPairCountsMatch=true;report.allScoresMatch=true;report.finishedAt=new Date().toISOString();update();
 console.log(JSON.stringify({status:report.status,bracket:m.bracket,pairs:report.checkedPairs,rounds:report.execution.rounds,mismatches:report.mismatches.length,savedRankingMatches:report.savedRankingMatches,seconds:report.elapsedSeconds,execution:report.execution,report:reportFile},null,2));
}catch(error){report.status='failed';report.error=error.message;update();throw error;}
finally{clearInterval(heartbeat);gpu?.close();}
