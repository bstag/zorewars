import{test}from'node:test';import assert from'node:assert/strict';import{StringStream}from'@codemirror/language';import{redcodeMode,definedNames,ALL_OPS}from'../web/redcode-language.js';import{annotated,card,settingsFor,fieldOf}from'../web/encyclopedia-content.js';
function tokens(line,state=redcodeMode.startState()){const stream=new StringStream(line,8),out=[];while(!stream.eol()){stream.start=stream.pos;const style=redcodeMode.token(stream,state);assert.ok(stream.pos>stream.start);if(style)out.push([stream.current(),style]);}return out;}
test('Redcode stream highlighting handles opcodes, modifiers, labels and expressions',()=>{
 for(const op of ALL_OPS)assert.deepEqual(tokens(op+'.I')[0],[op+'.I','keyword']);
 assert.deepEqual(tokens('loop MOV.I #1, target ; blast'),[['loop','labelName'],['MOV.I','keyword'],['#','operator'],['1','number'],['target','variableName'],['; blast','comment']]);
 assert.deepEqual(tokens('value EQU CORESIZE/4'),[['value','labelName'],['EQU','controlKeyword'],['CORESIZE','atom'],['/','operator'],['4','number']]);
 assert.deepEqual(tokens(';name Imp'),[[';name Imp','meta']]);assert.equal(tokens('; plain')[0][1],'comment');assert.deepEqual(tokens(':?'),[]);
 const state=redcodeMode.startState();tokens('MOV 0, target',state);assert.deepEqual(tokens('next JMP next',state)[0],['next','labelName']);
 assert.deepEqual(definedNames('loop: MOV 0, 1\nvalue EQU 4\nORG loop\nloop JMP 0\n; no label'),['loop','value']);
});
test('encyclopedia source comments retain quoted markers and escaped delimiters',()=>{
 assert.match(annotated('MOV 0, 1 ; <bomb>','redcode'),/&lt;bomb&gt;/);
 assert.match(annotated('name("a // b"); // note','javascript'),/class="why">note/);
 assert.match(annotated('name("a # b") # note','python'),/class="why">note/);
 const slash=String.fromCharCode(92);
 const text='name("path'+slash+slash+'"); // trailing';
 assert.match(annotated(text,'javascript'),/class="why">trailing/);
 assert.match(annotated(';name Hidden\n; section one\n; section two\n\nJMP 0','redcode'),/section one section two/);
 assert.ok(!annotated(';name Hidden','redcode').includes('Hidden'));
});
test('encyclopedia cards retain escaped metadata, field labels and matchups',()=>{
 const entry={id:'<id>',file:'plane/test.js',family:'<family>',summary:'A <b>trusted</b> explanation',how:['move'],strengths:['small'],weaknesses:['slow'],name:'Demo'};
 for(const language of ['redcode','javascript','python']){const html=card({...entry,language,battlefield:'torus:10x8',era:'1994',inspiredBy:'ancestor',tryIt:'change step'},'JMP 0 ; run',{name:'<name>',instructions:[{}]},null,{},[{file:'88/test.red',dialect:'88'},{file:'python/test.py',language:'python'},{file:'test.js',language:'javascript'}]);assert.match(html,/&lt;name&gt;/);assert.match(html,/Plane 10×8/);assert.match(html,/ICWS'88/);assert.match(html,/Watch it fight/);assert.match(html,/plane-test.webp/);}
 const bench={rounds:5,ranking:[{file:entry.file,rank:1,scorePerRound:2}],results:{[entry.file]:{vs:{other:{w:1,l:1,t:3}}}}};assert.match(card({...entry,language:'redcode'},'JMP 0',{name:'Demo',instructions:[{}]},bench,{other:'<other>'}),/Ranked #1/);
 assert.equal(fieldOf({}), 'Ring');assert.equal(fieldOf({battlefield:'torus:10x4x2'}),'3D');assert.equal(settingsFor('torus:10x4x2').coreSize,80);assert.equal(settingsFor('torus:10x8').sizeZ,1);assert.deepEqual(settingsFor(),{});
});
