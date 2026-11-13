import{test}from'node:test';import assert from'node:assert/strict';import{VM,compile}from'../src/engine/index.js';import{createGpuLiveEngine}from'../src/engine/gpu/live.js';import{encodeLiveVM}from'../src/engine/gpu/live-layout.js';
const cfg={coreSize:80,maxLength:4,minDistance:4,maxProcesses:8,maxCycles:100};
function vm(rounds=1){const v=new VM({...cfg,rounds});const w=compile('JMP 0','redcode',cfg);v.load([w,w],{positions:[0,40]});return v;}
// CPU-produced snapshots emulate device responses; this tests the host, not WGSL execution.
function host(options={}){
 const cpu=vm(),buffers=[],stats={destroyed:0,pipelines:0};let controls,release;
 const device={limits:{maxStorageBufferBindingSize:options.limit??1e7},lost:new Promise(()=>{}),addEventListener(){},destroy(){},
  createShaderModule(){return{getCompilationInfo:async()=>({messages:options.shaderError?[{type:'error',lineNum:2,message:'bad'}]:[]})};},
  async createComputePipelineAsync(){stats.pipelines++;return{getBindGroupLayout(){return{};}};},
  createBuffer({size,usage}){if(options.failAllocation===buffers.length+1)throw Error('allocation failed');const b={data:new ArrayBuffer(size),mapState:'unmapped',
   async mapAsync(){if(options.mapError)throw Error('mapping failed');if(options.pause)await new Promise(r=>release=r);this.mapState='mapped';},getMappedRange(){return this.data;},unmap(){this.mapState='unmapped';},destroy(){stats.destroyed++;}};buffers.push(b);return b;},
  createBindGroup(){if(options.bindError)throw Error('binding failed');return{};},
  queue:{writeBuffer(b,offset,data){new Uint8Array(b.data).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);if(b.data.byteLength===8)controls=new Uint32Array(b.data);},submit(jobs){for(const job of jobs)job();}},
  createCommandEncoder(){let copy;return{beginComputePass(){return{setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},copyBufferToBuffer(source,so,target){copy=()=>{const before=cpu.steps;cpu.run(controls[0]);const raw=encodeLiveVM(cpu);raw[16]=cpu.steps-before;new Uint32Array(target.data).set(raw);};},finish(){return copy;}};}
 };
 const gpu={requestAdapter:async()=>({info:{isFallbackAdapter:false},requestDevice:async()=>device})};return{gpu,buffers,stats,cpu,release:()=>release()};
}
test('live GPU host publishes snapshots, reuses pipelines and frees sessions',async()=>{
 const h=host(),engine=await createGpuLiveEngine({gpu:h.gpu}),v=vm();
 try{const s=await engine.createSession(v);assert.equal(await s.advance(0),0);assert.equal(await s.advance(7),7);assert.deepEqual(encodeLiveVM(v),encodeLiveVM(h.cpu));assert.equal(s.lastStep,null);assert.equal(engine.stats.advances,1);assert.equal(engine.stats.steps,7);
 for(const n of [-1,NaN,1.5])await assert.rejects(s.advance(n),/nonnegative integer/);
 const second=await engine.createSession(vm(50));assert.equal(h.stats.pipelines,1);second.close();s.close();s.close();assert.equal(h.stats.destroyed,6);await assert.rejects(s.advance(1),/closed/);
 }finally{engine.close();}await assert.rejects(engine.createSession(vm()),/closed/);
});
test('live GPU setup rolls back every partially allocated resource',async()=>{
 for(const options of [{failAllocation:2},{failAllocation:3},{bindError:true}]){const h=host(options),engine=await createGpuLiveEngine({gpu:h.gpu});try{await assert.rejects(engine.createSession(vm()),/allocation failed|binding failed/);assert.equal(h.stats.destroyed,h.buffers.length);}finally{engine.close();}}
});
test('live GPU readback failure and close during advance preserve the visible VM',async()=>{
 for(const options of [{mapError:true},{pause:true}]){const h=host(options),engine=await createGpuLiveEngine({gpu:h.gpu}),v=vm(),before=encodeLiveVM(v);try{const session=await engine.createSession(v);const advance=session.advance(Infinity);
 if(options.pause){await assert.rejects(session.advance(1),/serialized/);session.close();h.release();assert.equal(await advance,0);}else await assert.rejects(advance,/mapping failed/);
 assert.deepEqual(encodeLiveVM(v),before);session.close();assert.equal(h.stats.destroyed,3);assert.equal(h.buffers[2].mapState,'unmapped');}finally{engine.close();}}
});
test('live GPU rejects unsupported rounds, shader errors and buffer capacity',async()=>{
 await assert.rejects(createGpuLiveEngine(),/unavailable/);
 const limited=host({limit:1}),limitedEngine=await createGpuLiveEngine({gpu:limited.gpu});try{await assert.rejects(limitedEngine.createSession(vm()),/buffer capacity/);}finally{limitedEngine.close();}
 const h=host({shaderError:true}),engine=await createGpuLiveEngine({gpu:h.gpu});try{await assert.rejects(engine.createSession(vm()),/shader 2: bad/);assert.equal(h.buffers.length,0);const traced=vm();traced.enableTrace(100001);await assert.rejects(engine.createSession(traced),/trace size/);}finally{engine.close();}
});
