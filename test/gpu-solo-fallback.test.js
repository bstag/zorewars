import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,measureSpecies,DEFAULT_SETTINGS} from '../src/engine/index.js';
import {createGpuPool} from '../tools/gpu.js';
import {createPool} from '../tools/hill.js';
import {createMatchBackend} from '../src/engine/match-backend.js';
const enabled=process.env.ZOREWARS_GPU_TEST==='1';
test('real unsupported GPU solo limits fall back to the CPU interpreter',{skip:!enabled},async()=>{
 const s={...DEFAULT_SETTINGS,coreSize:80,maxLength:5,minDistance:5,maxProcesses:8,maxCycles:10000001};
 const w=compile('DAT 0, 0','redcode',s);
 const options={createGpu:()=>createGpuPool(),createCpu:()=>createPool(1)};
 for (let repeat = 0; repeat < 4; repeat++) {
 const pool=await createMatchBackend({...options,backend:'auto'});
 try{assert.deepEqual(await pool.measureSpecies(w,s),measureSpecies(w,s));assert.equal(pool.backend,'cpu');assert.match(pool.stats.fallbackReason,/up to|supports/);}finally{pool.close();}
 const strict=await createMatchBackend({...options,backend:'gpu'});
 try{await assert.rejects(strict.measureSpecies(w,s),/up to|supports/);}finally{strict.close();}
 }
});

test('closing an active native solo batch leaves later GPU pools usable',{skip:!enabled},async()=>{
 const s={...DEFAULT_SETTINGS,coreSize:80,maxLength:5,minDistance:5,maxProcesses:8,maxCycles:500000};
 const w=compile('MOV.I 0, 1','redcode',s);
 for(let repeat=0;repeat<3;repeat++) {
  const pool=await createGpuPool();
  const rejected=assert.rejects(pool.measureSpecies(w,s),/closed|destroy|lost|device|GPU/i);
  await new Promise(resolve=>setImmediate(resolve));
  pool.close(); await rejected;
  const next=await createGpuPool();
  try{const dead=compile('DAT 0, 0','redcode',s);assert.deepEqual(await next.measureSpecies(dead,s),measureSpecies(dead,s));}finally{next.close();}
 }
});
