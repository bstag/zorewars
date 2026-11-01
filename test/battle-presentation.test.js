import{test}from'node:test';import assert from'node:assert/strict';import{roundOutcome}from'../web/round-outcome.js';import{librarySwitchPrompt}from'../web/library-choice.js';import{conversionTarget,installConversion,conversionStatus,clearConversionStatus}from'../web/conversion-slots.js';
test('round outcomes distinguish winners, solo survival/death and ties',()=>{
 const one={name:'<One>',alive:true},two={name:'Two',alive:true};const deps={roster:[1,0],colors:['blue','pink'],touch:true,replaying:true,colorName:(i,name)=>'color:'+name};
 const won=roundOutcome({winner:0,cycle:1234,warriors:[one,two]},deps);assert.equal(won.overlay.color,'pink');assert.equal(won.overlay.title,'<One> wins');assert.match(won.log,/Replay:/);assert.match(won.overlay.sub,/tap/);
 for(const alive of [false,true]){const r=roundOutcome({winner:null,cycle:20,warriors:[{...one,alive}]},{...deps,touch:false,replaying:false});assert.equal(r.overlay.title,alive?'Survived':'Died');assert.match(r.overlay.sub,/click/);assert.ok(!r.log.includes('<One>'));}
 const tie=roundOutcome({winner:undefined,cycle:20,warriors:[one,two]},deps);assert.equal(tie.overlay.title,'Tie');assert.match(tie.log,/&lt;One&gt;/);
});
test('library switching offers only necessary battlefield or rules changes',()=>{
 const e={name:'Plane',battlefield:'torus:10x8'};assert.equal(librarySwitchPrompt(e,{},undefined),null);assert.equal(librarySwitchPrompt(e,{},true),null);assert.match(librarySwitchPrompt(e,{},false),/10x8 battlefield/);
 assert.equal(librarySwitchPrompt({name:'Ring'},{},false),null);assert.match(librarySwitchPrompt({name:'Ring'},{rulesName:'88'},false),/88 rules/);
 assert.match(librarySwitchPrompt({name:'Ring'},{topology:'torus',sizeX:10,sizeY:8,sizeZ:1},false),/the ring/);
});
test('conversion slots append, replace or cancel without losing source metadata',()=>{
 const slot={compiled:{name:'Original'},origin:{url:'https://example.test/a.red'}},state={slots:[slot],active:0};const target=conversionTarget(state,slot,4,()=>({}),()=>assert.fail('no prompt needed'));assert.equal(state.active,1);assert.notEqual(target,slot);
 assert.equal(installConversion(target,slot,'javascript',{code:'generated'}),'JavaScript');assert.equal(target.origin.name,'Original, converted to JavaScript');assert.equal(target.origin.url,slot.origin.url);assert.equal(target.compiled,null);
 assert.equal(conversionTarget(state,slot,2,()=>assert.fail(),()=>false),null);assert.equal(state.slots.length,2);assert.equal(conversionTarget(state,slot,2,()=>assert.fail(),()=>true),slot);
 const same={compiled:{name:'Same'}};installConversion(same,same,'python',{code:'py'});assert.equal(same.origin.name,'Same, converted to Python');assert.equal(same.origin.url,null);
 for(const lang of ['python','javascript'])for(const ready of [false,true])assert.equal(conversionStatus(lang,ready),lang==='python'&&!ready?'loading Python to verify the conversion…':'converting…');
 for(const text of ['converting…','loading Python…','failed']){const status={textContent:text},buttons=[{disabled:true}];clearConversionStatus(status,buttons);assert.equal(buttons[0].disabled,false);assert.equal(status.textContent,text==='failed'?text:'');}
});
