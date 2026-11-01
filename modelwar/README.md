# Talking to ModelWar

[ModelWar](https://modelwar.ai/how-to-play) is a public Core War ladder for AI agents. Agents upload Redcode, challenge each other and get Glicko-2 ratings. This folder holds what an agent needs to play there with ZoreWars as its test bench: a small API client, local copies of the server's rules, and the warriors we entered.

## Before you start

- **A human registers the account.** Agents don't create accounts. The account's API key goes in `.env` at the repo root, which git ignores:
  ```
  MODELWAR_API_KEY=...
  ```
- **Never print the key.** `mw.mjs` reads it from `.env`, and before printing a response it replaces any `api_key` field with `[hidden]` and any `redcode` with its length.
- **Uploading and challenging are public.** They change your warrior and your rating on a public leaderboard. Ask the user before each upload or batch of challenges unless they've already approved it.

## Two games, two rule sets

| | 1v1 ladder | Arena |
|---|---|---|
| Core | 25200 | 8000 |
| Cycles / round | 252000 | 80000 |
| Max length | 5040 | 100 |
| Max processes | 25200 | 8000 |
| Min distance | 100 | (server-placed) |
| Rounds | 100 | 200 |
| Players | 2 | 10 slots; empty ones are `DAT #0,#0` feeder bots |
| Scoring | win 3 / tie 1; Glicko-2 rating | each round the survivors split 90 points |

Notes:
- P-space works on the 1v1 server, so a switcher that learns across rounds is legal.
- Challenging the same opponent again within about 2 minutes counts for less rating.
- The displayed rating is a conservative value: a new player starts low and climbs as the rating deviation shrinks, even with a perfect record.

## The client: `mw.mjs`

Run it from the repo root. It prints the JSON response with secrets stripped.

```bash
node modelwar/mw.mjs me                                   # your player, rating, warrior
node modelwar/mw.mjs battles                              # your recent battles
node modelwar/mw.mjs upload modelwar/decoyadapt.red "Decoy Adapter"
node modelwar/mw.mjs challenge 30294                      # defender's player id
node modelwar/mw.mjs arena-upload warriors/twinsilk.red "Twin Silk" auto
node modelwar/mw.mjs arena-start                          # run one arena now
```

`auto` on `arena-upload` sets `auto_join`, so your arena warrior also fills slots in arenas other players start.

## The API

The base URL is `https://modelwar.ai`. Authenticated calls send `Authorization: Bearer <key>`. The GETs below are public.

| Call | What it returns or does |
|---|---|
| `GET /api/me` | your player (auth) |
| `POST /api/warriors` `{name, redcode}` | upload or replace your 1v1 warrior (auth) |
| `POST /api/challenge` `{defender_id}` | play a 100-round match now, returns the result (auth) |
| `GET /api/battles` | your 1v1 battles (auth) |
| `POST /api/arena/warrior` `{name, redcode, auto_join}` | upload your arena warrior (auth) |
| `POST /api/arena/start` | start an arena with you in it (auth) |
| `GET /api/leaderboard?page=1&per_page=60` | 1v1 ranking: `id`, `name`, `rating`, `rating_deviation`, record |
| `GET /api/arena-leaderboard?per_page=24` | arena ranking |
| `GET /api/players/<id>` | a player, their current 1v1 warrior **with its Redcode**, and recent battles |
| `GET /api/battles/<id>` and `/replay` | one 1v1 battle |
| `GET /api/arenas/<id>` | one arena: placements, scores, rating changes |
| `GET /api/arenas/<id>/replay` | the arena's seed, settings and every warrior **with its Redcode** |

Opponents' code is public, so you can test against the real field instead of guessing. Keep downloaded code in a scratch folder. Don't commit it: it belongs to its authors.

## The loop

1. **Get the field.** Save the top players' 1v1 warriors:
   ```bash
   mkdir -p field
   for id in $(curl -s 'https://modelwar.ai/api/leaderboard?per_page=12' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).leaderboard.forEach(p=>console.log(p.id)))'); do
     curl -s "https://modelwar.ai/api/players/$id" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);if(p.warrior)require("fs").writeFileSync(`field/${p.name.replace(/\W+/g,"_")}.red`,p.warrior.redcode)})'
   done
   ```
   For the arena, take the warriors from a recent arena's `/replay` instead (skip the stock bots).
2. **Test locally under the server's rules.** ZoreWars needs the 1v1 flags, otherwise it applies its 8000-cell, 100-line defaults:
   ```bash
   node cli/zorewars.js check mine.red --coresize 25200 --length 5040 --json
   node cli/zorewars.js battle mine.red field/Dave.red -r 100 --coresize 25200 --cycles 252000 --length 5040 --processes 25200 --distance 100 --json
   ```
   `eval.sh` runs that against a whole folder and prints the result per opponent plus points per round:
   ```bash
   FIELD=field bash modelwar/eval.sh modelwar/decoyadapt.red 40 7
   ```
   `arena.sh` plays a 10-slot arena (your warrior, the folder, and 3 feeders) and scores it the server's way:
   ```bash
   ARENA=arenafield bash modelwar/arena.sh warriors/twinsilk.red 50 1
   ```
   Run two seeds before believing a change. With 12 opponents and 40 rounds, a difference of about 0.02 points per round is noise.
3. **Find out why you lose.** `battle ... --report --json` gives the killing blow and death causes per round; `trace` shows the last instructions run (see `AGENTS.md`).
4. **Upload, then challenge.** Upload once, then challenge in a batch: start with players near your own rating, then the top. Read each result's `wins/losses/ties` and the rating change.
5. **Check that the local bench agrees with the server.** If a matchup goes very differently on the server, look at that battle's replay before tuning anything.

## What we learned

- **The local simulator predicts the ladder.** Running the leaderboard's warriors against each other in ZoreWars reproduced the leaderboard's order, so local points per round are worth trusting.
- **1v1: one-shot scanners dominate this field.** Many top warriors are stones and scanners. Our entry, Decoy Adapter (`decoyadapt.js`), is a one-shot scanner followed by a long decoy whose pattern repeats every 11 cells. Our own scanner steps 11 cells at a time, so it reads the decoy as empty core. Enemy scanners with other steps read it as code and waste their attack on it. That took it from Stockman's 1.82 to 2.0 points per round on the local field.
- **Score-keeping beats flip-on-loss.** Decoy Adapter uses P-space to keep wins minus losses for each of two modes and plays the better one. A switcher that changed mode after every loss did worse (1.96). The score-keeper matched the plain warrior on the field and won the rematch against the scanner that had beaten it.
- **Imps cost ties.** Gating the clear against imps beat the Imp 34–2 but dropped the whole field to 1.58, because the gate process got split by the clear and flooded the process table. We left imps alone.
- **Arena: survival is everything.** With 90 points split among survivors, a warrior that stays alive in 95% of rounds outscores one that kills things. Papers (silk replicators) win; bombers and scanners die in the crowd. Our entry, Twin Silk (`warriors/twinsilk.red`), runs two Silk papers with different copy distances so one clear can't stop both. It placed 1st or 2nd in all 5 arenas we tested, losing only to an imp launcher, Tsunami.

## Files

- `mw.mjs`: the API client.
- `eval.sh`, `arena.sh`: local benches under the 1v1 and arena rules.
- `feeder.red`: the `DAT #0,#0` bot that fills empty arena slots.
- `decoyshot.js` / `.red`: one-shot scanner with a decoy.
- `decoyadapt.js` / `.red`: the same plus a P-space mode switch. This is the live 1v1 entry.
- `decoyshot3.js`: imp-gated variant, kept for reference (weaker on the field).
- `riptide.red`: two 3-point imp spirals fed by a SPL #0 pump, built on ZoreWars' vector-spiral launcher. Our strongest arena entry: about even with Tsunami locally.
- The other arena entry is `warriors/twinsilk.red` in the library.
