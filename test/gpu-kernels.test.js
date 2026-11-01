import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{gpuKernel}from'../src/engine/gpu/kernel.js';import{soloKernel}from'../src/engine/gpu/solo-kernel.js';import{liveKernel}from'../src/engine/gpu/live-kernel.js';
const cases=JSON.parse(fs.readFileSync(new URL('./fixtures/gpu-kernels.json',import.meta.url),'utf8'));
for(const {s,mode,layout,digest}of cases)test('GPU shader generation '+mode+'/'+(s.topology??'ring'),()=>{
 const code=mode==='match'?gpuKernel(s,10000,2048):mode==='solo'?soloKernel(s,10000,2048):liveKernel(s,layout);
 assert.equal(createHash('sha256').update(code).digest('hex'),digest);
 assert.ok(code.includes('const N = 80u;'));assert.ok(code.includes('const STRIDE = 10000u;'));
 assert.ok(!code.includes('undefined'));assert.ok(!code.includes('NaN'));
 const count=mode==='solo'?1:mode.startsWith('live')?layout.count:2;
 assert.ok(code.includes('heads: array<u32, '+count+'>;'));
 assert.ok(code.includes('const TORUS = '+(s.topology==='torus')+';'));
 assert.ok(code.includes('const DIMS = vec3<i32>('+(s.sizeX??80)+', '+(s.sizeY??1)+', '+(s.sizeZ??1)+');'));
});
