import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../../web/vendor/three.js';

export const cases = [
  {}, {damage:'bombed'}, {damage:'stunned'}, {damage:'chipped'}, {damage:'converted'},
  {morph:0.2}, {morph:0.5}, {morph:0.9}, {morph:1},
  {morph:0.8,n:9,target:3}, {morph:0.3,n:3,target:9},
  {fallen:true}, {fallen:true,morph:0.7}, {away:0}, {space:true},
  {now:120}, {capture:0.8}, {n:1,target:1}
];

// Run real Three.js vector/color/shape drawing, replacing only GPU submission.
export function capture(View, options={}) {
  const {n=7,target=9,now=1100,morph=0,damage=null,fallen=false,away=16,space=false,capture=0}=options;
  const kinds=['arm','claw','gear','joint','eye','pod','plate'];
  const body=(len)=>({cells:Array.from({length:len},(_,i)=>100+i),kind:Array.from({length:len},(_,i)=>kinds[i%7]),origKind:Array.from({length:len},(_,i)=>kinds[(i+2)%7]),damage:Array(len).fill(damage),enemy:Array(len).fill(1),active:Array(len).fill(0.7),procs:Array(len).fill(2),lastHit:Array(len).fill(Math.min(900,now-200)),alive:!fallen,morph,morphTo:1,shake:1000,total:32,away,possessed:8,captor:1,capture,lastCaptor:1});
  const layout=(len)=>({r:0.1,pos:Array.from({length:len},(_,i)=>new T.Vector3(Math.sin(i)*0.1,1.5-i*0.1,Math.cos(i)*0.1))});
  const v=Object.create(View.prototype);
  v.t=2;v.space=space;v.maxLen=16;
  v.model={bodies:[body(n),body(target)]};v.layouts=[layout(n),layout(target)];
  v.colors=[new T.Color('#6caaff'),new T.Color('#ff986c')];
  v.tmp={m:new T.Matrix4(),q:new T.Quaternion(),q2:new T.Quaternion(),v:new T.Vector3(),v2:new T.Vector3(),s:new T.Vector3(),c:new T.Color()};
  v.sq={a:new T.Quaternion(),b:new T.Quaternion(),c:new T.Quaternion(),dir:new T.Vector3(),id:new T.Quaternion()};
  v.rt=[{stage:new T.Vector3(1,0.4,-1),yaw:0.7,drawn:n,slotR:Array(16).fill(0.1),slotCell:Array(16).fill(-1),slotPos:Array.from({length:16},(_,i)=>new T.Vector3(1,1.5-i*0.1,-1))}];
  if(fallen)v.rt[0].fall=v.startFall(v.rt[0],v.model.bodies[0]);
  v.parts=Object.fromEntries(kinds.map(k=>[k,k]));
  for(const k of ['shards','glows','webs','chips','links','legs','halos','sparks','tentacles','jaws','eyeballs','pupils'])v[k]=k;
  const commands=[];
  const round=x=>Math.round(x*1e6)/1e6;
  v.put=(mesh,pos,q,sx,sy,sz,color)=>{
    const numbers=[...pos.toArray(),...q.toArray(),sx,sy,sz,...color.toArray()];
    assert.ok(numbers.every(Number.isFinite),'finite mesh transform and color');
    assert.ok(sx>=0&&sy>=0&&sz>=0,'nonnegative scales');
    commands.push([mesh,...numbers.map(round)]);
  };
  v.drawWarrior({settings:{maxProcesses:8000}},0,now,0.016);
  const rt=v.rt[0];
  const state={commands,drawn:rt.drawn,top:round(rt.top),slots:rt.slotPos.slice(0,rt.drawn).map((p,i)=>[...p.toArray().map(round),round(rt.slotR[i]),rt.slotCell[i]])};
  return {digest:createHash('sha256').update(JSON.stringify(state)).digest('hex'),count:commands.length,meshes:[...new Set(commands.map(c=>c[0]))].sort()};
}
