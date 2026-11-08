# Shafeeq Aadhil — Portfolio

Single-page portfolio for an AI/ML developer in Bengaluru: GitHub activity, open-source pull requests, competitive-programming stats, and project showcases, all wired to live data through Vercel Serverless Functions.

No framework, no build step — plain HTML, CSS, and JavaScript.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML, CSS, vanilla JavaScript |
| Server | Vercel Serverless Functions (Node.js ESM) |
| Data | GitHub GraphQL (public contributions HTML fallback), LeetCode GraphQL |
| Hosting | Vercel |
| Font | Inter (Google Fonts) + system monospace for metadata |

## Structure

```
index.html          Single-page markup, meta tags, JSON-LD
style.css           Build Log theme (hairline rules, mono index), responsive layout, accessibility states
script.js           Data fetching, heatmaps, filters, modal, nav
api/
  github.js         Contribution calendar + followers (GitHub GraphQL)
  repos.js          Pinned repos via GraphQL, REST fallback
  prs.js            Public pull requests (GitHub search API)
  codolio.js        LeetCode solved stats + 26-week submission window
Pictures/
  banner.png        Original hero banner (source)
  banner.webp       Optimized hero banner (served)
  banner.jpg        JPEG fallback (served)
robots.txt
```

## API endpoints

All endpoints are GET-only and return JSON.

| Endpoint | Returns | Caching |
|----------|---------|---------|
| `/api/github` | `{ total, activeDays, days: [{ date, count, level }], fetchedAt, source }` | 5 min CDN + in-memory |
| `/api/repos` | `{ pinned, all }` | 1 hour CDN + in-memory |
| `/api/prs` | `{ user, totalCount, prs, partial }` | 1 hour, or 60s when serving stale cache |
| `/api/codolio` | `{ leetcode: { totalSolved, yearTotal, window: { weeks, days, total } } }` | 5 min CDN + in-memory |

Account handles and cache TTLs are constants at the top of each function.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` (or `GH_TOKEN`) | GitHub personal access token used by `/api` only |

The token is read with `process.env` inside serverless functions and is never sent to the browser. It is optional: when it is missing or rejected, `/api/github` reads the public contributions page, which exposes exact per-day counts, so the heatmap stays accurate without a token. A valid token is still preferred for higher rate limits.

Create `.env.local` for local development:

```
GITHUB_TOKEN=your_token_here
```

`.env*` is gitignored. Do not expose the token to client code (no `NEXT_PUBLIC_`-style prefixes exist here).

## Local development

The site has no build step, but `/api` routes need the Vercel runtime:

```bash
npm i -g vercel
vercel dev
```

Then open the URL printed by the CLI. Serving the folder with a plain static server works for layout work, but API sections will show their fallback states.

## Data behavior

- Activity endpoints revalidate every 5 minutes (`s-maxage=300` + `stale-while-revalidate`), so new commits and submissions appear without a redeploy.
- The client caches activity for 2 minutes, revalidates when the tab becomes visible, the network returns, or every five minutes, and exposes a refresh button on each heatmap.
- If an upstream API fails and a previous result exists, the stale result is served rather than an error.
- Partial results (for example, repositories loaded but pinned data unavailable) are marked `partial` and are intentionally not cached by the client.
- The client keeps a `localStorage` copy with a TTL and retries transient failures.

## Accessibility and performance

- WCAG AA contrast, visible focus rings, skip link, keyboard-trapped dialog, and `aria-current` navigation state.
- `prefers-reduced-motion` disables animation, and sections remain visible without JavaScript.
- Hero banner is served as WebP (about 87 KB) with a JPEG fallback instead of the 1.9 MB source PNG; the avatar is requested at 144 px for a 72 px slot.

## Deployment

Import the repository into Vercel, add `GITHUB_TOKEN` in Project Settings → Environment Variables, and deploy. The static files and `api/` directory are detected automatically.

## License

MIT — see [LICENSE](LICENSE).
