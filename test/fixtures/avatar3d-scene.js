import * as T from '../../web/vendor/three.js';import{AvatarView3D}from'../../web/avatars3d.js';import{AvatarModel}from'../../web/avatar-model.js';import{VM,compile}from'../../src/engine/index.js';
function element(){const children=new Map();return{style:{},remove(){},append(){},querySelector(k){if(!children.has(k))children.set(k,element());return children.get(k);}};}
export function scene({space=null,torus=false,length=2}={}){
 const cfg={coreSize:80,maxLength:100,minDistance:10,maxCycles:80,maxProcesses:8,...(torus?{topology:'torus',sizeX:10,sizeY:4,sizeZ:2}:{})};
 const vm=new VM(cfg);const w=compile('SPL 0\nJMP -1'+Array.from({length:Math.max(0,length-2)},()=> '\nDAT 0, 0').join(''),'redcode',cfg);vm.load([w,w],{positions:[0,40]});
 const v=Object.create(AvatarView3D.prototype);let now=1000,renders=0;
 Object.assign(v,{scene:new T.Scene(),model:new AvatarModel(),canvas:{clientWidth:800,clientHeight:500,getBoundingClientRect:()=>({left:0,top:0,width:800,height:500})},overlay:element(),labels:[],legend:element(),floor:new T.Group(),arenaRings:[],camera:new T.PerspectiveCamera(38,1.6,0.05,80),colors:[new T.Color('#22d3ee'),new T.Color('#f472b6')],sprite:null,t:0,lastNow:null,slowUntil:0,userAt:-Infinity,userHolding:false,mapChoice:torus,spaceChoice:space,active:true,hover:-1,pinned:-1,pNext:0,nextFlash:0,w:800,h:500,coreSize:80,now:()=>now});
 v.camera.position.set(0,1.7,4.6);v.controls={target:new T.Vector3(0,0.8,0),update(){v.camera.lookAt(this.target);v.camera.updateMatrixWorld();}};v.composer={render(){renders++;}};
 v.tmp={m:new T.Matrix4(),q:new T.Quaternion(),q2:new T.Quaternion(),v:new T.Vector3(),v2:new T.Vector3(),s:new T.Vector3(),c:new T.Color()};v.sq={a:new T.Quaternion(),b:new T.Quaternion(),c:new T.Quaternion(),dir:new T.Vector3(),id:new T.Quaternion()};
 v.flashes=Array.from({length:3},()=>({light:new T.PointLight(),t0:-1,peak:0}));
 for(const k of ['pPos','pCol','pVel','pBase'])v[k]=new Float32Array(2400*3);
 for(const k of ['pLife','pMax','pGrav'])v[k]=new Float32Array(2400);v.pMax.fill(1);
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(v.pPos,3));pg.setAttribute('color',new T.BufferAttribute(v.pCol,3));v.particles=new T.Points(pg);v.cycleRing=new T.Mesh(new T.BufferGeometry());
 v.buildShapes();const previous=globalThis.document;globalThis.document={createElement:element};try{v.build(vm);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
 return{v,vm,setNow(n){now=n;},get renders(){return renders;}};
}
