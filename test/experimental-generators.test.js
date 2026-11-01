import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import vm from'node:vm';import{createGenerator,generateFromJS}from'../src/engine/generator.js';import{compile,RULESETS}from'../src/engine/index.js';import{riptide}from'../tools/experimental-88.js';
const settings={...RULESETS['94x'],maxLength:200};
for(const file of ['examples/experimental-94x/lifeboat/lifeboat.js','examples/experimental-94x/lifeboat/lifeboat-ga-4247.js','examples/experimental-94x/compass/default.js'])test('experimental generator variants compile and preserve default output: '+file,()=>{
 const source=fs.readFileSync(file,'utf8'),fn=file.includes('compass')?'emitCompass':'emitAirbag';
 const run=options=>{const g=createGenerator(settings);const context=vm.createContext({...g.api,options});new vm.Script(source+'\nglobalThis.emitted='+fn+'({...P,...options});',{filename:path.resolve(file)}).runInContext(context,{timeout:2000});return{defaultCode:g.render(),variant:typeof context.emitted==='string'?context.emitted:context.emitted.source};};
 const original=generateFromJS(source,settings);assert.equal(run({}).defaultCode,original);
 const variants=file.includes('compass')?[{}, {BOOT:0,PHASE:0,DECOYS:0},{BOOT:1,PHASE:2,DECOY:2},{BOOT:0,PHASE:1,DECOY:0}]:[{}, {BOOT:0,PHASE:0},{BOOT:1,PHASE:2,BOMB:1,BACKWARD:1},{BOOT:0,PHASE:1,BOMB:0,BACKWARD:1}];
 for(const options of variants){const w=compile(run(options).variant,'redcode',settings);assert.ok(w.ok,JSON.stringify(w.errors));assert.ok(w.instructions.length>0&&w.instructions.length<=200);}
 assert.throws(()=>run({BOOT:-1}),/Invalid BOOT/);assert.throws(()=>run({unexpected:1}),/Unexpected/);
});
test('Riptide 88 architectures compile across documented scan and ending variants',()=>{
 for(const stun of [false,true])for(const adaptive of [false,true])for(const scan of [0,2])for(const ending of ['idle','pulse','sweep']){const source=riptide({offset:100,stun,adaptive,scan,ending});const w=compile(source,'redcode',{...RULESETS['88'],maxLength:100});assert.ok(w.ok,JSON.stringify(w.errors));assert.match(source,/DAT #0, #0/);}
 assert.throws(()=>riptide({offset:1,launch:true}),/single process/);
});
