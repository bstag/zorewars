import{test}from'node:test';import assert from'node:assert/strict';import{appendWarrior}from'../src/engine/gpu/packing.js';import{OP,MOD,MODES}from'../src/engine/constants.js';import{makeGeometry}from'../src/engine/geometry.js';
const cfg={coreSize:80,maxLength:10};const ins={op:'MOV',mod:'I',aMode:'#',bMode:'>',a:-1,b:81};
function pack(w,s=cfg,geo=null){const input=[0,0,0];appendWarrior(input,0,w,s,geo);return input;}
test('GPU warrior packing retains headers, opcode bits, modes, fields and torus entry',()=>{
 const expected=[3,1,79,OP.MOV|(MOD.I<<5)|(MODES.indexOf('#')<<8)|(MODES.indexOf('>')<<11),79,1];
 assert.deepEqual(pack({start:-1,instructions:[ins]}),expected);
 assert.deepEqual(pack({start:-1,instructions:[{...ins,op:OP.MOV,mod:MOD.I,aMode:MODES.indexOf('#'),bMode:MODES.indexOf('>')}]}),expected);
 const geo=makeGeometry({...cfg,topology:'torus',sizeX:10,sizeY:8,sizeZ:1});assert.equal(pack({start:12,instructions:[ins]},cfg,geo)[2],geo.encode(12,0,0));
});
test('GPU packing rejects invalid records before dispatch',()=>{
 for(const w of [null,{}, {start:0,instructions:[]},{start:0,instructions:Array(11).fill(ins)},{start:0.5,instructions:[ins]}])assert.throws(()=>pack(w),/invalid warrior/);
 for(const [field,values]of Object.entries({op:[-1,19,'oops'],mod:[-1,7,'oops'],aMode:[-1,8,'oops'],bMode:[-1,8,'oops'],a:[0.5,NaN],b:[0.5,NaN]}))for(const value of values)assert.throws(()=>pack({start:0,instructions:[{...ins,[field]:value}]}),/invalid compiled instruction/);
 const geo=makeGeometry({...cfg,topology:'torus',sizeX:10,sizeY:8,sizeZ:1});assert.throws(()=>pack({start:0,instructions:Array(6).fill(ins)},cfg,geo),/invalid warrior length/);
});
