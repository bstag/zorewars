import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';import{difference}from'../scripts/replay-difference.js';import{createArchiveCache}from'../scripts/archive-cache.js';import{loadComparisonWarriors}from'../scripts/pmars-inputs.js';import{createProgramGenerator}from'../scripts/pmars-programs.js';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'zw-quality-'));const hash=x=>createHash('sha256').update(x).digest('hex');
test('replay difference retains first-path, keys and primitive diagnostics',()=>{
 assert.equal(difference({a:[1,null]},{a:[1,null]}),null);assert.deepEqual(difference({a:2},{a:3}),{path:'/a',actual:2,expected:3});assert.equal(difference(null,{}).path,'');assert.ok(difference([],{}).actualType);assert.deepEqual(difference({a:1},{b:1}).actualKeys,['a']);
});
test('archive cache validates origins, receipts, retries and downloaded bytes offline',async()=>{
 const root=temp(),cache=path.join(root,'archive'),receipts={};fs.mkdirSync(path.join(cache,'files'),{recursive:true});const base='https://example.test/history/';let calls=0;
 const response=(url,text,ok=true)=>({url,ok,status:ok?200:500,arrayBuffer:async()=>Buffer.from(text)});
 try{const context={root,cache,base,receipts,download:true,retrievedAt:()=> 'fixed',fetchSource:async url=>{calls++;return response(url,'JMP 0');}};const {obtain}=createArchiveCache(context);assert.equal(String(await obtain(base+'a.txt')),'JMP 0');assert.equal(receipts[base+'a.txt'].retrievedAt,'fixed');assert.equal(String(await obtain(base+'a.txt')),'JMP 0');assert.equal(calls,1);
 await assert.rejects(obtain('https://other.test/a.txt'),/Outside archive/);const file=path.join(root,receipts[base+'a.txt'].cache);fs.writeFileSync(file,'tampered');await assert.rejects(obtain(base+'a.txt'),/Cached file changed/);
 receipts[base+'escape']={status:'downloaded',cache:'outside',sha256:hash('')};await assert.rejects(obtain(base+'escape'),/outside archive/);
 assert.equal(await createArchiveCache({...context,download:false}).obtain(base+'missing'),null);
 for(const [name,text,url]of [['html','<html>bad',base+'b.txt'],['large','x'.repeat(2*1024*1024+1),base+'large.txt'],['redirect','data','https://other.test/file']]){let tries=0;const key=base+name+'.txt';const c=createArchiveCache({...context,fetchSource:async()=>{tries++;return response(url,text);}});assert.equal(await c.obtain(key),null);assert.equal(tries,3);assert.equal(receipts[key].status,'fetch-failed');}
 const failed=createArchiveCache({...context,fetchSource:async url=>response(url,'',false)});assert.equal(await failed.obtain(base+'status.txt'),null);assert.match(receipts[base+'status.txt'].error,/HTTP 500/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('pMARS comparison loads only classic inputs and Redcode fixtures',async()=>{
 const root=temp(),work=path.join(root,'work');for(const dir of ['warriors','test/fixtures','work'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 try{const lib=[{file:'a.red',language:'redcode'},{file:'b.js',language:'javascript'},{file:'c.py',language:'python'},{file:'converted.red',convertedFrom:'a.red'},{file:'plane.js',battlefield:'torus:10x8'}];fs.writeFileSync(path.join(root,'warriors/index.json'),JSON.stringify(lib));fs.writeFileSync(path.join(root,'warriors/a.red'),'JMP 0');fs.writeFileSync(path.join(root,'warriors/b.js'),'jmp(0);');fs.writeFileSync(path.join(root,'test/fixtures/a.red'),'DAT 0,0');fs.writeFileSync(path.join(root,'test/fixtures/helper.js'),'not redcode');fs.writeFileSync(path.join(root,'test/fixtures/data.json'),'{}');fs.writeFileSync(path.join(root,'warriors/encyclopedia.json'),JSON.stringify({hallOfFame:[{url:'https://x/Frontwards.red'},{url:'https://x/good.red',name:'Good'},{url:'https://x/fail.red',name:'Fail'}]}));const warnings=[];const rows=await loadComparisonWarriors({root,work,warn:x=>warnings.push(x),fetchWarriorText:async url=>{if(url.includes('fail'))throw Error('offline');return{text:'JMP 0'};}});assert.deepEqual(rows.map(r=>r.id),['a.red','b.js','a.red','Good']);assert.ok(rows[2].fixture);assert.equal(warnings.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('mutation campaigns preserve mixed seeded generation streams',()=>{
 const {seeds,golden}=JSON.parse(fs.readFileSync(new URL('./fixtures/pmars-mutations.json',import.meta.url),'utf8'));for(const expected of golden){const g=createProgramGenerator({seed:expected.seed,coreSize:8000,rules:'94'});const output=Array.from({length:300},(_,i)=>i%2?g.mutated(seeds):g.generated());assert.equal(hash(output.join('\0')),expected.digest);}
});
