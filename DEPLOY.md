# Deploying ZoreWars

## Discord battles

In Discord, members use
`/battle` with two `.red` attachments. It defaults to 50 LP rounds, posts
the score and win/loss/tie counts in the channel, and includes a seed that
can be passed to another `/battle` or to the ZoreWars CLI. The optional
rulesets match the CLI's `--rules` values, including `lp-hill`, `94x-hill`,
`pspace`, `tiny`, `tinylp`, and `nano`. The `lp` and `94x` presets
disable P-space. Their `-hill` counterparts enable it. Uploads are limited
to 32 KiB each and matches to 100 rounds.

1. Create an app in the [Discord Developer Portal](https://discord.com/developers/applications).
   Enable Guild Install and install it in a test server with the
   `applications.commands` scope. The service handles slash-command
   interactions over HTTPS and needs no message-reading permissions.
2. On a machine with Node.js 22+, Docker and Wrangler access to the
   Workers Paid account that owns `zorewar.app`, deploy the Discord Worker.
   Fill in the Application ID and Public Key from the app's General
   Information tab and the ID of the test server.

   ```bash
   npx wrangler deploy --config wrangler.discord.jsonc \
     --var DISCORD_APPLICATION_ID:APP_ID \
     --var DISCORD_GUILD_ID:SERVER_ID \
     --var DISCORD_PUBLIC_KEY:APP_PUBLIC_KEY
   ```

   Reuse these variables on subsequent deploys, or save them as Wrangler
   variables. The Discord Worker acknowledges commands before waking a
   single `lite` container, which sleeps after one minute of inactivity.
   The main website deploy uses its own Wrangler config.
3. In the app's General Information tab, set **Interactions Endpoint URL**
   to `https://battle.zorewar.app/api/discord/interactions`. Discord verifies the
   endpoint when you save.
4. In a shell with `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID` and
   `DISCORD_BOT_TOKEN` set, run `node cli/discord.js register`. Keep the
   bot token in your environment. The running web service needs only the
   public key and IDs. Open the test server and try `/battle`.

After a deployment that changes the command options, run
`node cli/discord.js register` again to update the menu in Discord.

To reproduce a result with both original files, use the rules, rounds and
seed shown in Discord, for example:

```bash
node cli/zorewars.js battle first.red second.red --rules lp --rounds 50 --seed 48172
```

### Shared Nano and Tiny hills

Both hills start empty. `/submit hill:nano warrior:example.red` enters a
warrior. `/ladder hill:nano` shows the top ten and links to
`https://battle.zorewar.app/ladder/nano`. Use `tiny` for the other hill.
Each new entry plays the current field for 50 rounds per matchup using seed
48172. The hill saves head-to-head totals between active entries and ranks
by points per round. Exact ties favor the older entry. When a hill is full,
the lowest-ranked warrior drops out. A simultaneous submission that loses
the database update race can be submitted again.

Before enabling the hills, create and initialize a D1 database and set a
random shared secret for requests from the Worker to the match runner.
From Ubuntu, run these commands from your Linux home directory:

```bash
cd ~
repo=/mnt/e/Source/ZoreWars
npx --yes wrangler@4.152.0 d1 create zorewars-hills --binding HILLS_DB --update-config --config "$repo/wrangler.discord.jsonc"
npx --yes wrangler@4.152.0 d1 execute zorewars-hills --remote --file "$repo/docs/discord-hills.sql" --config "$repo/wrangler.discord.jsonc"
openssl rand -hex 32 | npx --yes wrangler@4.152.0 secret put DISCORD_HILL_SECRET --config "$repo/wrangler.discord.jsonc"
```

Create the database once. The SQL can be reapplied without clearing the
hills. Redeploy the Discord Worker and container with your existing Discord
variables, then run `node cli/discord.js register` as above. The public pages
and `/ladder` read D1 directly. Only submissions wake the match runner.

### Moving the runner to a VPS

Run `node cli/discord.js` on a Node.js 18+ host, or build the same
image with `docker build -f Dockerfile.discord -t zorewars-discord .`.
Give the service the same three Discord values. It listens on port 8788
by default. Put it behind HTTPS at a separate origin such as
`https://battle-origin.zorewar.app`.
For hill submissions, also set the same `DISCORD_HILL_SECRET` on the VPS.
The Cloudflare Worker continues to store standings in D1.

Redeploy the Discord Worker with the three variables above plus
`--var DISCORD_BATTLE_ORIGIN:https://battle-origin.zorewar.app`
and `--containers-rollout=none`. The Worker forwards signed requests to
the VPS, so Discord keeps its existing URL and server command. After
testing a live battle through the VPS, the old container can be retired.

## Website hosting

### Cloudflare observability

For the whole site, open **Observability → Analytics → Account analytics
(beta)** and select the account that owns `zorewar.app`. This shows edge
traffic, cache, and errors, including files served directly by Static
Assets. To combine those signals with the Discord service, create a
[Custom Dashboard](https://developers.cloudflare.com/analytics/custom-dashboards/)
named **ZoreWars operations**:

| Chart | Dataset and scope |
| --- | --- |
| Traffic and cache | HTTP requests for the `zorewar.app` zone, grouped by hostname |
| Site errors | HTTP requests for `zorewar.app` and `battle.zorewar.app`, filtered to 5xx |
| Worker failures | Workers Observability — Logs for `zorewars` and `zorewars-discord`, filtered to error level |
| Discord and hill activity | Workers Observability logs for `zorewars-discord`. Use the event names below in the Worker log explorer to investigate individual requests. |

Apply hostname filters to the HTTP charts and service filters to the Worker
charts. Static asset requests can go straight to Cloudflare's asset
handler, so use HTTP analytics for their traffic. To check coverage, load
the arena and both ladder pages, then run `/ladder` in Discord. Check the
HTTP charts for both hostnames and look for `ladder_view` and `ladder_read`
in the Discord Worker's logs after deploying its observability config.

#### Cloudflare Traces (beta)

In **Observability → Traces**, select the `zorewar.app` zone and open its
[trace configuration](https://developers.cloudflare.com/observability/traces/configuration/).
Enable **Persist to Cloudflare**, start with 5% zone sampling, and keep
incoming trace context set to **Reject**.
Add a first-match rule with a 0% sample rate for the Discord interactions
path before enabling zone tracing:

```text
(http.host eq "battle.zorewar.app" and http.request.uri.path eq "/api/discord/interactions")
```

This lets edge tracing see the static arena and ladder pages while keeping
the Discord callback out of automatic traces. The callback token is in
the outbound URL path, so query-string redaction does not cover it.
The Discord Worker uses structured logs and request IDs for those commands.

The website Worker enables native tracing at 10% with query-string redaction.
Its `zorewars.archive_import` span records the outcome. After deploying it,
open **Observability → Traces**, filter to `zorewar.app`, and try an archive
import. Look for the Worker span and its outbound archive request. The
zone settings are configured in Cloudflare separately from Wrangler.

In **Workers & Pages**, open **Observability** for `zorewars` or
`zorewars-discord`. Both configs enable Workers Logs. Search by event
name, then use the generated `requestId` to follow a Discord interaction
across the Worker, Durable Object, and container logs.

| Event | What to look at |
| --- | --- |
| `archive_import` | Proxy success, failure, and elapsed time |
| `ladder_view`, `ladder_read` | Public and Discord standings latency |
| `arena_ready`, `arena_start_timeout` | Container startup and cold starts |
| `arena_match`, `arena_match_failed`, `arena_busy` | Attachment download time, simulation time, and saturation |
| `hill_submission` | Accepted entries, missed cuts, duplicates, and concurrent write conflicts |
| `discord_reply`, `discord_reply_failed` | Discord callback status and delivery failures |

The application events omit warrior source, Discord interaction tokens,
attachment links, and request bodies. Automatic invocation logs are
disabled to keep raw request URLs out of the application logging setup.
For trends, compare Nano and Tiny simulation times separately and check
the Containers dashboard for instance uptime. To see page-load performance
for the static arena and public ladders, enable
[Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/)
for `zorewar.app` and `battle.zorewar.app` in the dashboard.

ZoreWars has no build step: the repository root *is* the website. The browser loads `web/`, the engine from `src/`, the warriors from `warriors/` and the Python library from `lang/python/`. Only one feature needs a server: importing original warriors from the Core War archives. Those archives don't allow cross-site downloads, so the request goes through a small proxy at `/api/fetch`.

## Which host?

| | Cloudflare (recommended) | GitHub Pages | `npm start` (local) |
| --- | --- | --- | --- |
| Arena, engine, tournaments, post-mortems, replay | yes | yes | yes |
| Docs and warrior encyclopedia | yes | yes | yes |
| Block Workbench and library benchmarks | yes | yes | yes |
| Python warriors in the browser (Pyodide) | yes | yes | yes |
| Converting to JavaScript / Python | yes | yes | yes |
| Opening or dropping a `.red` file | yes | yes | yes |
| **Import… by URL, and Fight in the Hall of Fame** | yes (Worker proxy) | no: download the file instead | yes |
| Cost | free tier: static files free and unlimited; the proxy uses Worker requests | free | — |

**Cloudflare** serves the files with [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/). A Worker (`worker/index.js`) runs only for `/api/*`, and serving the site itself never invokes it. The Worker reuses `cli/remote.js`, so it has the same host allow-list, 512 KB limit and "Redcode only, never executed" rule as the CLI.

The [Block Workbench](web/blocks.html) runs the algebra and VM in a browser worker. After changing blocks, recipes, or their engine dependencies, run `npm run build:workbench` and include the regenerated `web/vendor/block-workbench.js` in the change. Hosts serve the checked-in worker as a static asset.

## Cloudflare

Configuration lives in `wrangler.jsonc`. `.assetsignore` keeps the CLI, tests, scripts, `node_modules` and docs out of the upload, so only the 68 website files are published.

Run the real Workers runtime locally:

```bash
npm install
npm run dev:cloudflare        # http://localhost:8787 (Wrangler needs Node 22+)
```

### Option A: deploy on every push (recommended)

1. Push the repository to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**, and pick the repository.
3. Leave the build command empty. The deploy command is `npx wrangler deploy`.

Every push to `main` then deploys, and pull requests get preview URLs. No Cloudflare credentials are stored in GitHub.

### Option B: deploy from your machine

```bash
npx wrangler login
npm run deploy
```

The site is then at `https://zorewars.<your-subdomain>.workers.dev`. Add a custom domain under the Worker's **Settings → Domains & Routes**.

## GitHub Pages

1. Push the repository to GitHub.
2. Under **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Under **Actions**, run the **GitHub Pages** workflow (`.github/workflows/pages.yml`). It runs the tests, assembles the website files into `_site/` and publishes them.

To publish on every push, add `push: branches: [main]` to the workflow's `on:` section.

The site works under a project path such as `https://<user>.github.io/zorewars/`, because every link is relative. Without a server there's no archive proxy, so **Import… by URL** explains that, and suggests downloading the file and opening it instead.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:
- the test suite on Node 20 and 22, with Python available for the Python generator tests;
- `wrangler deploy --dry-run`, which checks the Cloudflare configuration and Worker bundle without deploying.

The pMARS comparison (`npm run compare`) isn't part of CI, because it needs a pMARS binary. See [COMPLIANCE.md](COMPLIANCE.md).
