import{test}from'node:test';import assert from'node:assert/strict';import{initializeRemoteImport,initializeLocalSlots}from'../web/startup-slots.js';
function context(){const calls=[];const state={settings:{}};return{state,calls,libraryEntry:name=>['imp.red','dwarf.red'].includes(name)?{battlefield:'ring'}:null,makeSlot:name=>({libFile:name,token:0,compiled:'old'}),applySettings:s=>calls.push(['settings',s]),saveSlots:()=>calls.push(['save']),clearQuery:()=>calls.push(['clear'])};}
test('remote startup retains archive precedence, opponent fallback and length rules',()=>{
 let c=context();assert.equal(initializeRemoteImport(new URLSearchParams(),c),null);assert.deepEqual(c.calls,[]);
 for(const vs of ['imp.red','unknown']){c=context();assert.equal(initializeRemoteImport(new URLSearchParams({url:'https://example.test/a.red',vs,rules:'94x-hill',length:'201'}),c),'https://example.test/a.red');assert.equal(c.state.slots[1].libFile,vs==='imp.red'?vs:'dwarf.red');assert.match(c.state.slots[0].source,/Loading/);assert.equal(c.calls[0][1].maxLength,201);assert.ok(c.calls[0][1].minDistance>=201);assert.deepEqual(c.calls.at(-1),['clear']);}
 c=context();initializeRemoteImport(new URLSearchParams({url:'https://example.test/a.red'}),c);assert.equal(c.calls[0][1].coreSize,8000);
});
test('local startup restores saved state or library links and defaults',()=>{
 for(const requested of [['imp.red'],['dwarf.red'],['imp.red','dwarf.red']]){const c=context();initializeLocalSlots([],requested,c);assert.equal(c.state.slots.length,2);assert.deepEqual(c.calls[0],['save']);assert.deepEqual(c.calls[1],['clear']);}
 let c=context();initializeLocalSlots([{source:'saved',compiled:'stale',token:8}],[],c);assert.equal(c.state.slots[0].compiled,null);assert.equal(c.state.slots[0].source,'saved');assert.deepEqual(c.calls,[]);
 c=context();initializeLocalSlots(null,[],c);assert.deepEqual(c.state.slots.map(s=>s.libFile),['dwarf.red','mice.red']);
});
