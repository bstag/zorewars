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
node modelwar/mw.mjs upload modelwar/decoyadapt61.red "Decoy Adapter v6.1"
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
- `decoyadapt.js` / `.red`: the same plus a P-space mode switch (v2; live until 16 Nov 2026).
- `decoyadapt5.red`: Decoy Adapter v5 (live until 18 Nov 2026). The decoy has non-zero A-fields, because Light Cycle A14 compares A-fields only and walked past v2's zero-A decoy; our scan ignores any hit inside its own footprint instead. Numbers tuned against the top of the ladder: step 1271, gap 27, a 4800-cell decoy.
- `decoyadapt61.red`: Decoy Adapter v6.1 (live until 19 Nov 2026), v5 with three changes. Its scan uses `sne.f`, so a stone's `DAT #0,#0` bombs no longer look like code. Its second P-space mode is an 8-cell stream paper instead of a moved clear pointer, because papers beat the stones that beat v5; it switches once paper's score leads by 2 (win +1, loss or tie -1). Its boot writes P-space once and then overwrites itself with DAT: an opponent that scatters SPL and DJN cells over our body (Nemesis's hydra) sent our own processes back into the boot mid-round, which scored a round twice and stored corrupted scores. Against the ladder's top 15 and 10 hill stones it lost 18 of 250 matches, against v6's 26; on the stones alone, v5 lost 74 of 80.
- `triad.json` / `triad.red`: Triad v1, a candidate built with the block algebra (`node scripts/algebra.js build modelwar/triad.json --rules modelwar --length 400`), not uploaded. A `switch-score` (P-space score boxes: win +1, loss -1, the 4th tie in a row counts as a loss, the arm in play keeps a 1-point edge, guard stone first) over three arms that each beat what the others lose to: `twin-scan` booted half the core away with a 190-cell decoy left behind (beats Decoy Adapter-style scanner/papers), `guard-stone` (stones, Stranger) and `sweep` (Nemesis). The idea came from an ablation of the 94x hill's Fata Morgana X; no hill code is in it. Locally, against the 25-warrior bench (4 matches each), it lost 7 of 100 matches to v6.1's 8 but scored 2.02 points per round to v6.1's 2.13, and it beat v6.1 187-149 (64 ties) over 400 rounds. Scoring a loss -2, or every tie -1, made it drop arms too soon. Against the live ladder's top 29 (19 Nov 2026) it beat the #1, Lisan-Al-Gaib, which v6.1 can't, but lost every match to two small stones, DriftLab and Skippy: none of its arms beats a fast stone, and v6.1 does through its paper mode.
- `triad2.json` / `triad2.red`: Triad v2 (live from 19 Nov 2026 until Triad v3 replaced it the same day). Triad v1 plus a fourth arm, `tail-silk`, which plays first (`--length 600` to build); every paper block in the library beat DriftLab and Skippy. Against the ladder's top 29 (4 matches each, fresh seeds) it scored 2.36 points a round and lost 7 of 116 matches, against v6.1's 2.30 and 8 lost (with 4 drawn); it beat Lisan-Al-Gaib 4-0 (v6.1 0-4), DriftLab 3-1 and Skippy 4-0. It beat v6.1 184-160 (56 ties) over 400 rounds. On the 25-warrior bench it was level with v6.1 (2.13 against 2.16 points a round, 3 against 4 of 50 matches lost). Both lose every match to the bench stone Nightfall.
- `triad3.json` / `triad3.red`: Triad v3 (live from 19 Nov 2026 until Duet v1 replaced it on 20 Nov). Lisan-Al-Gaib's Sietch Switch (two one-shot scanners and an imp-launching stone, switching after each lost round) beat Triad v2 in 7 of 8 matches, although each of v2's arms beat it alone (guard stone 63-26). The cause was layout: the selector sat in front of the arms, so a scanner that found it cleared forward through the arm in play. Inert cells placed before the guard stone made it lose 26-71; the same cells after it barely mattered. v3 wraps every arm in `boot` (half the core away), so the selector and the idle arms stay behind as a decoy. Locally it beat Sietch 161-59 over 300 rounds (v2 78-98) and lost 3 of 116 matches against the ladder's top 29 (v2 13); head-to-head it is level with v2. On the server it beat Sietch 58-15, 55-11 and 56-7.
- `duet1.json` / `duet1.red`: Duet v1 (live on 20 Nov 2026 until Trio v3 replaced it the same day; `--length 600` to build). Lisan-Al-Gaib replaced Sietch with Ornithopter Silk, a plain silk paper, which beat Triad v3 in 12 of 13 matches (typically 32-20, 45 ties). Alone, only v3's sweep arm beat it (about 44-33); tail-silk tied every round, twin-scan lost and the guard stone lost 5-78 (the paper scrambles its pointers and it bombs itself). Changing v3's switch settings did not help, because a few losses pushed it off the sweep onto the arms that lose. Duet keeps only two arms: the sweep, retuned with the tree tuner against the ladder plus Ornithopter weighted five times (alone it beat Ornithopter on 6 of 6 seeds, about 51-29), and tail-silk; `switch-score` over the two, sweep first. Locally it beat Ornithopter on all 6 seeds (about 46-29), Sietch 68-14 and 64-18 (v3 50-18, 58-17), and won 26 of 29 ladder matches on two fresh seeds (v3 27). On the server its first challenge beat Ornithopter 43-33.
- `trio3.json` / `trio3.red`: Trio v3 (live on 20 Nov 2026 until Trio v5 replaced it the same day; `--length 600` to build). Lisan-Al-Gaib moved on to Sietch Switch and then Sandworm Silk (Ornithopter Silk with new steps, apparently tuned against Duet's sweep). Trio puts Triad v3's twin scanner and decoy field back beside Duet's sweep and tail-silk, under `switch-score` (FIRST 2, STREAK 2). Tuning the tree weakened the sweep (UP 0, WIPE 10), so v3 keeps Duet's sweep. Locally, over 600 rounds, it beat Sandworm 322-164, Sietch 337-151 and Ornithopter 229-190 (Duet about 240-170), with the ladder unchanged. The idle twin scanner costs the sweep about 2 wins in 100 when they share the core (2,000 rounds). Neither skipping our own image nor shrinking the sweep's blind spot above its copy helped, and skipping made it worse: Ornithopter's copies land in the old cells. On the server its first challenge beat Sandworm 50-30.
- `trio4.json` / `trio4.red`: Trio v4, never uploaded: two sweeps on different steps (8600 and 3100) and tail-silk under `switch-score` STREAK 1. It beat Sandworm Silk II 467-350 over 1,200 rounds, but a random search over the silk's steps found a counter quickly (36-103).
- `trio5.json` / `trio5.red`: the live 1v1 entry (Trio v5, uploaded 20 Nov 2026; `--length 600` to build). Lisan-Al-Gaib answered Trio v3 with Sandworm Silk II, the same silk with steps searched against Trio v3. Its target was the twin scanner's step: 884 lost to it 37-73, while most other twin steps beat it about 2 to 1. Trio v5 gives both scanners `VARY 4`: a P-space round counter picks a different known-good step each round (sweep 5044, 8600, 3100, 7700; twin scanner 7300, 3700, 4100, 8300), so a silk has to dodge all of them. Against 48 silks with random steps, the worst one still lost 121-154 over 400 rounds (Trio v3's worst 138-130, Trio v4's 103-36). Locally, over 300 rounds, it beat Sandworm II 171-73, Sandworm 156-75, Ornithopter 160-77 and Sietch 163-100. Against the current top 20 it scored 2.02 a round (Trio v3 2.12), losing ground mainly to Stockman (135-159, Trio v3 207-90). On the server its first challenge beat Sandworm II 53-24.
- `decoyshot3.js`: imp-gated variant, kept for reference (weaker on the field).
- `riptide.red`: two 3-point imp spirals fed by a SPL #0 pump, built on ZoreWars' vector-spiral launcher. Our strongest arena entry: about even with Tsunami locally.
- The other arena entry is `warriors/twinsilk.red` in the library.
