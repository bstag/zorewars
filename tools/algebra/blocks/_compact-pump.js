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
  knowledge:{parameterRoles:{N:'structural spiral point count',LEAD:'spatial head offset: pFeed+4+LEAD in every mode; coupled to boot placement',IMM:'source-mode choice',RETIRE:'verification permission; no emitted instruction change',SEED:'structural source choice:0 local,1 four-cell head,2 five-cell head,3 early-seed local,4 experimental private bank,5 matched bank-cost/head-read control',SOURCE:'pump-relative template-bank offset in experimental modes4/5; inactive in modes0..3'},
    derived:{stride:'inverse(N,coreSize)',launcherIncrement:'stride+1'},
    tuningGroups:[{name:'preserve-first-seed',parameters:['parent.HOPB','LEAD'],change:{'parent.HOPB':'+d',LEAD:'-d'},operator:'shiftCompactPumpKeepingSeed',requires:'fixed linked source/template layout; recompute with linkedCompactPumpSeed and check the actual first launch after friendly writes'},{name:'linked-stone-imp-options',parameters:['SEED','LEAD','parent.HOPA','parent.HOPB','parent.PATH','parent.PUMPWAIT','parent.PUMPORDER'],operator:'configureStoneImp',requires:'supported direct quickscan/burst/stone-pump family; resolve source layout and requested physical destinations, then full verification'}],
    tuning:['LEAD is a distance, not a delay.','With fixed source layout, changing HOPB by -d and LEAD by +d preserves the first seed. Recompute linked addresses after layout changes.','Worker allocation changes queue timing; four stone workers delayed first compatible imp execution from112 to149 in the tested assembly.','Use configureStoneImp or CLI configure when changing seed mode, route and placement together. Opt-in tune-placement/seed-mode/launcher-path mutations use this interface and full admission before scoring. Normal recipe names preserve the measured images; the local-source recipe is a diagnostic control, not a proven upgrade.'],
    invariants:['N must have an inverse modulo core size.','An active pump must recover in its declared removal scenario.','A retired pump need not regenerate but must have fed real launches and leave compatible imps.','Immediate-source A-field changes can be harmless; stride/mode changes are distinct damage.','For a feeder SPL with immediate A and immediate/direct B, numeric operand changes do not disable splitting. Use the shared semantic predicate instead of byte equality.'],
    protectedSourceKnowledge:['Experimental SEED4 keeps four live copied cells and plants a separate pump+SOURCE template bank in addition to the head. SEED5 has the identical70-cell image/init work except for the carpet source operand, and keeps reading the head. Old modes/default instruction images remain unchanged.','At fixed engines3418/2455/head2523, SOURCE512 puts the bank at2967. Head and bank initialize at15/16, first stone36, pump57 and first compatible imp147. Quiet launch count34 and insurance12 match the head-reading cost control; the69-cell contender starts its imp at146.','A head stride hit at100 yields36 good copies, zero bad copies and12 surviving imps with private source, versus2 good/34 bad/zero imps in the equal-cost head-reader. A bank hit reproduces the34-bad-copy failure. A DAT hit at the head can leave only4 imps despite zero bad copies: correct copying is not re-establishment of a coherent formation.','Four private bank offsets128/256/512/768 all passed full admission, but none beat the contender in the eight-round full1099-opponent screen. Default SOURCE512 is0.0715 percent below contender and about0.1956 percent above its equal-cost control on that screen. No fresh race/confirmation, replacement or rank claim follows.','Real selected battles show both sides of source relocation. Enemy head-source damage spreads bad copies against Disincentive/Ghost Murmur; bank damage does so against BIgital SHOT/Forty. Host restoration of the first consumed source mutation turns each selected loss into a win; an already winning case and an Arvon tie remain unchanged. These are post-hoc sensitivity examples, not full-field prevalence or complete causal ablations.'],
    failures:['Adjacent template stride damage can propagate through carpet copies.','Compatible instruction shape is not process ancestry.','More compatible imps can accompany a dead clear; process counts alone are not competitive strength.','One-cell/lead65 paired change remained inconclusive after six fresh full-field seed sets; it is not the retained champion.'],
    spatialTuningKnowledge:['The original checker rejected thirteen of sixteen nearby STREAM1 stone geometry proposals. A semantic audit recovered stone-plus16: a harmless SPL literal change had falsely stopped intact-launch counting. Twelve remain rejected under the current promised scenarios.','The tested STEP3550 assembly passes the ordinary load-zero phase check with seven compatible imps but fails the planted-target scenario with zero compatible imps. All nine synthetic removals occur before retirement; no stress policy was changed. This is a stress failure, not an illegal program or universal incompatibility.','The completed paired-placement grid tested twelve pump offsets around each of two stone positions. Thirteen of24 variants passed all full scenarios; admitted first launches stayed at2523/119 and first imp execution at2523/149. The best forward16/pump-4/lead68 variant gained0.68 percent versus current and0.33 versus the matching stone control in two fresh40-round confirmations, but matched-control sensitivity crossed zero and no promotion occurred.','A fixed linked seed does not ensure a fixed runtime launch: the rejected forward16/pump-2 profile lost one unit of launcher increment and actually jumped to2522. Relink and inspect actual arithmetic, not just HOPB+LEAD.'],
    auditKnowledge:['Record the role, phase, scenario and failing assumption before describing blocks as incompatible. Audit semantic equivalence and completed deployment first.','The reclaimed plus16 profile makes36 verified launches and leaves20 compatible imps after valid friendly retirement. The earlier two40-round seeds averaged+0.65 percent, but six new80-round full-field seed sets average-0.029 percent, only2/6 positive, with a mean-gain interval of about-0.401 to+0.343 percent. No repeatable strength gain is confirmed; retain the semantic fix and current baseline separately.','Eleven remaining cases fail quiet promised work and one fails the active-pump removal stress. Keep those categories separate from legality and competitive strength.'],
    preseedKnowledge:["The 2026-11-04 seeded trial preserves N7, four stone workers, stone3418, pump2455, first head2523 and the exact linked opening probe set. Use withSeededCompactPump to compensate source-offset changes, not arithmetic guesses from pImp when its state is outside the copied span.","SEED1 hoists its original template into outer seq state and declares bootSeed. Fanboot initializes the head once before splitting, then copies four live cells (one four-worker round rather than two). Head position remains entry+4+LEAD; changing it to entry+span+LEAD would be off by one.","The valid 69-cell SEED1 version plants the head at15 but does not execute a compatible imp until146, versus current149. Stone work and clearing also start three cycles earlier; all modes make34 verified launches and leave12 compatible imps in quiet running. Planted data is not an executing imp.","SEED1 led a12-round full-field screen by0.608 percent, then scored0.416 percent below current on a fresh24-round race. It beats the five-cell/external-source control on both plans, but does not meet the baseline criterion. Current is retained; no40-round confirmation or placement ran.","Reading the head moves the vulnerability: a stride1143-to1142 hit at head2523/cycle100 produces34 incompatible later carpet copies and zero compatible survivors in SEED1/2; baseline and SEED3 keep12 with zero bad copies. Baseline still fails some DAT head hits and local-template hits; this is a tradeoff, not universal baseline immunity.","The52-case diagnostic matrix distinguishes initial-source lifetime, seed damage and copied-template damage, including hits before deployment. Compare matching targets and times, not aggregate pass rates with different available target sets.","SEED2 and SEED3 have the same70-cell footprint, boot work and quiet timing; only their carpet source differs. Keep this clean control when diagnosing source-damage propagation. Source signature damage after the last carpet copy need not violate completed launch purpose."],
    freshFamilyKnowledge:['Fresh 2026-11-04 full-field comparison of current with exact archived Tolypeutes and Armadillo finds paired leads4.25 and0.91 percent on two40-round seeds. Quiet first pump entry is59 versus43 and36; first compatible imp149 versus109 and86. These whole-assembly comparisons do not isolate point count, boot, seed or placement.','Both originals separately plant an imp seed and copy four live pump cells; current copies a four-cell pump plus its template. Shared preseed and separate-path deployments are now implemented and tested, with no accepted replacement. Keep seven-point insurance as a separate control; earlier point-count-only changes did not establish a gain.','Separate PATH2/SEED1 reaches a compatible imp at87 with first stone38 and nine ending compatible imps, against149/38/twelve for current at identical deployed positions. This closes the quiet startup gap but not the demonstrated whole-field strength gap. Shared SEED1/QFAC243 with original burst gained a descriptive0.394% across two fresh plans but failed the predeclared per-seed acceptance bound.'],
    independentEngineKnowledge:['Two same-template pumps cannot each claim the same global compatible-imp pool. The shared role observer intentionally measures instruction compatibility; full fanboot3 verification additionally tracks actual FIFO process descent and requires each engine to retain its own N compatible descendants.','Full verification of six tested dual three-point layouts passed in all seven scenarios. Their 12 host-side four-cell companion removals left the untouched pump launching and surviving, but all lost the eight-round complete-field screen. Runtime independence does not remove shared queue and deployment costs.'],
    evidence:[]},
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
