import{test}from'node:test';import assert from'node:assert/strict';import{compile}from'../src/engine/index.js';
import{compileStatusMarkup,generatedListing,escapeHtml}from'../web/editor-status.js';import{selectRenderer,updateRendererControls}from'../web/renderer-choice.js';
test('renderer choice retains defaults, explicit views and WebGL fallback',()=>{
 const views={avatars:{},avatars3d:{},renderer2d:{},renderer3d:{}};
 for(const geo of [null,{Z:1},{Z:2}])for(const avatars of [false,true])for(const avatarsFlat of [false,true])for(const view3d of [undefined,false,true])for(const status of ['loading','ready','failed']) {
  const state={vm:{geo},avatars,avatarsFlat,view3d};const choice=selectRenderer(state,views,status);
  const want3d=!avatars&&!!geo&&(view3d??geo.Z>1);const flat=avatarsFlat||status==='failed';
  assert.equal(choice.want3d,want3d);assert.equal(choice.flat,flat);assert.equal(choice.next,avatars?(flat?views.avatars:views.avatars3d):want3d?views.renderer3d:views.renderer2d);
  const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(k,v){this[k]=v;}});return nodes.get(id);};
  updateRendererControls($,state,choice,{slice:{axis:-1},follow:true,spin:false},status);
  assert.equal($('avatarToggle')['aria-pressed'],String(avatars));assert.equal($('viewToggle').hidden,avatars?status==='failed':!geo);
  assert.equal($('spinToggle').hidden,!want3d);assert.equal($('sliceBar').hidden,true);
  assert.equal($('viewToggle').textContent,avatars?(flat?'3D':'Flat'):(want3d?'2D':'3D'));
 }
 assert.equal(selectRenderer({avatars:true},{...views,avatars3d:null},'loading').next,views.avatars);
});
test('editor status escapes diagnostics, metadata and pending text',()=>{
 assert.equal(escapeHtml('<&>"'),'&lt;&amp;&gt;&quot;');assert.equal(compileStatusMarkup({}), '');
 assert.match(compileStatusMarkup({status:'compiling',statusText:'<loading>'}),/&lt;loading&gt;/);
 assert.match(compileStatusMarkup({status:'compiling'}),/Compiling/);
 const errors={ok:false,errors:[{line:2,message:'<bad>'},{line:0,message:'no line'}]};
 assert.match(compileStatusMarkup({compiled:errors,language:'python'}),/Redcode line 2: &lt;bad&gt;/);
 assert.match(compileStatusMarkup({compiled:{...errors,errors:[errors.errors[0]]},language:'redcode'}),/1 error<.*line 2:/);
 const w=compile(';name <name>\n;author <author>\nJMP 0');assert.ok(w.ok);
 assert.match(compileStatusMarkup({compiled:w}),/&lt;name&gt;/);assert.match(compileStatusMarkup({compiled:w}),/1 instruction<[/]span>/);
 w.instructions.push(w.instructions[0]);w.warnings=[{message:'<warning>'},{message:'other'}];
 assert.match(compileStatusMarkup({compiled:w}),/2 warnings: &lt;warning&gt;/);
 w.warnings.pop();assert.match(compileStatusMarkup({compiled:w}),/1 warning:/);
});
test('generated listing display retains normalized, translated and failed output',()=>{
 const w=compile('JMP 0');for(const language of ['redcode','python','javascript']) {
  const result=generatedListing({compiled:w,language},{});assert.match(result.code,/JMP/);
  assert.equal(result.meta,language==='redcode'?'(normalised)':language==='python'?'(generated from Python)':'(generated from JavaScript)');
 }
 assert.deepEqual(generatedListing({compiled:{ok:false,redcode:'bad'},language:'python'},{}),{code:'bad',meta:'(generated, has errors)'});
 assert.equal(generatedListing({compiled:{ok:false,redcode:'bad'},language:'redcode'},{}),null);assert.equal(generatedListing({},{}),null);
});
