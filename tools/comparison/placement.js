import assert from 'node:assert/strict';
export function placeEntrant(archivePoints,rows,rounds){
 assert.ok(Number.isSafeInteger(rounds)&&rounds>0);assert.ok(archivePoints.length>0);assert.equal(rows.length,archivePoints.length);assert.ok(archivePoints.every(n=>Number.isSafeInteger(n)&&n>=0));
 let points=0;const updatedArchive=rows.map((r,i)=>{assert.equal(r.index,i);assert.ok([r.w,r.l,r.t].every(n=>Number.isSafeInteger(n)&&n>=0));assert.equal(r.w+r.l+r.t,rounds);points+=3*r.w+r.t;return archivePoints[i]+3*r.l+r.t;});
 const rank=1+updatedArchive.filter(p=>p>points).length,rankEnd=1+updatedArchive.filter(p=>p>=points).length;
 return {points,score:points/(rows.length*rounds),placement:{rank,rankEnd,of:rows.length+1},updatedArchive};
}
export function summarizePlacements(results){
 assert.ok(results.length>0);const middles=results.map(r=>(r.placement.rank+r.placement.rankEnd)/2).sort((a,b)=>a-b),n=middles.length;
 return {median:n%2?middles[(n-1)/2]:(middles[n/2-1]+middles[n/2])/2,best:Math.min(...results.map(r=>r.placement.rank)),worst:Math.max(...results.map(r=>r.placement.rankEnd)),mean:middles.reduce((s,x)=>s+x,0)/n,plans:n};
}
