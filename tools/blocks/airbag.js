// Original 94x stone/fallback recipe. Unlike the public reference, this boots
// one contiguous image and gives the watchdog exclusive ownership of the clear.
import { compile, RULESETS, VM } from '../../src/engine/index.js';

export const airbagDefaults = { BOOT: 1, STEP: 2019, HOP: 18000, SHOTS: 512, BOMB: 0, BACKWARD: 0, PHASE: 1, STUN: 64 };
export const airbagSpace = { BOOT: [0,1], STEP: [1,55439], HOP: [256,54000], SHOTS: [16,2048], BOMB: [0,1], BACKWARD: [0,1], PHASE: [0,2], STUN: [1,4096] };

export function emitAirbag(P) {
  if (Object.keys(P).length !== Object.keys(airbagSpace).length) throw new Error('Unexpected airbag parameters');
  for (const [key,[lo,hi]] of Object.entries(airbagSpace)) if (!Number.isSafeInteger(P[key]) || P[key]<lo || P[key]>hi) throw new Error(`Invalid ${key}`);
  const lines = [';name Lifeboat 94x', ';author ZoreWars', ';strategy Booted guarded stone; independent watchdog takes over with a bounded clear.',
    `; Parameters ${JSON.stringify(P)}`, ';assert CORESIZE == 55440', 'payloadSize EQU (payloadEnd-payload)', 'payloadEnd EQU (killBomb+1)', `ORG ${P.BOOT?'boot':'launch'}`];
  const emit = (label,op,a,b='0') => lines.push(`${label ?? ''} ${op} ${a}, ${b}`);
  if(P.BOOT) {
  emit('boot','MOV.I','<copyFrom','<copyTo');
  emit(null,'DJN.B','boot','copyCount');
  emit(null,'JMP.B',`boot+${P.HOP}+(launch-payload)`);
  emit('copyFrom','DAT.F','#0','#(payloadEnd-copyFrom)');
  emit('copyTo','DAT.F','#0',`#(boot+${P.HOP}+payloadSize-copyTo)`);
  emit('copyCount','DAT.F','#0','#payloadSize');
  }
  // These data cells travel with the payload; the probe is offset zero there.
  emit('payload','DAT.F','#0','#payloadSize');
  emit('shots','DAT.F','#0',`#${P.SHOTS}`);
  emit('watchCount','DAT.F','#0',`#${P.SHOTS*2+32}`);
  emit('flag','DAT.F','#0','#0');
  emit('stoneRef','ADD.AB',`#${P.STEP}`,'payload-stone');
  emit('launch','SPL.B','stone');
  emit('watch','SEQ.I','stone','stoneRef');
  emit(null,'JMP.B','clearStart');
  emit(null,'JMN.B','clearStart','flag');
  emit(null,'DJN.B','watch','watchCount');
  emit(null,'JMP.B','clearStart');
  emit('stone','ADD.AB',`#${P.STEP}`,'payload');
  emit(null,'SLT.AB','#(payloadSize-1)','payload');
  emit(null,'JMP.B','tick');
  emit('attack','MOV.I',P.BOMB ? 'stunBomb' : 'killBomb','@payload');
  emit('tick','DJN.B','stone','shots');
  emit(null,'MOV.AB','#1','flag');
  emit('retire','DAT.F','#0','#0'); // intentional child retirement, not warrior suicide
  const first = P.BACKWARD ? '(payload-clearPtr)' : '(payloadEnd-clearPtr)';
  const target = P.BACKWARD ? '<clearPtr' : '>clearPtr';
  lines.push('clearStart');
  if (P.PHASE) {
    emit(null,'MOV.AB',`#${first}`,'clearPtr');
    emit(null,'MOV.AB',P.PHASE===2?'#(CORESIZE-payloadSize)':`#${P.STUN}`,'remaining');
    emit('stunLoop','MOV.I','stunBomb',target);
    emit(null,'DJN.B','stunLoop','remaining');
  }
  emit('reset','MOV.AB',`#${first}`,'clearPtr');
  emit(null,'MOV.AB','#(CORESIZE-payloadSize)','remaining');
  emit('killLoop','MOV.I','killBomb',target);
  emit(null,'DJN.B','killLoop','remaining');
  emit(null,'JMP.B','reset');
  emit('clearPtr','DAT.F','#0','#0');
  emit('remaining','DAT.F','#0','#0');
  emit('stunBomb','SPL.B','#0','#0');
  emit('killBomb','DAT.F','#0','#0');
  lines.push('END');
  return lines.join('\n')+'\n';
}

export function verifyAirbag(built, { faults = ['guard','unwatched'] } = {}) {
  const {w,source,P,settings} = built;
  if (!w?.ok || settings.coreSize!==55440 || settings.maxCycles!==500000) throw new Error('Full 94x settings required');
  const norm = x => (x%settings.coreSize+settings.coreSize)%settings.coreSize;
  const entry = label => {
    const c=compile(source.replace(/^ORG .*$/m,`ORG ${label}`).replace(/^END\b.*$/m,`END ${label}`),'redcode',settings);
    if(!c.ok) throw new Error(`Missing label ${label}`);
    return c.start;
  };
  const start=entry('payload'), size=w.instructions.length-start;
  const labels=Object.fromEntries(['launch','watch','stone','shots','watchCount','flag','attack','tick','clearStart','killLoop','clearPtr','remaining','retire'].map(x=>[x,entry(x)-start]));
  if(P.PHASE) labels.stunLoop=entry('stunLoop')-start;
  const template=w.instructions.slice(start), fields=['op','mod','aMode','bMode'];
  const same=(a,b)=>fields.every(k=>a[k]===b[k]) && norm(a.a)===norm(b.a) && norm(a.b)===norm(b.b);
  const mutable=new Set([0,...['shots','watchCount','flag','clearPtr','remaining'].map(x=>labels[x])]);
  const scenarios=[{base:0},{base:55433},...(P.BOOT?[{base:norm(settings.coreSize-P.HOP-Math.ceil(size/2))}]:[]),...faults.map(fault=>({base:0,fault}))];
  const observations=[];
  for(const {base,fault} of scenarios) {
    if(fault && !['guard','unwatched'].includes(fault)) throw new Error('Unknown fault scenario');
    const vm=new VM(settings);vm.load([w],{positions:[base]});
    const target=norm(base+(P.BOOT?P.HOP:0)), at=label=>norm(target+labels[label]);
    while(!vm.done && vm.cycle<200 && !vm.processes(0).includes(at('launch')))vm.step();
    if(!vm.processes(0).includes(at('launch')) || !template.every((x,i)=>same(x,vm.peek(norm(target+i)))))throw new Error('Boot copy/entry failed');
    const arrivedAt=vm.cycle;
    let injected=null;
    if(fault) {
      injected=labels[fault==='guard'?'stone':'tick'];
      vm.poke(norm(target+injected),{op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0},-1);
    }
    let writes=0, clearAt=null, stunWrites=0, firstDatAt=null;
    while(!vm.done && firstDatAt===null) {
      const event=vm.step();
      if(event?.pc===at('attack') && injected!==labels.attack) {
        const offset=vm.b[target];
        if(offset<size || vm.writerPc[norm(target+offset)]!==event.pc || vm.peek(norm(target+offset)).op!==(P.BOMB?'SPL':'DAT'))throw new Error('Stone write/protection failed');
        writes++;
      }
      if(event?.pc===at('clearStart') && clearAt===null) {
        clearAt=vm.cycle;
        if(!fault && (vm.b[at('shots')]!==0 || vm.b[at('flag')]!==1))throw new Error('Premature fallback');
        if(fault==='unwatched' && vm.b[at('watchCount')]!==0)throw new Error('Timeout fallback bypassed');
      }
      if(P.PHASE && event?.pc===at('stunLoop')) {
        const cell=norm(target+(P.BACKWARD?-1:size)+(P.BACKWARD?-stunWrites:stunWrites));
        if(vm.peek(cell).op!=='SPL' || vm.writerPc[cell]!==event.pc)throw new Error('Wrong stun destination or bomb');
        stunWrites++;
      }
      if(event?.pc===at('killLoop')) {
        const first=norm(target+(P.BACKWARD?-1:size));
        if(vm.peek(first).op!=='DAT' || vm.writerPc[first]!==event.pc)throw new Error('DAT clear did not reset to the payload boundary');
        firstDatAt=vm.cycle;
      }
    }
    if(clearAt===null || firstDatAt===null)throw new Error('Fallback never reached DAT');
    const expectedStun=P.PHASE===0?0:P.PHASE===2?settings.coreSize-size:P.STUN;
    if(stunWrites!==expectedStun)throw new Error('Wrong stun count');
    if(!fault) {
      let expected=0;for(let i=1;i<=P.SHOTS;i++)if(norm(size+i*P.STEP)>=size)expected++;
      if(writes!==expected)throw new Error('Wrong stone attack count');
    }
    vm.run();
    if(!vm.warriors[0].alive || vm.cycle!==settings.maxCycles || vm.warriors[0].peak!==2 || vm.processes(0).length!==1)throw new Error('Process ownership/survival contract failed');
    if(!template.every((x,i)=>i===injected || same(x,{...vm.peek(norm(target+i)),...(mutable.has(i)?{b:x.b}:{})})))throw new Error('Payload damaged protected code');
    observations.push({base,fault:fault??'none',arrivedAt,openingWrites:writes,clearAt,stunWrites,firstDatAt,peakProcesses:2,finalProcesses:1,survives:true});
  }
  if(observations.some(x=>x.fault==='guard' && x.clearAt>=observations[0].clearAt))throw new Error('Guard damage did not accelerate fallback');
  return {ok:true,payloadLength:size,observations,scope:'Exact contiguous copy, two-process launch, attack coverage, normal/guard/timeout transitions, full solo survival; not arbitrary enemy-write immunity'};
}

export function buildAirbag(P=airbagDefaults) {
  const source=emitAirbag(P), settings={...RULESETS['94x'],maxLength:50};
  const w=compile(source,'redcode',settings);
  if(!w.ok)throw new Error(JSON.stringify(w.errors));
  const built={P:{...P},source,settings,w};
  built.verification=verifyAirbag(built);
  return built;
}

export function airbagGenerator(P=airbagDefaults) {
  return `// Original ZoreWars recipe. Verify with buildAirbag after tuning.\n// SPACE ${JSON.stringify(airbagSpace)}\nconst P = ${JSON.stringify(P)};\nconst airbagSpace = ${JSON.stringify(airbagSpace)};\n${emitAirbag.toString()}\nif (CORESIZE!==55440 || SIZEY!==1 || SIZEZ!==1) throw new Error('Lifeboat requires the 94x ring');\nraw(emitAirbag(P));\n`;
}
