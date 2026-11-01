import{test}from'node:test';import assert from'node:assert/strict';import * as T from '../web/vendor/three.js';import{scene}from'./fixtures/avatar3d-scene.js';
function finite(v){for(const b of v.batches){const used=b.userData.n;assert.ok(used<=b.instanceMatrix.count);assert.ok([...b.instanceMatrix.array.slice(0,used*16)].every(Number.isFinite));assert.ok([...b.instanceColor.array.slice(0,used*3)].every(Number.isFinite));}}
for(const options of [{},{torus:true,space:null},{torus:true,space:'box'},{torus:true,space:'torus'}])test('3D full scene frame, map tracking and selection '+JSON.stringify(options),()=>{
 const s=scene(options),{v,vm}=s;v.draw(vm,24);assert.equal(s.renders,1);finite(v);
 for(let i=0;i<10;i++)vm.step();s.setNow(1100);v.hover=0;v.pinned=40;v.draw(vm,24);finite(v);assert.equal(s.renders,2);
 for(const rt of v.rt){assert.ok(rt.stage.toArray().every(Number.isFinite));assert.ok(rt.drawn>0);}
 const rt=v.rt[0],p=rt.slotPos[0].clone().project(v.camera);assert.equal(v.addressAt((p.x+1)*400,(1-p.y)*250),0);
 if(options.torus){assert.ok(v.rt.every(rt=>rt.anchor>=0));v.rt[0].anchor=-1;v.trackOnMap(vm,0.016,false);finite(v);const at=v.cellFloor(0,new T.Vector3());assert.ok(at.toArray().every(Number.isFinite));}
 v.focus={w:0,i:0,start:1100,until:2400};v.direct(1300,0.016);v.userHolding=true;const position=v.camera.position.clone();v.direct(1400,0.016);assert.deepEqual(v.camera.position,position);
});
test('3D scene clock does not advance repeatedly at timestamp zero',()=>{
 const s=scene();s.setNow(0);s.v.lastNow=null;const original=performance.now;performance.now=()=>0;try{s.v.draw(s.vm,24);const t=s.v.t;s.v.draw(s.vm,24);assert.equal(s.v.t,t);}finally{performance.now=original;}
});
test('3D projectile trails, landing and impact lifetimes stay finite',()=>{
 const {v,vm}=scene();v.draw(vm,24);
 for(const kind of ['bombed','stunned','converted','chipped','unknown'])for(const minor of [false,true]){v.flying=[{from:{w:0,i:0},to:{w:1,i:0},kind,minor,attacker:0,t0:v.t}];v.t+=0.1;v.begin();v.drawFlying(1200);assert.equal(v.flying.length,1);v.t+=0.5;v.drawFlying(1800);assert.equal(v.flying.length,0);finite(v);}
 v.impact('kill',new T.Vector3(0,1,0),0,false);assert.ok(v.rings.length);v.begin();v.drawRings();v.stepParticles(0.016);v.stepFlashes();finite(v);assert.ok(v.pLife.some(x=>x>0));v.t+=2;v.drawRings();v.stepFlashes();assert.equal(v.rings.length,0);assert.ok(v.flashes.every(f=>f.light.intensity===0));
 v.flying=[{from:{w:99,i:0},to:{w:0,i:0},t0:v.t}];v.drawFlying(2000);assert.equal(v.flying.length,0);
});

test('long 3D bodies use helix slots and retain finite picking coordinates',()=>{const {v,vm}=scene({length:20});v.draw(vm,24);assert.equal(v.layouts[0].pos.length,20);assert.ok(v.layouts[0].r>0);finite(v);});

test('3D floor/cloud picking resolves projected cells and ignores missing endpoints',()=>{
 for(const space of [null,'box']){const {v,vm}=scene({torus:true,space});v.draw(vm,24);const point=v.cellFloor(0,new T.Vector3()).project(v.camera);assert.equal(v.floorCellAt((point.x+1)/2,(1-point.y)/2),0);assert.equal(v.endPoint({w:99,i:0}),null);assert.ok(v.endPoint({w:0,i:-1,cell:0}).toArray().every(Number.isFinite));v.rt.forEach(rt=>rt.drawn=0);assert.equal(v.addressAt((point.x+1)*400,(1-point.y)*250),0);if(!space)assert.equal(v.floorCellAt(0.5,-10),-1);}
});
