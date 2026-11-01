import{test}from'node:test';import assert from'node:assert/strict';import{CoreView3D}from'../web/arena3d.js';
test('core following retains lineage, caps trails and snaps across wrap seams',()=>{
 const v=Object.create(CoreView3D.prototype);Object.assign(v,{followWarrior:0,tracked:-1,trail:[],pos:new Float32Array([-1.5,0,0,-0.5,0,0,0.5,0,0,1.5,0,0]),coord:new Int16Array([0,0,0,1,0,0,2,0,0,3,0,0]),geo:null,coreSize:4,dims:[4,1,1],center:[0,0,0],targetZoom:1,rings:null});
 const queue=[0,3];queue.buf=queue;queue.head=0;queue.size=2;const war={alive:true,queue};const vm={warriors:[war]};v.track(vm);assert.equal(v.tracked,0);v.track(vm);assert.equal(v.trail.length,1);
 queue.splice(0,2,1,3);v.track(vm);assert.equal(v.tracked,1);v.trail=Array(90).fill(1);v.tracked=3;queue.splice(0,2,0);queue.size=1;v.center=[1.5,0,0];v.track(vm);assert.deepEqual(v.center,[-1.5,0,0]);assert.equal(v.trail.length,90);
 v.trail=[];v.rings={outer:0.2};v.tracked=3;v.center=[1.5,0,0];v.track(vm);assert.deepEqual(v.center,[-1.5,0,0]);assert.ok(v.targetZoom>1);
 for(const state of [{alive:false,queue},{alive:true,queue:{size:0}},undefined]){vm.warriors[0]=state;const old=v.tracked;v.track(vm);assert.equal(v.tracked,old);}
});
