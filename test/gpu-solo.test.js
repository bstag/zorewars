import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile,DEFAULT_SETTINGS,measureSpecies,mulberry32} from '../src/engine/index.js';
import {RULESETS} from '../src/engine/constants.js';
import {createGpuPool} from '../tools/gpu.js';
import {createPool,strip} from '../tools/hill.js';
import {evolve} from '../tools/evolve.js';
import {randomGenome,toWarrior} from '../tools/genes.js';
const enabled=process.env.ZOREWARS_GPU_TEST==='1';
const cfg={...DEFAULT_SETTINGS,coreSize:80,maxLength:6,minDistance:6,maxCycles:350,maxProcesses:8};
const warrior=(source,s=cfg)=>{const w=compile(source,'redcode',s);assert.ok(w.ok,JSON.stringify(w.errors));return strip(w);};
test('GPU solo batches reproduce complete CPU species measurements', {skip:!enabled}, async(t)=>{
 const gpu=await createGpuPool({batchSize:256});
 const verify=async(tasks)=>{
  const before={...gpu.stats};
  const actual=await Promise.all(tasks.map(({w,s})=>gpu.measureSpecies(w,s)));
  tasks.forEach(({w,s},i)=>assert.deepEqual(actual[i],measureSpecies(w,s),w.name+' '+JSON.stringify(s)));
  assert.equal(gpu.stats.soloChecks-before.soloChecks,tasks.length);
 };
 try {
  await t.test('death, queue saturation, P-space, zero budget and external entries',async()=>{
   const sources=['DAT 0, 0','MOV.I 0, 1','SPL 0\nJMP -1','DIV.F #0, 0','MOD.X #0, 0','STP.AB #7, #1\nLDP.AB #1, 1\nJMP -2','ORG 17\nMOV.I 0, 1','MOV.I }0, >0'];
   await verify([0,1,350].flatMap(maxCycles=>sources.map(source=>({w:warrior(source),s:{...cfg,maxCycles}}))));
   const shared=sources.map(source=>({w:warrior(source),s:cfg})); const batches=gpu.stats.soloBatches;
   await verify(shared); assert.equal(gpu.stats.soloBatches-batches,1);
  });
  await t.test('random self-modifying programs on rings, planes, and volumes',async()=>{
   const random=mulberry32(1088);
   for(const shape of [{},{topology:'torus',sizeX:10,sizeY:8,sizeZ:1},{topology:'torus',sizeX:10,sizeY:4,sizeZ:2},{topology:'torus',sizeX:10,sizeY:1,sizeZ:8}]) {
    const s={...cfg,...shape,maxLength:5};
    const tasks=Array.from({length:100},(_,i)=>{const g=randomGenome(5,{coreSize:80,random});if(shape.topology)g.code[i%5].op='TRN';return {w:toWarrior(g,'Random '+i,80),s};});
    await verify(tasks);
   }
  });
  await t.test('real library warriors under full rule limits, including 94x and P-space',async()=>{
   for(const [rules,files] of [['88',['88/scout-88.red','88/impring-88.red']],['94nop',['silk.red','seeker.red']],['lp',['silk.red','stoneimp.red']],['94x',['silk.red','seeker.red']],['94x-hill',['chameleon.js','bandit.js']]]) {
    const s={...DEFAULT_SETTINGS,...RULESETS[rules]};
    const tasks=files.map(file=>{const w=compile(fs.readFileSync(new URL('../warriors/'+file,import.meta.url),'utf8'),file.endsWith('.js')?'javascript':'redcode',s);assert.ok(w.ok,JSON.stringify(w.errors));return {w:strip(w),s};});
    await verify(tasks);
   }
   for(const [sizeX,sizeY,sizeZ] of [[40,20,10],[80,10,10]]) {
    const s={...DEFAULT_SETTINGS,topology:'torus',sizeX,sizeY,sizeZ,coreSize:8000,maxCycles:10000};
    const files=['volumesilk.js','backdraft.js','volumequeen.js','scatter.js'];
    await verify(files.map(file=>({w:strip(compile(fs.readFileSync(new URL('../warriors/volume/'+file,import.meta.url),'utf8'),'javascript',s)),s})));
   }
  });
  await t.test('full seeded searches preserve caches, lineage and operator credit',async()=>{
   const cpu=createPool(1);
   try {
    const s={...cfg,maxCycles:200,pSpace:false};
    const sources=['MOV.I 0, 1','ADD.AB #4, 3\nMOV.I 2, @2\nJMP -2\nDAT 0, 0'].map(source=>({w:warrior(source,s),role:'stone'}));
    const opponents=sources.map(({w})=>({name:w.name,group:'test',w}));
    for(const variant of [{algorithm:'ga'},{algorithm:'map-elites'},
     {algorithm:'ga',selection:'lexicase',localSteps:2},
     {algorithm:'map-elites',selection:'lexicase',descriptor:'outcomes',archiveSize:8,localSteps:2}]) for(const objective of ['smooth','pushoff']) {
     const options={sources,opponents,settings:s,seed:1088,...variant,objective,rounds:2,batches:2,batchSize:6,evalRounds:2,fieldRounds:3,maxLength:6,populationSize:5,partners:objective==='pushoff'?[sources[0].w]:[]};
     assert.deepEqual(await evolve({...options,pool:gpu}),await evolve({...options,pool:cpu}),JSON.stringify(variant)+' '+objective);
    }
    for(const shape of [{},{topology:'torus',sizeX:10,sizeY:8,sizeZ:1},{dialect:'88'}]) {
     const options={sources:[],opponents:[],settings:{...s,...shape,maxLength:5},seed:444,scratch:true,rounds:1,batches:1,batchSize:4,evalRounds:1,maxLength:5};
     assert.deepEqual(await evolve({...options,pool:gpu}),await evolve({...options,pool:cpu}),'scratch '+JSON.stringify(shape));
    }
   } finally {cpu.close();}
  });
 } finally {gpu.close();}
});
