import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';import{treeCommandOptions}from'../cli/tree-evolution.js';import{blockCommandOptions}from'../cli/block-devtools.js';import{prepareInstructionField}from'../cli/evolution.js';import{treeSettings,recipes}from'../tools/algebra/index.js';import{compile,DEFAULT_SETTINGS}from'../src/engine/index.js';
const h={usage(message){throw Error(message);},expandRefs:xs=>xs,loadAll:async()=>[compile(';name Extra\nJMP 0')]};
test('tree CLI resolves defaults, tuning seeds and invalid option combinations',()=>{
 const deps={treeSettings,recipes};const defaults=treeCommandOptions({},h,deps);assert.ok(defaults.starts.length);assert.equal(defaults.generations,10);assert.equal(defaults.lexicase,true);
 const opts=treeCommandOptions({aim:'off',select:'tournament',torus:'100x80',length:'20',ties:'0',out:'chosen'},h,deps);assert.equal(opts.aim,false);assert.equal(opts.lexicase,false);assert.equal(opts.starts.length,0);assert.equal(opts.out,'chosen');
 for(const f of [{generations:'0'},{seed:'-1'},{ties:'2'},{select:'unknown'},{'lex-epsilon':'NaN'},{'lex-epsilon':'-1'},{tune:true},{ladder:'2'}])assert.throws(()=>treeCommandOptions(f,h,deps));
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zw-tree-options-'));try{const file=path.join(folder,'tree.json');fs.writeFileSync(file,JSON.stringify(defaults.starts[0]));const tuned=treeCommandOptions({tune:true,start:file},h,deps);assert.deepEqual(tuned.ops,['tune']);assert.equal(tuned.starts.length,1);fs.writeFileSync(file,'[]');assert.throws(()=>treeCommandOptions({tune:true,start:file},h,deps),/nonempty/);}finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('block CLI enforces supported profiles, counts, families and objectives',()=>{
 const base={population:'100'};const d=blockCommandOptions(base,h);assert.equal(d.rules,'94x');assert.ok(d.families.length);const family=d.families[0];
 assert.deepEqual(blockCommandOptions({...base,families:family},h).families,[family]);
 for(const f of [{unknown:true},{algorithm:'map-elites'},{selection:'unknown'},{rules:'unknown'},{length:'10000'},{generations:'0'},{seed:'2147483647'},{objective:'unknown'},{objective:'pushoff'},{partner:'x'},{ties:'2'},{families:'unknown'},{families:family+','+family},{population:'1',families:d.families.join(',')}])assert.throws(()=>blockCommandOptions({...base,...f},h));
 assert.equal(blockCommandOptions({...base,objective:'pushoff',hill:'local',partner:'x',selection:'lexicase',algorithm:'ga'},h).objective,'pushoff');
});
test('instruction CLI separates field, gene sources, kings and scratch held-out inputs',async()=>{
 const normal=await prepareInstructionField({flags:{},_:[]},h,DEFAULT_SETTINGS,{json:true,scratch:false,objective:'smooth'});assert.ok(normal.field.length);assert.ok(normal.sources.length);assert.equal(normal.heldOut.length,0);
 const scratch=await prepareInstructionField({flags:{},_:[]},h,DEFAULT_SETTINGS,{json:true,scratch:true,objective:'smooth'});assert.equal(scratch.field.length,0);assert.equal(scratch.sources.length,0);assert.ok(scratch.heldOut.length);
 const entries=await prepareInstructionField({flags:{king:'x',partner:'y'},_:['extra']},h,DEFAULT_SETTINGS,{json:true,scratch:false,objective:'pushoff'});assert.equal(entries.kings.length,1);assert.equal(entries.partners.length,1);assert.equal(entries.sources.length,normal.sources.length+2);
 await assert.rejects(prepareInstructionField({flags:{partner:'x'},_:[]},h,DEFAULT_SETTINGS,{json:true,scratch:false,objective:'smooth'}),/needs --objective/);
});

import{printTreeResults}from'../cli/tree-evolution.js';
test('tree human reporting retains placements, aimed experiments and counter summaries',()=>{
 const lines=[];let saved=0;const counters={file:'counter.json',save(){saved++;},summary:()=>['paper: +1']};const r={stats:{built:3,refused:1,scored:2,battleRounds:20,aimed:2,experiments:4}};const best={shape:'stone',size:3,species:'bomber',placement:{score:2,place:1,of:2,table:[{score:2,ours:true},{score:1,name:'Other'}]}};
 printTreeResults(r,[best],best,counters,'output',line=>lines.push(line));assert.ok(lines.some(x=>x.includes('2 mutations aimed')));assert.ok(lines.some(x=>x.includes('>> stone')));assert.ok(lines.some(x=>x.includes('Other')));assert.ok(lines.some(x=>x.includes('paper: +1')));assert.equal(saved,1);
 const minimal=[];printTreeResults({stats:{built:0,refused:0,scored:0,battleRounds:0}},[],null,{...counters,summary:()=>[]},'out',x=>minimal.push(x));assert.equal(minimal.length,2);
});
