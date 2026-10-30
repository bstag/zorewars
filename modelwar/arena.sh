#!/bin/bash
# usage: arena.sh warrior [rounds] [seed] -> ModelWar arena scores (90 split among each round's survivors)
# ARENA holds the real arena warriors (from /api/arenas/<id>/replay); 3 DAT feeders fill the slots to 10.
: "${ARENA:?set ARENA to a folder of arena warrior .red files}"
W="$1"; R="${2:-50}"; SEED="${3:-1}"
cd "$(dirname "$0")/.."
node cli/zorewars.js battle "$W" "$ARENA"/*.red modelwar/feeder.red modelwar/feeder.red modelwar/feeder.red -r $R --seed $SEED --json | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const n=j.warriors.length;const t=Array(n).fill(0),surv=Array(n).fill(0);
for(const r of j.rounds){for(const i of r.survivors){t[i]+=90/r.survivors.length;surv[i]++}}
const rows=j.warriors.map((w,i)=>({name:w.name,score:Math.round(t[i]),surv:surv[i]})).filter(x=>x.name!=="AutoFeed").sort((a,b)=>b.score-a.score);
rows.forEach((x,k)=>console.log(`${k+1}. ${x.name.padEnd(22)} ${String(x.score).padStart(6)}  survived ${x.surv}/${j.rounds.length}`))})'
