import{test}from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import fs from'node:fs';import os from'node:os';import path from'node:path';import{evolutionOptions}from'../cli/evolution-options.js';
const h={usage(message){throw Error(message);}};const options=flags=>evolutionOptions({flags},h,{maxLength:100});
test('evolution CLI options preserve defaults, bounds and policy validation',()=>{
 const d=options({});assert.equal(d.generations,6);assert.equal(d.batchSize,40);assert.equal(d.seed,1);assert.equal(d.epsilon,'auto');assert.equal(d.maxLength,40);
 const custom=options({seed:'0',epsilon:'0.1',genome:'200',rounds:'2'});assert.equal(custom.seed,0);assert.equal(custom.epsilon,0.1);assert.equal(custom.maxLength,100);assert.equal(custom.evalRounds,2);
 for(const key of ['generations','batches','batch','eval-rounds','population','archive-size','check-rounds','finalists','field-rounds','exploit-age','genome'])for(const value of ['0','1.5','NaN'])assert.throws(()=>options({[key]:value}),/integer/);
 for(const flags of [{seed:'2147483647'},{'exploit-win':'NaN'},{objective:'pushoff',scratch:true},{algorithm:'unknown'},{selection:'unknown'},{descriptor:'unknown'},{ties:'2'},{epsilon:'-1'}])assert.throws(()=>options(flags));
 assert.equal(options({epsilon:'auto'}).epsilon,'auto');
});
const cli=(...args)=>execFileSync(process.execPath,['cli/zorewars.js',...args],{encoding:'utf8'});
test('battle CLI retains solo, tie and report text plus JSON output',()=>{
 const common=['--rules','94nop','--cycles','20','--rounds','1'];
 assert.match(cli('battle','@imp',...common),/round\s+1: survived/);
 assert.match(cli('battle','@imp','@imp',...common),/tie/);
 assert.match(cli('battle','@imp','@dwarf',...common,'--report'),/Post-mortem of round 1/);
 assert.equal(JSON.parse(cli('battle','@imp','@imp',...common,'--json')).ok,true);
});
test('conversion CLI writes the same verified code that JSON reports',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zorewars-conversion-'));const out=path.join(folder,'warrior.js');
 try{const result=JSON.parse(cli('convert','@dwarf','--to','js','--json','--out',out));assert.ok(result.ok&&result.verified);assert.equal(fs.readFileSync(out,'utf8'),result.code);assert.equal(cli('convert','@dwarf','--to','js'),result.code);}finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('compile/check CLI retain JSON, listing and compile-error output',()=>{
 const run=(args,input)=>execFileSync(process.execPath,['cli/zorewars.js',...args],{encoding:'utf8',input,stdio:['pipe','pipe','pipe']});
 assert.match(run(['compile','@imp']),/MOV/);assert.match(run(['check','@imp']),/OK/);
 const compiled=JSON.parse(run(['compile','@imp','--json']));assert.ok(compiled.ok);assert.ok(compiled.instructions.length);assert.ok(compiled.redcode);
 const checked=JSON.parse(run(['check','@imp','--json']));assert.ok(checked.ok);assert.equal(checked.instructions,undefined);
 for(const json of [false,true]){let error;try{run(['check','-',...(json?['--json']:[])],'BOGUS 0, 0');}catch(e){error=e;}assert.equal(error.status,1);if(json)assert.equal(JSON.parse(error.stdout).ok,false);else assert.match(error.stderr,/failed to compile/);}
});
test('trace CLI retains instruction history and death diagnostics',()=>{
 const run=(args,input)=>execFileSync(process.execPath,['cli/zorewars.js',...args],{encoding:'utf8',input,stdio:['pipe','pipe','pipe']});
 const json=JSON.parse(run(['trace','-','--json','--cycles','20'],'DAT 0, 0'));assert.ok(json.ok);assert.ok(json.trace.length);assert.equal(json.trace.at(-1).died,'ownCode');
 const plain=run(['trace','-','--cycles','20'],'DAT 0, 0');assert.match(plain,/ran its own DAT/);assert.match(plain,/Round 1/);
 assert.match(run(['trace','-','--cycles','20'],'DIV #0, 0'),/division by zero/);
});
