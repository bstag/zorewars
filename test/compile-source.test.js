import{test}from'node:test';import assert from'node:assert/strict';import{compile}from'../src/engine/index.js';import{compileSource}from'../web/compile-source.js';
function dependencies(overrides={}){const calls=[];return{calls,compile,pythonReady:()=>false,loadPython:async()=>calls.push('load'),generateFromPython:async()=>{calls.push('generate');return 'JMP 0';},generating:(source,on)=>calls.push(on),getSettings:()=>({}),onPythonLoading:()=>calls.push('loading'),hung:false,...overrides};}
test('browser compilation preserves real Redcode and JavaScript generation',async()=>{
 for(const [language,source]of [['redcode','JMP 0'],['javascript',`name('Generator');jmp(0);`]]){const d=dependencies();const result=await compileSource(source,language,d);assert.ok(result.ok,JSON.stringify(result.errors));assert.deepEqual(d.calls,language==='redcode'?[]:[true,false]);}
});
test('Python download precedes the hang marker and compilation reads current settings',async()=>{
 let settings={coreSize:80};const d=dependencies({getSettings:()=>settings,loadPython:async()=>{d.calls.push('load');settings={coreSize:160};},compile:(text,language,s)=>{assert.equal(s.coreSize,160);return compile(text,language,s);}});
 assert.ok((await compileSource('python source','python',d)).ok);assert.deepEqual(d.calls,['loading','load',true,'generate',false]);
 const ready=dependencies({pythonReady:()=>true});assert.ok((await compileSource('source','python',ready)).ok);assert.deepEqual(ready.calls,['load',true,'generate',false]);
});
test('hung generators are skipped and exceptions clear active markers with bounded diagnostics',async()=>{
 const hung=dependencies({hung:true});const result=await compileSource('source','javascript',hung);assert.equal(result.ok,false);assert.match(result.errors[0].message,/didn't finish/);assert.deepEqual(hung.calls,[]);
 const failure=()=>{throw Error('one\ntwo\nthree\nfour');};
 for(const language of ['python','javascript','redcode']){const d=dependencies({generateFromPython:failure,compile:failure});const r=await compileSource('source',language,d);assert.equal(r.errors[0].message,'two\nthree\nfour');if(language!=='redcode')assert.equal(d.calls.at(-1),false);else assert.deepEqual(d.calls,[]);}
 const download=dependencies({loadPython:async()=>{throw 'download failed';}});assert.equal((await compileSource('x','python',download)).ok,false);assert.equal(download.calls.at(-1),false);
});

import{canStartEditedRound}from'../web/compile-source.js';
test('edits reset rounds only after boot and pending compiles finish',()=>{
 for(const booting of [false,true])for(const vm of [null,{steps:0,done:false},{steps:1,done:false},{steps:1,done:true}])for(const status of ['compiling','ok','error'])assert.equal(canStartEditedRound({booting,vm,slots:[{status}]}),!booting&&(!vm||vm.steps===0||vm.done)&&status!=='compiling');
});
