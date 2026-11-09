import {link,treeMismatches,definition} from './link.js';
import {linkedCompactPumpSeeds} from './pump-placement.js';
const norm=(x,n)=>((x%n)+n)%n;
const allowed=new Set(['seedMode','sourceOffset','path','wait','reverse','exact','pumpShift','stoneShift','seedShift','lead','scan','burst']);
function assembly(tree,settings){
 if(settings.topology==='torus')throw Error('Stone/imp configuration supports the ring only');
 if(tree.id!=='seq'||tree.kids?.length!==3||tree.kids[0].id!=='opening-qscan-mul'||tree.kids[1].id!=='probe-burst2'||tree.kids[2].id!=='fanboot'||tree.kids[2].kids?.[0]?.id!=='armadillo-switch'||tree.kids[2].kids?.[1]?.id!=='compact-imp-pump')throw Error('Expected quickscan, burst and Armadillo/compact-pump fanboot');
 const mismatches=treeMismatches(tree,settings);if(mismatches.length)throw Error(mismatches.join('; '));
 const b={...link(tree,settings),settings};if(b.misfits.length)throw Error(b.misfits.join('; '));if(b.total>settings.maxLength)throw Error(`Configuration needs ${b.total} instructions; budget ${settings.maxLength}`);return b;
}
function layout(b){const f=b.root.kids[2],p=f.kids[1],seed=linkedCompactPumpSeeds(b);if(seed.length!==1)throw Error('Expected one compact pump');return {stone:norm(b.labels[f.kids[0].ns+'asInc']+f.P.HOPA,b.settings.coreSize),pump:seed[0].entry,seed:seed[0].seed,lead:p.P.LEAD,seedMode:p.P.SEED,path:f.P.PATH,wait:f.P.PUMPWAIT,reverse:f.P.PUMPORDER,stoneWorkers:f.P.SPLIT?f.P.N-1+f.P.MOREA:f.P.K*f.P.N,points:p.P.N,instructions:b.total,copyCells:[...f.fan.M],sourceOffset:p.P.SOURCE,sourceBank:p.P.SEED>=4?norm(seed[0].entry+p.P.SOURCE,b.settings.coreSize):null};}
export function stoneImpLayout(tree,settings){return layout(assembly(tree,settings));}

// A proposal, not a behavior/fitness verdict. Build with full verification next.
// Defaults preserve all three physical destinations even if source layout changes.
export function configureStoneImp(tree,settings,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Options must be an object');
 for(const key of Object.keys(options))if(!allowed.has(key))throw Error('Unknown stone/imp option: '+key);
 for(const key of ['seedMode','sourceOffset','path','wait','reverse','exact','pumpShift','stoneShift','seedShift','lead'])if(options[key]!==undefined&&!Number.isSafeInteger(options[key]))throw Error(key+' must be an integer');
 if(options.lead!==undefined&&options.seedShift!==undefined)throw Error('Choose lead or seedShift, not both');
 const before=layout(assembly(tree,settings)),next=structuredClone(tree),f=next.kids[2],p=f.kids[1];
 if(options.seedMode!==undefined)p.P={...p.P,SEED:options.seedMode};
 if(options.sourceOffset!==undefined){if((p.P.SEED??0)<4)throw Error('sourceOffset requires seed mode4/5');p.P={...p.P,SOURCE:options.sourceOffset};}
 if(options.path!==undefined)f.P={...f.P,PATH:options.path};
 if(options.wait!==undefined)f.P={...f.P,PUMPWAIT:options.wait};
 if(options.reverse!==undefined)f.P={...f.P,PUMPORDER:options.reverse};
 if(options.exact!==undefined)f.P={...f.P,EXACT:options.exact};
 if(options.path===0)f.P={...f.P,PUMPWAIT:0,PUMPORDER:0};
 if((options.wait!==undefined||options.reverse!==undefined)&&!(f.P.PATH??0))throw Error('wait/reverse require a separate path');
 for(const [key,index]of [['scan',0],['burst',1]])if(options[key]!==undefined){const patch=options[key];if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error(key+' must be a parameter object');for(const name of Object.keys(patch))if(!Object.hasOwn(definition(next.kids[index].id).params,name))throw Error('Unknown '+key+' parameter: '+name);next.kids[index].P={...next.kids[index].P,...patch};}
 const stone=norm(before.stone+(options.stoneShift??0),settings.coreSize),pump=norm(before.pump+(options.pumpShift??0),settings.coreSize),seed=options.lead===undefined?norm(before.seed+(options.seedShift??0),settings.coreSize):norm(pump+4+options.lead,settings.coreSize),lead=norm(seed-pump-4,settings.coreSize);
 if(lead>200)throw Error('Requested pump/seed placement needs lead outside0..200');p.P={...p.P,LEAD:lead};
 // Link the changed source first, then compensate source-relative displacements.
 // This preliminary image may overlap; only the compensated image is admitted.
 const changed=link(next,settings),g=changed.root.kids[2];f.P={...f.P,HOPA:norm(stone-changed.labels[g.kids[0].ns+'asInc'],settings.coreSize),HOPB:norm(pump-changed.labels[g.kids[1].ns+'pFeed'],settings.coreSize)};
 const after=layout(assembly(next,settings));if(after.stone!==stone||after.pump!==pump||after.seed!==seed)throw Error('Linked configuration failed to preserve requested destinations');
 return {tree:next,before,after,preserved:{stone:before.stone===after.stone,pump:before.pump===after.pump,seed:before.seed===after.seed},scope:'Linked validity and requested geometry only; full behavior verification and matched field testing are separate requirements.'};
}
