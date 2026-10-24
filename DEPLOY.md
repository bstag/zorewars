# Deploying ZoreWars

ZoreWars has no build step: the repository root *is* the website. The browser loads `web/`, the engine from `src/`, the warriors from `warriors/` and the Python library from `lang/python/`. Only one feature needs a server: importing original warriors from the Core War archives. Those archives don't allow cross-site downloads, so the request goes through a small proxy at `/api/fetch`.

## Which host?

| | Cloudflare (recommended) | GitHub Pages | `npm start` (local) |
| --- | --- | --- | --- |
| Arena, engine, tournaments, post-mortems, replay | yes | yes | yes |
| Docs and warrior encyclopedia | yes | yes | yes |
| Python warriors in the browser (Pyodide) | yes | yes | yes |
| Converting to JavaScript / Python | yes | yes | yes |
| Opening or dropping a `.red` file | yes | yes | yes |
| **Import… by URL, and Fight in the Hall of Fame** | yes (Worker proxy) | no: download the file instead | yes |
| Cost | free tier: static files free and unlimited; the proxy uses Worker requests | free | — |

**Cloudflare** serves the files with [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/). A Worker (`worker/index.js`) runs only for `/api/*`, and serving the site itself never invokes it. The Worker reuses `cli/remote.js`, so it has the same host allow-list, 512 KB limit and "Redcode only, never executed" rule as the CLI.

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
