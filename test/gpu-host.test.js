import{test}from'node:test';import assert from'node:assert/strict';import{createGpuMatchPool}from'../src/engine/gpu/pool.js';import{compile}from'../src/engine/index.js';
const cfg={coreSize:80,maxLength:4,maxProcesses:8,maxCycles:20,rounds:1,minDistance:4};
function host({complete=true,shaderError=false,mapError=false}={}){
 const buffers=[],stats={pipelines:0,submissions:0,destroyed:0};
 const device={lost:new Promise(()=>{}),addEventListener(){},destroy(){},
  createShaderModule(){return{getCompilationInfo:async()=>({messages:shaderError?[{type:'error',lineNum:3,linePos:4,message:'bad shader'}]:[]})};},
  async createComputePipelineAsync(){stats.pipelines++;return{getBindGroupLayout(){return{};}};},
  createBuffer({size,usage}){const b={data:new ArrayBuffer(size),usage,mapAsync:async()=>{if(mapError)throw Error('readback failed');},getMappedRange(){return this.data;},unmap(){},destroy(){stats.destroyed++;}};buffers.push(b);return b;},
  createBindGroup(){return{};},queue:{writeBuffer(){},submit(){stats.submissions++;}},
  createCommandEncoder(){return{beginComputePass(){return{setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},
   copyBufferToBuffer(source,offset,target){const out=new Uint32Array(target.data);if(out.length===1)out[0]=complete?1:0;else out.set([2,3,1,1]);},finish(){return{};}};}
 };
 const gpu={requestAdapter:async()=>({info:{isFallbackAdapter:false},limits:{maxStorageBufferBindingSize:1e7,maxBufferSize:1e7},requestDevice:async()=>device})};
 return{gpu,buffers,stats};
}
const warrior=()=>{const w=compile('JMP 0','redcode',cfg);assert.ok(w.ok);return w;};
test('GPU host batches solo work, caches pipelines and destroys every buffer',async()=>{
 const h=host();const pool=await createGpuMatchPool({gpu:h.gpu});
 try{for(let i=0;i<2;i++){const result=await pool.measureSpecies(warrior(),cfg);assert.equal(result.processes,2);assert.equal(result.coverage,3);assert.equal(result.survives,true);}
 assert.equal(h.stats.pipelines,1);assert.equal(h.stats.destroyed,12);assert.equal(pool.stats.soloChecks,2);assert.equal(pool.stats.dispatches,16);
 }finally{pool.close();}await assert.rejects(pool.measureSpecies(warrior(),cfg),/closed/);
});
for(const [options,message,allocated]of [[{shaderError:true},/GPU shader 3:4: bad shader/,0],[{mapError:true},/readback failed/,6],[{complete:false},/instruction budget/,6]])test('GPU host failure cleanup '+JSON.stringify(options),async()=>{
 const h=host(options);const pool=await createGpuMatchPool({gpu:h.gpu});try{await assert.rejects(pool.measureSpecies(warrior(),cfg),message);assert.equal(h.stats.destroyed,allocated);assert.ok(pool.stats.dispatches<=16);}finally{pool.close();}
});
