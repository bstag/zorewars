import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{codeTags}from'../scripts/hill-code-tags.js';import{compile}from'../src/engine/index.js';
const i=(op,a=0,b=0,aMode='$',bMode='$',mod='I')=>({op,a,b,aMode,bMode,mod});
test('hill code tags retain compiled-library classifications',()=>{const entries=JSON.parse(fs.readFileSync(new URL('./fixtures/hill-code-tags.json',import.meta.url)));for(const entry of entries){const w=compile(fs.readFileSync(new URL('../warriors/'+entry.file,import.meta.url),'utf8'),entry.language);assert.ok(w.ok);assert.deepEqual([...codeTags(w.instructions)],entry.tags,entry.file);}});
test('hill code tags recognize each heuristic without fetching a hill',()=>{
 assert.deepEqual([...codeTags([])],[]);assert.ok(codeTags(Array(6).fill(i('SEQ',200,300))).has('qscan'));
 assert.ok(codeTags([i('SPL',0,0,'@'),i('MOV',0,1,'>','>')]).has('paper'));
 assert.ok(codeTags([i('MOV',0,2667)]).has('imp'));
 assert.ok(codeTags([i('SPL',0,0,'#'),i('MOV',0,1,'$','>'),i('JMP',-1)]).has('clear'));
 assert.ok(codeTags([i('MOV',0,1,'$','>'),i('DJN',-1)]).has('clear'));
 assert.ok(codeTags(Array(6).fill(i('DAT',1))).has('decoy'));assert.equal(codeTags([...Array(5).fill(i('DAT',1)),i('MOV')]).has('decoy'),false);
 assert.ok(codeTags([i('LDP')]).has('pspace'));assert.ok(codeTags([i('STP')]).has('pspace'));
});
