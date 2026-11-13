import assert from 'node:assert/strict';
import {summarizeReplication} from './replication.js';

// A fixed two-by-two replication. Seed sets, rather than opponents, are the
// replicates for the primary uncertainty estimate. Component tests are secondary.
export function summarizeFactorialReplication(records,options){
 const ids=['baseline','candidate','scan-only','seed-only'];
 for(const r of records){assert.equal(r.results.length,4);assert.deepEqual(new Set(r.results.map(x=>x.id)),new Set(ids));}
 const compare=(a,b)=>summarizeReplication(records.map(r=>({...r,results:[{...r.results.find(x=>x.id===a),id:'baseline'},{...r.results.find(x=>x.id===b),id:'candidate'}]})),options);
 const primary=compare('baseline','candidate'),components={scanOnly:compare('baseline','scan-only'),seedOnly:compare('baseline','seed-only'),addingSeed:compare('scan-only','candidate'),addingScan:compare('seed-only','candidate')};
 const seeds=primary.seeds.map((s,i)=>({seed:s.seed,delta:s.delta-components.scanOnly.seeds[i].delta-components.seedOnly.seeds[i].delta}));
 const mean=seeds.reduce((n,x)=>n+x.delta,0)/seeds.length,sd=Math.sqrt(seeds.reduce((n,x)=>n+(x.delta-mean)**2,0)/(seeds.length-1)),se=sd/Math.sqrt(seeds.length),interval=[mean-options.critical*se,mean+options.critical*se];
 return {primary,components,interaction:{seeds,meanPairedPoints:mean,relativePct:100*mean/primary.baseline,seedMean95:interval,seedMean95RelativePct:interval.map(x=>100*x/primary.baseline),scope:'Combined minus scan-only minus seed-only plus baseline, paired within each seed. Exploratory, no multiplicity correction.'},newFieldRounds:primary.totalFieldRounds*2,scope:'Primary test is candidate versus baseline only. Component intervals are secondary, nominal and not multiplicity corrected. No prior evidence is pooled.'};
}
