import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,measureSpecies,DEFAULT_SETTINGS} from '../src/engine/index.js';
import {createMatchBackend} from '../src/engine/match-backend.js';
import {GpuBackendError} from '../src/engine/gpu/errors.js';
import {createPool} from '../tools/hill.js';
import {createCpuMatchPool} from '../web/cpu-matches.js';
import {createBrowserMatchPool} from '../web/matches.js';
const s={...DEFAULT_SETTINGS,coreSize:80,maxLength:5,minDistance:5,maxCycles:300,maxProcesses:8};
const w=compile('SPL 0\nMOV.I 0, 1','redcode',s);
test('CPU pool and yielding browser solo checks retain exact measurements',async()=>{
 const cpu=createPool(1),browser=createCpuMatchPool();
 try {assert.deepEqual(await cpu.measureSpecies(w,s),measureSpecies(w,s));assert.deepEqual(await browser.measureSpecies(w,s),measureSpecies(w,s));}
 finally{cpu.close();browser.close();}
 await assert.rejects(cpu.measureSpecies(w,s),/closed/);
});
test('concurrent GPU solo failures retry all checks through one CPU fallback',async()=>{
 let created=0,closed=0;
 const received=[];
 const pool=await createMatchBackend({createGpu:async()=>({backend:'gpu',measureSpecies:async()=>{throw new GpuBackendError('solo device lost');},close(){closed++;}}),
 createCpu:()=>{created++;return{backend:'cpu',measureSpecies:async(warrior,settings)=>{received.push(warrior);return measureSpecies(warrior,settings);},close(){}};}});
 try {const actual=await Promise.all([w,w,w].map(w=>pool.measureSpecies(w,s)));assert.deepEqual(actual,[measureSpecies(w,s),measureSpecies(w,s),measureSpecies(w,s)]);assert.equal(created,1);assert.equal(closed,1);assert.equal(received.length,3);assert.equal(pool.backend,'cpu');}
 finally{pool.close();}
});
test('explicit GPU solo failures and malformed inputs remain errors',async()=>{
 const options={createGpu:async()=>({backend:'gpu',measureSpecies:async()=>{throw new GpuBackendError('lost');},close(){}}),createCpu:()=>{throw Error('must not start CPU');}};
 const strict=await createMatchBackend({...options,backend:'gpu'});
 try{await assert.rejects(strict.measureSpecies(w,s),/lost/);}finally{strict.close();}
 const invalid=await createMatchBackend({...options,createGpu:async()=>({backend:'gpu',measureSpecies:async()=>{throw Error('invalid warrior');},close(){}})});
 try{await assert.rejects(invalid.measureSpecies({},s),/invalid warrior/);}finally{invalid.close();}
});
test('missing WebGPU and workers still allow browser CPU solo checks',async()=>{
 const pool=await createBrowserMatchPool({createWorker:()=>{throw Error('blocked');}});
 try{assert.deepEqual(await pool.measureSpecies(w,s),measureSpecies(w,s));assert.equal(pool.backend,'cpu');}finally{pool.close();}
});
test('cancelling yielding CPU solo checks publishes no measurement',async()=>{
 let cancelled=false;
 const pool=createCpuMatchPool({cancelled:()=>cancelled,yieldControl:async()=>{cancelled=true;}});
 try{await assert.rejects(pool.measureSpecies(w,{...s,maxCycles:1000000}),{name:'AbortError'});assert.equal(pool.stats.soloChecks,0);}finally{pool.close();}
});
