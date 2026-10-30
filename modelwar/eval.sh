#!/bin/bash
# usage: FIELD=dir eval.sh warrior [rounds] [seed] -> per-opponent result and total points/round
# under ModelWar 1v1 rules. FIELD holds the opponents' .red files (download them from /api/players/<id>).
: "${FIELD:?set FIELD to a folder of opponent .red files}"
W="$1"; R="${2:-40}"; SEED="${3:-7}"
MW="--coresize 25200 --cycles 252000 --length 5040 --processes 25200 --distance 100"
TMP="$(mktemp)"
cd "$(dirname "$0")/.."
for o in "$FIELD"/*.red; do
  ( node cli/zorewars.js battle "$W" "$o" -r $R --seed $SEED $MW --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const [a,b]=JSON.parse(s).warriors;console.log(`${b.name.padEnd(16)} ${a.wins}-${a.losses}-${a.ties} ${a.score}`)})' ) &
done | sort > "$TMP"
wait
awk -v R=$R '{print; t+=$3} END {printf "TOTAL points/round %.3f\n", t/(NR*R)}' "$TMP"
rm -f "$TMP"
