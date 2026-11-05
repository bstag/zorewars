// Matched linear contrasts, retaining opponent correlations. These describe
// one measured plan set; they are not future-seed or multiplicity guarantees.
export function summarizeMatchedFactorial(record,definitions,dimensions){
 if(dimensions.length!==3||dimensions.some(n=>!Number.isSafeInteger(n)||n<2))throw Error('Expected three factorial dimensions of at least two');
 const key=v=>v.join('/'),defs=new Map(),ids=new Set(),results=new Map(record.results.map(r=>[r.id,r]));
 if(results.size!==record.results.length)throw Error('Duplicate field ID');
 for(const d of definitions){if(d.vector.length!==3||d.vector.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>=dimensions[i])||ids.has(d.id)||defs.has(key(d.vector)))throw Error('Invalid or duplicate factorial definition');defs.set(key(d.vector),d);ids.add(d.id);}
 if(defs.size!==dimensions.reduce((a,b)=>a*b,1))throw Error('Definitions must cover the complete factorial');
 if(!Number.isSafeInteger(record.rounds)||record.rounds<1)throw Error('Invalid round count');
 let names=null;const points=new Map();for(const r of record.results){if(!ids.has(r.id))throw Error('Undeclared field ID');if(!r.rows.length)throw Error('Empty field');const p=r.rows.map((x,i)=>{if(x.index!==i||![x.w,x.l,x.t].every(n=>Number.isSafeInteger(n)&&n>=0)||x.w+x.l+x.t!==record.rounds)throw Error('Invalid matched W/L/T row');return (3*x.w+x.t)/record.rounds;});const n=r.rows.map(x=>x.name);if(names&&JSON.stringify(names)!==JSON.stringify(n))throw Error('Opponent order mismatch');names??=n;points.set(r.id,p);}
 const mean=a=>a.reduce((n,x)=>n+x,0)/a.length,base=defs.get('0/0/0'),baseline=points.has(base.id)?mean(points.get(base.id)):null;if(!(baseline>0))throw Error('Measured positive baseline required');
 function contrast(terms){const combined=new Map();for(const [vector,weight]of terms){const id=defs.get(key(vector)).id;combined.set(id,(combined.get(id)??0)+weight);}const termsById=[...combined].filter(([,w])=>w),missing=termsById.filter(([id])=>!points.has(id)).map(([id])=>id);if(missing.length)return {complete:false,missing,terms:termsById};
  const values=names.map((_,i)=>termsById.reduce((n,[id,w])=>n+w*points.get(id)[i],0)),delta=mean(values),se=values.length>1?Math.sqrt(values.reduce((n,x)=>n+(x-delta)**2,0)/(values.length-1)/values.length):0;return {complete:true,terms:termsById,delta,relativeToBaselinePct:100*delta/baseline,opponentSensitivity95:[delta-1.96*se,delta+1.96*se]};
 }
 const cells=[...defs.values()].map(d=>{const p=points.get(d.id);return {...d,measured:!!p,score:p?mean(p):null,gain:p?contrast([[d.vector,1],[[0,0,0],-1]]):null};}),triples=[],pairs=[];
 for(let b=1;b<dimensions[0];b++)for(let s=1;s<dimensions[1];s++)pairs.push({vector:[b,s,0],contrast:contrast([[[b,s,0],1],[[b,0,0],-1],[[0,s,0],-1],[[0,0,0],1]])});
 for(let b=1;b<dimensions[0];b++)for(let r=1;r<dimensions[2];r++)pairs.push({vector:[b,0,r],contrast:contrast([[[b,0,r],1],[[b,0,0],-1],[[0,0,r],-1],[[0,0,0],1]])});
 for(let s=1;s<dimensions[1];s++)for(let r=1;r<dimensions[2];r++)pairs.push({vector:[0,s,r],contrast:contrast([[[0,s,r],1],[[0,s,0],-1],[[0,0,r],-1],[[0,0,0],1]])});
 for(let b=1;b<dimensions[0];b++)for(let s=1;s<dimensions[1];s++)for(let r=1;r<dimensions[2];r++)triples.push({vector:[b,s,r],id:defs.get(key([b,s,r])).id,totalNonadditivity:contrast([[[b,s,r],1],[[b,0,0],-1],[[0,s,0],-1],[[0,0,r],-1],[[0,0,0],2]]),threeWayInteraction:contrast([[[b,s,r],1],[[b,s,0],-1],[[b,0,r],-1],[[0,s,r],-1],[[b,0,0],1],[[0,s,0],1],[[0,0,r],1],[[0,0,0],-1]])});
 return {dimensions,opponents:names.length,rounds:record.rounds,baseline,cells,pairs,triples,complete:points.size===defs.size,scope:'Descriptive contrasts on common opponent/round plans. Total nonadditivity includes pairwise and three-way effects. Opponent sensitivity bounds are not future-seed confidence and are not corrected for selecting among many cells.'};
}
