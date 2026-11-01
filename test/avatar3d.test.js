import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AvatarView3D} from '../web/avatars3d.js';
import {cases,capture} from './fixtures/avatar3d-harness.js';

// Captured from pre-refactor drawWarrior. Includes transforms, colors and hit slots.
const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/avatar3d-commands.json',import.meta.url),'utf8'));
for(const [i,options] of cases.entries()) {
  test('3D avatar scene commands and hit slots: '+JSON.stringify(options),()=>{
    assert.deepEqual(capture(AvatarView3D,options),golden[i]);
  });
}

import * as T from '../web/vendor/three.js';

test('3D avatar events: immediate kills, bounded flights and off-body endpoints',()=>{
  const v=Object.create(AvatarView3D.prototype);
  v.t=4;v.flying=[];v.endPoint=end=>end.cell===99?null:new T.Vector3();
  const impacts=[];v.impact=(...args)=>impacts.push(args);
  const hits=[{kind:'kill',to:{w:0,i:1},attacker:1},
    ...Array.from({length:20},()=>({kind:'write',to:{w:0,i:-1},cell:99,minor:true})),
    ...Array.from({length:100},()=>({kind:'write',to:{w:0,i:1},minor:false}))];
  v.model={takeHits:()=>hits};v.takeBlows(1000);
  assert.equal(impacts.length,1);assert.equal(v.focus.w,0);
  assert.equal(v.flying.length,80);assert.equal(v.flying.filter(f=>f.minor).length,12);
  assert.equal(v.flying[0].to.cell,99);assert.equal(v.flying[0].t0,4);
  v.model.takeHits=()=>[{kind:'kill',to:{w:1,i:-1},cell:99,attacker:0}];
  v.takeBlows(1100);assert.equal(impacts.length,1);assert.equal(v.focus.w,0);
  v.takeBlows(2000);assert.equal(v.focus.w,1);
});

test('3D avatar facing chooses the nearest living opponent and takes the short turn',()=>{
  const v=Object.create(AvatarView3D.prototype);
  v.model={bodies:[{alive:true},{alive:false},{alive:true},{alive:true}]};
  v.rt=[{stage:new T.Vector3(),yaw:Math.PI-0.01},{stage:new T.Vector3(0.1,0,0),yaw:0},
    {stage:new T.Vector3(-2,0,0.1),yaw:0},{stage:new T.Vector3(10,0,0),yaw:0}];
  const before=v.rt[0].yaw;v.faceOpponents(0.016);
  assert.ok(v.rt[0].yaw>before);assert.ok(v.rt[0].yaw-before<0.01);
  v.model.bodies.forEach(b=>b.alive=false);const yaw=v.rt[0].yaw;v.faceOpponents(1);
  assert.equal(v.rt[0].yaw,yaw);
});

test('3D avatar map switching updates floor/cloud visibility, camera and anchors',()=>{
  for(const on of [false,true])for(const space of [null,'box'])for(const n of [2,4]) {
    const v=Object.create(AvatarView3D.prototype);
    Object.assign(v,{mapOn:on,space,mapW:6.4,mapD:5,spaceY:2,mapMesh:{},arenaRings:[{},{}],controls:{},
      floor:{scale:new T.Vector3()},rt:Array.from({length:n},()=>({})),legend:{}});
    if(space)v.spaceMesh={};let placed=0,notification;
    v.placeArena=()=>placed++;v.onMapChange=value=>notification=value;
    v.applyMap();
    assert.equal(v.mapMesh.visible,on&&!space);assert.equal(v.arenaRings[0].visible,!on);
    if(space)assert.equal(v.spaceMesh.visible,on);
    assert.equal(notification,on);assert.equal(placed,on?0:1);
    assert.equal(v.mapDirty,true);assert.ok(v.home.dist>0&&v.home.height>0);
    assert.ok(v.cycleR>0);assert.equal(v.cycleStep,-1);
    if(on)assert.ok(v.rt.every(rt=>rt.snap&&rt.anchor===-1));
  }
});
