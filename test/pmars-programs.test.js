import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{createProgramGenerator}from'../scripts/pmars-programs.js';import{compareAssembly}from'../scripts/pmars-comparison.js';
const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/pmars-programs.json',import.meta.url),'utf8'));
for(const expected of golden)test('pMARS generated campaign remains seeded '+JSON.stringify(expected),()=>{
 const g=createProgramGenerator(expected);const programs=Array.from({length:200},()=>g.generated());assert.equal(createHash('sha256').update(programs.join('\0')).digest('hex'),expected.digest);
});
test('pMARS comparison retains acceptance, exclusions and mismatch categories',()=>{
 const a={ok:true,ins:['MOV','JMP'],start:0,out:''};
 const check=(x,y,result)=>assert.deepEqual(compareAssembly(x,y),result);
 check(a,{crash:'oops'},{kind:'crash'});check({...a,ins:[]},{ok:false},{kind:null,agreement:'skippedEmpty'});
 check(a,{ok:false},{kind:'we-reject'});check({ok:false},a,{kind:'we-accept'});check({ok:false},{ok:false},{kind:null,agreement:'rejected'});
 check(a,{...a,ins:['MOV']},{kind:'length'});check(a,{...a,ins:['DAT','JMP']},{kind:'instruction'});
 check(a,{...a,start:1},{kind:'start'});check({...a,start:3},a,{kind:null,agreement:'accepted'});
 check({...a,out:'outside of the program'},{...a,start:1},{kind:null,agreement:'accepted'});check(a,a,{kind:null,agreement:'accepted'});
});
