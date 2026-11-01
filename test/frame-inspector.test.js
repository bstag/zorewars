import{test}from'node:test';import assert from'node:assert/strict';import{advanceFrame,sceneNeedsDraw}from'../web/frame-policy.js';import{paintInspector}from'../web/inspector.js';import{VM,compile}from'../src/engine/index.js';
test('frame stepping carries fractional budgets and cancels stale live epochs',()=>{
 const state={vm:{done:false,warriors:[{alive:true},{alive:false}]},running:true,livePending:false,stepsPerFrame:0.6,carry:0,liveEpoch:1};const calls=[];
 advanceFrame(state,(want,valid)=>calls.push({want,valid}));assert.equal(calls.length,0);advanceFrame(state,(want,valid)=>calls.push({want,valid}));assert.equal(calls[0].want,1);assert.ok(calls[0].valid());state.liveEpoch++;assert.equal(calls[0].valid(),false);
 for(const patch of [{running:false},{livePending:true},{vm:null},{vm:{done:true}}]){const s={...state,...patch};advanceFrame(s,()=>assert.fail('should not advance'));}
});
test('paused animation is throttled while dirty frames bypass the cadence',()=>{
 for(const dirtyFrame of [false,true])for(const running of [false,true])for(const active of [false,true])for(const now of [32,33]){const s={dirtyFrame,running,sceneDirty:false,lastSceneDraw:0};assert.equal(sceneNeedsDraw(s,active,false,now),dirtyFrame||(active&&(running||now>=33)));assert.equal(s.sceneDirty,dirtyFrame);}
 assert.ok(sceneNeedsDraw({running:false,lastSceneDraw:0},false,true,40));
});
test('inspector renders VM neighbors and distinguishes loaded, written, empty and last-step provenance',()=>{
 const vm=new VM({coreSize:80,maxLength:4,minDistance:4,maxProcesses:8,maxCycles:100});const w=compile(';name <warrior>\nJMP 0');assert.ok(w.ok);vm.load([w],{positions:[10]});
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};const state={vm,pinned:-1,hover:-1,running:true,roster:[0]};const colorName=(i,name)=>name;const pad=n=>String(n).padStart(4,'0');
 paintInspector(state,$,colorName,pad);assert.match($('inspectHint').textContent,/Hover/);
 state.pinned=10;paintInspector(state,$,colorName,pad);assert.match($('inspector').innerHTML,/&lt;warrior&gt;/);assert.equal($('inspector').innerHTML.split('\n').length,9);assert.match($('inspectHint').innerHTML,/Loaded as part/);assert.equal($('cellPeek').hidden,false);
 vm.writerPc[10]=10;vm.writeCycle[10]=12;paintInspector(state,$,colorName,pad);assert.match($('inspectHint').innerHTML,/Written by/);assert.match($('inspectHint').innerHTML,/cycle 12/);
 state.pinned=-1;state.hover=0;paintInspector(state,$,colorName,pad);assert.match($('inspectHint').innerHTML,/Empty core/);assert.equal($('cellPeek').hidden,true);
 state.hover=-1;state.running=false;state.lastStep={pc:10,warrior:0,killed:true};paintInspector(state,$,colorName,pad);assert.match($('inspectHint').innerHTML,/process <b>died/);
 state.vm=null;paintInspector(state,$,colorName,pad);assert.equal($('inspector').textContent,'');
});
