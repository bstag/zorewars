import{test}from'node:test';import assert from'node:assert/strict';import{CoreRenderer}from'../web/arena.js';import{VM,compile}from'../src/engine/index.js';
function render(prelayout,torus,width){
 const cfg={coreSize:32,maxLength:2,minDistance:4,maxCycles:100,maxProcesses:8,...(torus?{topology:'torus',sizeX:4,sizeY:4,sizeZ:2}:{})};
 const vm=new VM(cfg);const w=compile('MOV.I 0, 1\nJMP -1','redcode',cfg);assert.ok(w.ok);vm.load([w,w],{positions:[0,16]});for(let i=0;i<12;i++)vm.step();
 const commands=[];const ctx=new Proxy({},{get:(_,key)=>(...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));commands.push([key,...args]);},set:(_,key,value)=>{commands.push([key,value]);return true;}});
 const canvas={getContext:()=>ctx,parentElement:{clientWidth:width},style:{}};
 const saved=globalThis.window;globalThis.window={devicePixelRatio:1};
 try{const v=new CoreRenderer(canvas);if(prelayout)v.layout(vm.size,vm.geo);commands.length=0;v.pinned=0;v.hover=16;v.draw(vm,24);return commands.filter(c=>c[0]!=='setTransform');}finally{if(saved===undefined)delete globalThis.window;else globalThis.window=saved;}
}
for(const torus of [false,true])for(const width of [40,400])test('2D core first frame uses current layout '+torus+'/'+width,()=>assert.deepEqual(render(false,torus,width),render(true,torus,width)));
