import{test}from'node:test';import assert from'node:assert/strict';import{createRoundActions}from'../web/round-actions.js';import{prepareReplay}from'../web/replay.js';import{publishCompilation}from'../web/compile-source.js';import{compile}from'../src/engine/index.js';
function actions(state,extra={}){const calls=[];const deps={setStepDisabled:x=>calls.push(['step',x]),setFinishDisabled:x=>calls.push(['finish',x]),checkDeaths:()=>calls.push('deaths'),finishRound:()=>calls.push('ended'),sampleChart:()=>calls.push('chart'),updateCycle:()=>calls.push('cycle'),stopRunning:()=>calls.push('stop'),onError:e=>calls.push(e.message),yieldFrame:async()=>calls.push('yield'),...extra};return{calls,...createRoundActions(state,deps)};}
test('round actions publish current advances and discard replaced-round results',async()=>{
 let release,cancelled;const live={lastStep:{pc:7},advance:async(n,opts)=>{cancelled=opts.cancelled;return new Promise(r=>release=r);}};const state={vm:{done:false},live};const a=actions(state);const work=a.step(4);assert.equal(cancelled(),false);release(4);assert.equal(await work,4);assert.deepEqual(state.lastStep,{pc:7});assert.equal(state.livePending,null);assert.ok(state.dirtyFrame);assert.deepEqual(a.calls,[['step',true],'deaths','chart','cycle',['step',false]]);
 const second=a.step(4);state.vm={done:false};assert.equal(cancelled(),true);release(4);assert.equal(await second,0);assert.equal(a.calls.filter(x=>x==='deaths').length,1);
});
test('round actions handle finish, error, empty state and external cancellation',async()=>{
 const state={vm:{done:false},live:{advance:async()=>{state.vm.done=true;return 2;}}};const a=actions(state);assert.equal(await a.step(2),2);assert.ok(a.calls.includes('ended'));assert.equal(await a.step(1),0);
 state.vm.done=false;state.live.advance=async(n,{cancelled})=>{assert.equal(cancelled(),true);throw Error('device gone');};assert.equal(await a.step(1,()=>false),0);assert.ok(a.calls.includes('device gone'));assert.equal(await actions({vm:null}).step(1),0);
});
test('finish scheduling yields, stops at round completion and supports cancellation',async()=>{
 const state={vm:{done:false},live:{advance:async()=>{state.vm.done=true;return 1;}}};const a=actions(state);await a.finish();assert.deepEqual(a.calls.filter(Array.isArray),[['finish',true],['step',true],['step',false],['finish',false]]);assert.ok(a.calls.includes('yield'));await a.finish();
 const s={vm:{done:false},live:{advance:async()=>1}};let b;b=actions(s,{yieldFrame:async()=>b.cancelFinish()});await b.finish();assert.equal(b.calls.filter(x=>x==='chart').length,1);
 const zero={vm:{done:false},live:{advance:async()=>0}};await actions(zero).finish();
});
test('replay preparation reproduces round state and cancels before publication',async()=>{
 const settings={coreSize:80,maxLength:4,maxProcesses:8,minDistance:4,maxCycles:2000};const w=compile('JMP 0','redcode',settings);const setup={warriors:[w,w],positions:[0,40],firstTurn:1,pspaces:[new Int32Array(5),new Int32Array(5)]};let now=0,yields=0,size;
 const deps={isCurrent:()=>true,resetHighlights:n=>size=n,clock:()=>now+=10,yieldFrame:async()=>yields++};const replay=await prepareReplay(settings,setup,800,100,deps);assert.equal(replay.cycle,700);assert.equal(size,80);assert.ok(yields>0);assert.notEqual(replay.warriors[0].pspace,setup.pspaces[0]);
 let current=true;assert.equal(await prepareReplay(settings,setup,800,100,{...deps,isCurrent:()=>current,yieldFrame:async()=>current=false}),null);
 assert.equal(await prepareReplay(settings,setup,0,100,{...deps,isCurrent:()=>false}),null);
});
test('compilation publication preserves supersession and imported names',()=>{
 const slot={token:2,origin:{name:'Imported'}};assert.equal(publishCompilation(slot,1,{ok:true}),false);assert.equal(slot.compiled,undefined);
 const result={ok:true,name:'Unnamed'};assert.equal(publishCompilation(slot,2,result),true);assert.equal(result.name,'Imported');assert.equal(slot.status,'ok');assert.equal(slot.statusText,'');
 publishCompilation(slot,2,{ok:false});assert.equal(slot.status,'error');
});
