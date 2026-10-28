import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, mulberry32 } from '../src/engine/index.js';
import { airbagDefaults, airbagSpace, emitAirbag, buildAirbag, verifyAirbag, airbagGenerator } from '../tools/blocks/airbag.js';
import { parseTunable, withConstants } from '../tools/tune.js';

test('Lifeboat boot, attack, watchdog and phase contracts for every structural choice',()=>{
  for(const BOOT of [0,1])for(const BOMB of [0,1])for(const BACKWARD of [0,1])for(const PHASE of [0,1,2]) {
    const b=buildAirbag({...airbagDefaults,BOOT,BOMB,BACKWARD,PHASE});
    assert.equal(b.w.instructions.length,(BOOT?6:0)+(PHASE?31:27));
    assert.equal(b.verification.observations.length,BOOT?5:4);
    if(BOOT) {
      const destination=(b.verification.observations[2].base+b.P.HOP)%b.settings.coreSize;
      assert.ok(destination+b.verification.payloadLength>b.settings.coreSize);
    }
    assert.ok(b.verification.observations.every(x=>x.survives && x.peakProcesses===2 && x.finalProcesses===1));
  }
});
test('Lifeboat numerical edges and deterministic random vectors pass the same admission gate',()=>{
  for(const [STEP,HOP,SHOTS,STUN] of [[1,256,16,1],[55439,54000,16,4096],[27720,54000,2048,4096]])buildAirbag({...airbagDefaults,STEP,HOP,SHOTS,STUN});
  const random=mulberry32(4247);
  for(let i=0;i<12;i++)buildAirbag(Object.fromEntries(Object.entries(airbagSpace).map(([k,[a,b]])=>[k,a+Math.floor(random()*(b-a+1))])));
});
test('Lifeboat rejects broken copy, launch, attack guard, phase count and premature handoff',()=>{
  for(const [from,to] of [['<copyFrom','copyFrom'],['SPL.B stone,','JMP.B stone,'],['SLT.AB','SLT.B'],['#64, remaining','#63, remaining'],['MOV.I stunBomb, >clearPtr','MOV.I killBomb, >clearPtr'],['JMN.B clearStart, flag','JMP.B clearStart, flag']]) {
    const built=buildAirbag();assert.ok(built.source.includes(from));
    built.source=built.source.replace(from,to);built.w=compile(built.source,'redcode',built.settings);
    assert.throws(()=>verifyAirbag(built),/failed|fallback|count|stun/i);
  }
});
test('Lifeboat generator stays equivalent after parameter tuning and rejects wrong field',()=>{
  const source=airbagGenerator();assert.deepEqual(parseTunable(source).space,airbagSpace);
  const P={...airbagDefaults,BOOT:0,PHASE:0,BACKWARD:1,STEP:50000};
  const b=buildAirbag(P), w=compile(withConstants(source,P),'javascript',b.settings);
  const code=w=>w.instructions.map(({line,...x})=>x);
  assert.equal(w.ok,true);assert.deepEqual(code(w),code(b.w));assert.equal(w.start,b.w.start);
  assert.equal(compile(source,'javascript',{coreSize:8000}).ok,false);
  assert.throws(()=>emitAirbag({...airbagDefaults,HOP:0}),/HOP/);
});
