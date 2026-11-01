import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {VM,compile} from '../../src/engine/index.js';

export const cases=[{}, {shape:'torus'}, {slice:0}, {slice:1}, {slice:2}, {follow:true}, {track:true}, {spin:false}, {hover:0,pinned:8}, {ring:true}, {steps:0}, {steps:100}];
export function capture(View,options={}) {
  const settings={coreSize:32,maxLength:2,minDistance:4,maxCycles:100,maxProcesses:8,
    ...(options.ring?{}:{topology:'torus',sizeX:4,sizeY:4,sizeZ:2})};
  const vm=new VM(settings);
  const code=compile('MOV.I 0, 1\nJMP -1','redcode',settings);
  assert.ok(code.ok);
  vm.load([code,code],{positions:[0,16],seed:7});
  for(let i=0;i<(options.steps??24)&&!vm.done;i++)vm.step();
  const commands=[];const round=x=>Math.round(x*1e6)/1e6;
  const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{
    for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x),'finite Canvas coordinate');
    commands.push([key,...args.map(x=>typeof x==='number'?round(x):x)]);
  },set:(_,key,value)=>{commands.push([key,typeof value==='number'?round(value):value]);return true;}});
  const canvas={getContext:()=>ctx,addEventListener(){},parentElement:{clientWidth:400},style:{}};
  const previous=globalThis.window;globalThis.window={devicePixelRatio:1};
  const originalNow=performance.now;performance.now=()=>1200;
  try {
    const view=new View(canvas);view.shape=options.shape??'box';view.spin=options.spin??true;
    view.layout(vm.size,vm.geo);
    if(options.slice!==undefined)view.setSlice(options.slice,0,1);
    view.follow=!!options.follow;
    if(options.track)view.followWarriorIndex(0,'#123456');
    view.hover=options.hover??-1;view.pinned=options.pinned??-1;
    const highlights={hottest:()=>0,draw(ctx,now,project){const p=project(0);if(p)ctx.strokeRect(...p,2);}};
    view.draw(vm,24,highlights);
    const state={commands,cells:[...view.drawnCells.slice(0,view.drawnCount)],center:view.center.map(round),zoom:round(view.zoom),yaw:round(view.yaw),tracked:view.tracked};
    return {digest:createHash('sha256').update(JSON.stringify(state)).digest('hex'),drawn:view.drawnCount,commands:commands.length};
  }finally{performance.now=originalNow;if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
}
