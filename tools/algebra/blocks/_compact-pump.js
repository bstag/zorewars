// Supported compact growing imp pump; the legacy filename preserves imports.
// No ALGEBRA_DRAFTS activation is needed. The four-instruction pump feeds one
// chain per queue pass; the fifth cell is its imp template. It launches at
// STEP+1 intervals while laying a one-cell carpet for the spiral's head.
import {modInverse} from '../util.js';
import {observeCompactPump,verifyCompactPump,compactPumpCellCompatible} from '../observation-roles.js';
const norm=(x,n)=>((x%n)+n)%n;
const zero={op:'DAT',mod:'F',aMode:'#',a:0,bMode:'#',b:0};
export const compatibleImp=(i,template,core)=>i.op==='MOV'&&i.mod==='I'&&i.aMode===template.aMode&&i.bMode==='$'
  &&norm(i.b,core)===norm(template.b,core)&&(template.aMode==='#'||norm(i.a,core)===0);
const compact={
  id:'compact-imp-pump',status:'supported',testedProfiles:['94nop'],kind:'body',exit:'never',processes:2,grows:true,writes:'sparse',roams:true,layout:'last',dialects:'94',
  purpose:'Growing N-point imp pump. SEED0 copies four live cells plus a local template. SEED1 seeds the head before fanboot and copies only four live cells; SEED2 keeps the fifth copied cell while reading the head, and SEED3 seeds early but reads the local template. Experimental SEED4 separately plants a template bank at pump+SOURCE and reads it with four live cells; SEED5 pays the same initialization cost but still reads the head. IMM1 uses an immediate source. RETIRE1 permits completed friendly retirement with surviving insurance.',
  params:{N:[3,31],LEAD:[0,200],IMM:[0,1],RETIRE:[0,1],SEED:[0,5],SOURCE:[128,54000]},defaults:{N:3,LEAD:0,IMM:0,RETIRE:0,SEED:0,SOURCE:512},entry:'pFeed',
  bootSeed:P=>!P.SEED?null:P.SEED>=4?[{source:'pImp',entry:'pFeed',offset:4+P.LEAD},{source:'pImp',entry:'pFeed',offset:P.SOURCE}]:{source:'pImp',entry:'pFeed',offset:4+P.LEAD},
  observationRole:'imp-pump',observe:observeCompactPump,verifyObservation:verifyCompactPump,
  phaseContract:{minimumLaunchAttempts:'2*N',minimumCompatibleSurvivors:'N',retirement:'first fault friendly and outside the pump, after actual feeding'},
  knowledge: { parameterRoles: { N: 'Spiral point count', LEAD: 'Distance from the deployed launcher to its first imp', IMM: 'Use an immediate imp source', RETIRE: 'Allow retirement after the pump establishes its formation', SEED: 'Template placement and copy mode', SOURCE: 'Template bank offset for SEED 4 or 5' } },
  mutable:[['pJump',['a','b']]],
  mismatches(P,settings){
    const s=modInverse(P.N,settings.coreSize),out=[];
    if(!s)return [`compact-imp-pump: no ${P.N}-point spiral on ${settings.coreSize} cells`];
    if(settings.maxProcesses<64)out.push('compact-imp-pump needs at least64 processes');
    const size=[1,4,5].includes(P.SEED)?4:5;
    if(P.SEED>=4){const source=norm(P.SOURCE,settings.coreSize),head=norm(4+P.LEAD,settings.coreSize);if(source<4||norm(source-head,settings.coreSize)<8*P.N)out.push('SOURCE must avoid the live pump and first8*N head-carpet cells');for(let k=0;k<4*P.N;k++)if(norm(head+k*(s+1),settings.coreSize)===source){out.push('SOURCE collides with an early imp launch');break;}}
    for(let k=1;k<4*P.N;k++){const d=norm(4+P.LEAD+k*(s+1),settings.coreSize);if(d<size||d>settings.coreSize-settings.maxLength){out.push('compact-imp-pump: an early arm lands on or behind the pump');break;}}
    return out;
  },
  state(ctx){if([1,4,5].includes(ctx.P.SEED))ctx.ins('pImp','MOV','I',ctx.P.IMM?'#0':'0',`${modInverse(ctx.P.N,ctx.core)}`);},
  emit(ctx){
    const {L,P,core}=ctx,s=modInverse(P.N,core),d=norm(s+1,core);
    ctx.ins('pFeed','SPL','B','#0','0');
    const head=P.SEED?`${L('pFeed')}+4+${P.LEAD}`:`${L('pImp')}+${P.LEAD}`,external=[1,2,5].includes(P.SEED),source=P.SEED===4?`${L('pFeed')}+${P.SOURCE}`:external?head:L('pImp');
    ctx.ins('pCarpet','MOV','I',source,`>${L('pJump')}`);
    ctx.ins('pStep','ADD','A',`#${d}`,L('pJump'));
    ctx.ins('pJump','JMP','B',`${head}-${L('pJump')}-${d}`,`${head}-${L('pJump')}`);
    if(![1,4,5].includes(P.SEED))ctx.ins('pImp','MOV','I',P.IMM?'#0':'0',`${s}`);
  },
  running(api){const t=api.code('pImp');return api.vm.processes(0).some(pc=>compatibleImp(api.vm.peek(pc),t,api.core));},
  plant:()=>[],
  watch(api){
    const {vm,P,core}=api,t=api.code('pImp'),launch=api.at('pJump'),d=norm(t.b+1,core),seed=api.norm(api.at('pFeed')+4+P.LEAD);
    const isImp=pc=>compatibleImp(vm.peek(pc),t,core),count=()=>vm.processes(0).filter(isImp).length;
    const pump=Array.from({length:4},(_,k)=>[api.at('pFeed',k),api.code('pFeed',k)]);
    const pumpCellIntact=(pc,x)=>compactPumpCellCompatible(vm.peek(pc),x,norm(pc-api.at('pFeed'),core),core);
    const intact=()=>pump.every(([pc,x])=>pumpCellIntact(pc,x));
    const planted=api.scenario==='compact-imp-pump: planted target';
    let launches=0,entered=false,victims=null,killed=0,before=null,low=Infinity,firstFaultFriendly=null;
    return {
      before(pc){
        if(pc===api.entry())entered=true;
        if(victims?.delete(pc)){vm.poke(pc,zero);killed++;}
        if(pc===launch&&intact()){
          const target=api.norm(launch+vm.peek(launch).a),want=api.norm(seed+launches*d);
          if(target!==want)throw Error(`compact-imp-pump: launch ${launches} targets ${target}, expected ${want}`);
          launches++;
        }
      },
      after(){
        // Preserve the cause of the first structural fault. A process can
        // subsequently execute the friendly DAT, change its neighbour, and
        // have the carpet copy that neighbour over the jump. Looking only
        // at the final writer then incorrectly calls the retirement suicide.
        if(entered&&firstFaultFriendly===null&&!intact())firstFaultFriendly=pump.some(([pc,x])=>!pumpCellIntact(pc,x)&&vm.owner[pc]===0&&vm.writerPc[pc]>=0&&!api.inSelf(vm.writerPc[pc]));
        if(!planted||!entered)return;
        // Refill is a promise of an active pump. Once a partner has retired
        // it, removing alternating spiral processes can destroy every arm;
        // the same attack also destroys the baseline and original Armadillo.
        // Retirement is checked separately below, with surviving descendants.
        if(vm.cycle===8000&&intact()){const imps=vm.processes(0).filter(isImp);before=imps.length;victims=new Set(imps.filter((_,i)=>i%2===0));}
        else if(before!==null)low=Math.min(low,count());
      },
      final(){
        if(!entered)return;
        if(launches<2*P.N)throw Error(`compact-imp-pump: only ${launches} launches`);
        const n=count();if(n<P.N)throw Error(`compact-imp-pump: only ${n} compatible imps survive, needs ${P.N}`);
        const retired=P.RETIRE&&!api.alone&&!intact()&&firstFaultFriendly===true;
        if(!intact()&&!retired)throw Error('compact-imp-pump: stopped without permitted friendly retirement');
        if(planted&&!retired&&(!killed||!(low<before)||n<before))throw Error(`compact-imp-pump did not refill after the planted kill (${before}/${low}/${n}, killed${killed})`);
      },
    };
  },
};
export default compact;
