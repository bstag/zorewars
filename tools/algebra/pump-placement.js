import {blockInstances} from './layout.js';
import {link} from './link.js';
import {modInverse} from './util.js';
const norm=(v,n)=>((v%n)+n)%n;

// This transformation assumes the linked instruction layout stays fixed.
// The caller must relink and check the actual seed address afterward.
export function shiftCompactPumpKeepingSeed(tree,pumpShift,{stoneShift=0}={}){
 if(!Number.isSafeInteger(pumpShift)||!Number.isSafeInteger(stoneShift))throw Error('Placement shifts must be integers');
 const next=structuredClone(tree),fans=[];
 function visit(n){if(n.id==='fanboot'&&n.kids?.[1]?.id==='compact-imp-pump')fans.push(n);for(const k of n.kids??[])visit(k);}visit(next);
 if(fans.length!==1)throw Error('Expected exactly one fanboot with a compact pump as its second member');
 const fan=fans[0],pump=fan.kids[1];
 if(![fan.P?.HOPA,fan.P?.HOPB,pump.P?.LEAD].every(Number.isSafeInteger))throw Error('Materialize HOPA, HOPB and LEAD before shifting');
 const lead=pump.P.LEAD-pumpShift;if(lead<0||lead>200)throw Error('Preserved-seed lead falls outside the compact pump range');
 fan.P.HOPA+=stoneShift;fan.P.HOPB+=pumpShift;pump.P.LEAD=lead;return next;
}

export function linkedCompactPumpSeeds(built){
 if(built.settings.topology==='torus')throw Error('This scalar placement helper supports the ring');
 const pumps=blockInstances(built.root,built.labels,built.spans,built.settings).filter(x=>x.node.id==='compact-imp-pump');
 return pumps.map(p=>{const template=built.labels[p.node.ns+'pImp'],entry=built.labels[p.node.ns+'pFeed'];if(!Number.isSafeInteger(template)||!Number.isSafeInteger(entry))throw Error('Missing linked imp template');return {namespace:p.node.ns,entry:norm(entry+p.shift,built.settings.coreSize),seed:norm(entry+4+p.shift+p.node.P.LEAD,built.settings.coreSize)};});
}
export function linkedCompactPumpSeed(built){
 const pumps=linkedCompactPumpSeeds(built);if(pumps.length!==1)throw Error('Expected one linked compact pump instance');return pumps[0].seed;
}

export function withSeededCompactPump(tree,settings,mode=1){
 if(!Number.isSafeInteger(mode)||mode<0||mode>5||settings.topology==='torus')throw Error('Seed mode must be0..5 on the ring');
 if(tree.id!=='seq'||tree.kids.at(-1)?.id!=='fanboot'||tree.kids.at(-1).kids[0]?.id!=='armadillo-switch'||tree.kids.at(-1).kids[1]?.id!=='compact-imp-pump')throw Error('Expected seq ending with an Armadillo/compact-pump fanboot');
 const before=link(tree,settings),f=before.root.kids.at(-1),stone=before.labels[f.kids[0].ns+'asInc']+f.P.HOPA,pump=before.labels[f.kids[1].ns+'pFeed']+f.P.HOPB,next=structuredClone(tree),fan=next.kids.at(-1);fan.kids[1].P={...fan.kids[1].P,SEED:mode};
 const after=link(next,settings),g=after.root.kids.at(-1);fan.P.HOPA=norm(stone-after.labels[g.kids[0].ns+'asInc'],settings.coreSize);fan.P.HOPB=norm(pump-after.labels[g.kids[1].ns+'pFeed'],settings.coreSize);
 const built={...link(next,settings),settings};if(linkedCompactPumpSeed(built)!==linkedCompactPumpSeed({...before,settings}))throw Error('Preseed transformation moved the first seed');return next;
}

export function withSeparateLauncherPath(tree,settings,{path=1,wait=0,reverse=0,seed=0}={}){
 if(![1,2].includes(path)||!Number.isSafeInteger(wait)||wait<0||wait>12||![0,1].includes(reverse))throw Error('Separate launcher path requires path1/2, wait0..12 and reverse0/1');
 const before=link(tree,settings),f=before.root.kids.at(-1),stone=before.labels[f.kids[0].ns+'asInc']+f.P.HOPA,pump=before.labels[f.kids[1].ns+'pFeed']+f.P.HOPB,next=withSeededCompactPump(tree,settings,seed),fan=next.kids.at(-1);fan.P={...fan.P,PATH:path,PUMPWAIT:wait,PUMPORDER:reverse};const after=link(next,settings),g=after.root.kids.at(-1);
 fan.P.HOPA=norm(stone-after.labels[g.kids[0].ns+'asInc'],settings.coreSize);fan.P.HOPB=norm(pump-after.labels[g.kids[1].ns+'pFeed'],settings.coreSize);if(linkedCompactPumpSeed({...link(next,settings),settings})!==linkedCompactPumpSeed({...before,settings}))throw Error('Separate path moved the first head');return next;
}

// A bounded architecture proposal, not a promise of behavior or strength.
// Preserve the first seed and stone placement through the new source layout.
export function withIndependentImpEngines(tree,settings,{secondEntry,firstShift=0,firstPoints=7,secondPoints=7,secondLead=64,stoneWorkers=4}={}){
 if(settings.topology==='torus')throw Error('Independent pump proposal supports the ring');
 if(![secondEntry,firstShift,firstPoints,secondPoints,secondLead,stoneWorkers].every(Number.isSafeInteger)||secondEntry<0||secondEntry>=settings.coreSize)throw Error('Independent pump placements and parameters must be integers in the ring');
 if(![2,3,4,6,8,12,16].includes(stoneWorkers))throw Error('Independent pump fan N must be 2, 3, 4, 6, 8, 12 or 16');
 if([firstPoints,secondPoints].some(n=>n<3||n>31||!modInverse(n,settings.coreSize)))throw Error('Independent pump point counts need an inverse and must be in3..31');
 if(secondLead<0||secondLead>200)throw Error('Second pump lead is outside the pump range');
 const original=link(tree,settings),instances=blockInstances(original.root,original.labels,original.spans,settings),pumps=instances.filter(x=>x.node.id==='compact-imp-pump');
 if(pumps.length!==1||tree.id!=='seq'||tree.kids.at(-1)?.id!=='fanboot'||tree.kids.at(-1).kids[1]?.id!=='compact-imp-pump')throw Error('Expected a seq ending in a two-member fanboot with one compact pump');
 const next=structuredClone(tree),fan=next.kids.at(-1),pump=fan.kids[1],old=original.root.kids.at(-1);
 const stoneAt=original.labels[old.kids[0].ns+'asInc']+old.P.HOPA,pumpAt=original.labels[old.kids[1].ns+'pFeed']+old.P.HOPB;
 if(!Number.isInteger(stoneAt))throw Error('Expected an Armadillo first member');
 pump.P={...pumps[0].node.P,...pump.P,N:firstPoints};pump.P.LEAD-=firstShift;if(pump.P.LEAD<0||pump.P.LEAD>200)throw Error('Preserved-seed lead is outside the pump range');
 fan.id='fanboot3';fan.P={N:stoneWorkers,MOREA:1,HOPA:2000,HOPB:4000,HOPC:6000,EXACT:1};fan.kids.push({id:'compact-imp-pump',P:{...pump.P,N:secondPoints,LEAD:secondLead}});
 const b=link(next,settings),f=b.root.kids.at(-1);fan.P.HOPA=norm(stoneAt-b.labels[f.kids[0].ns+'asInc'],settings.coreSize);fan.P.HOPB=norm(pumpAt+firstShift-b.labels[f.kids[1].ns+'pFeed'],settings.coreSize);fan.P.HOPC=norm(secondEntry-b.labels[f.kids[2].ns+'pFeed'],settings.coreSize);
 const seeds=linkedCompactPumpSeeds({...link(next,settings),settings});if(seeds[0].seed!==linkedCompactPumpSeed({...original,settings}))throw Error('Independent pump proposal moved the original seed');
 return next;
}
