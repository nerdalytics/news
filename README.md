# tureel

The top entries of Hacker News, GitHub and other developer sources in one fast,
quiet reader. tureel is a static site: every feed is fetched by the browser
straight from the source's public API. There is no backend, no account and no
tracking.

- Up to 20 entries per source.
- A row opens the item; the comment count opens the item's discussion on the source.
- Sources can be switched on and off and dragged into any order.
- Light and dark theme (follows the system, or fixed).
- Settings live in cookies in the browser.

## Sources

Only sources in the catalogue (`src/sources/index.ts`) can be enabled. A source
qualifies if its endpoint is public, needs no key or login, and answers with
CORS headers, because a page on GitHub Pages cannot call anything else.

| Source | Shows | Endpoint | Requests per load | Discussion link |
| --- | --- | --- | --- | --- |
| Hacker News | Front page | `hacker-news.firebaseio.com/v0/topstories.json`, then `hn.algolia.com/api/v1/search` | 2 | comments |
| GitHub | Repositories created in the last 7 days, by stars | `api.github.com/search/repositories` | 1 | – |
| DEV | Most popular posts of the last day | `dev.to/api/articles?top=1` | 1 | comments |
| Lemmy | Hot posts in `technology` on lemmy.world | `lemmy.world/api/v3/post/list` | 1 | comments |
| The Next Web | Latest stories (the feed carries 10) | `thenextweb.com/feed` (RSS) | 1 | – |
| Mastodon | Trending links on mastodon.social | `mastodon.social/api/v1/trends/links` | 1 | – |
| Stack Overflow | Hot questions of the week | `api.stackexchange.com/2.3/questions?sort=week` | 1 | answers |
| Hugging Face | Trending models | `huggingface.co/api/models?sort=trendingScore` | 1 | – |
| Wikipedia | Most read articles of the previous UTC day | `api.wikimedia.org/feed/v1/wikipedia/en/featured/…` | 1 (2 just after midnight UTC) | – |

The last three are switched off by default.

Things worth knowing:

- **Hacker News** – the official API returns ids only and would need one request
  per story. tureel takes the order from the official API and resolves the top
  30 ids in a single Algolia HN Search request. Job posts are not in that index,
  so they do not appear.
- **GitHub** – there is no API for github.com/trending; the Search API is the
  closest official signal. Unauthenticated search is limited to
  [10 requests per minute](https://docs.github.com/en/rest/search/search).
- **Stack Overflow** – without a key, all requests from one IP address share a
  [daily quota](https://api.stackexchange.com/docs/throttle); the API reports
  it as `quota_max: 300`.
- **Lemmy** – uses API v3 of one instance. Cross-posts of the same link are
  shown once; pinned, removed and NSFW posts are skipped.
- **Mastodon** – the server caps this endpoint at
  [20 links](https://docs.joinmastodon.org/methods/trends/). "Shares" is the
  number of posts that used the link today and yesterday.

### Evaluated and left out

Checked on 2026-11-15 by requesting each endpoint with an `Origin` header:

| Source | Why not |
| --- | --- |
| Product Hunt | The GraphQL API answers `401 invalid_oauth_token` without a token; the Atom feed sends no CORS headers. |
| Reddit | `403` for unauthenticated JSON requests from the test machine, no CORS headers. |
| Lobsters | `hottest.json` works but sends no `Access-Control-Allow-Origin`. |
| Echo JS | API works but sends no CORS headers. |
| Smashing Magazine, Front-end Front, Slashdot, Tildes, arXiv | Feeds send no CORS headers. |
| BetaList | No public feed found (`/feed` is a 404). |
| Designer News | The former API path (`/api/v2/stories`) answers `404`; no other endpoint was tried. |

These would need a small server-side step (for example a scheduled job that
fetches the feeds and publishes JSON next to the site).

## How it loads

- The page shell is one HTML file, one stylesheet and one ~8 kB (gzip) script.
  Each source adapter and the settings dialog are separate chunks that are only
  downloaded when used.
- Feeds are cached in `localStorage` with a freshness window per source (5 to 60
  minutes). Cached entries render immediately; a stale feed is refreshed in the
  background when its column is on screen.
- A column fetches only once it is at least half visible and has stayed there
  for 150 ms, so scrolling past columns costs no requests.
- Prefetching starts with the first scroll: after that, columns within half a
  screen of the visible area are fetched at low priority when the browser is
  idle. Hovering or focusing a tab prefetches that source. Nothing is prefetched
  when the browser reports data saver mode.
- The splash is removed as soon as the first column has content, and after one
  second at the latest; columns then show placeholders until their data arrives.
- Returning to the tab (or coming back with the back button) refreshes stale
  columns that are on screen.

## Settings

Three cookies, scoped to the directory the app is served from, valid for 400 days:

| Cookie | Value |
| --- | --- |
| `tureel_sources` | Source ids in display order, joined by `.`; disabled ones are prefixed with `-`, e.g. `hn.github.-devto` |
| `tureel_theme` | `light` or `dark`; absent or `auto` follows the system |
| `tureel_newtab` | `1` opens links in a new tab |

Cookies are written through the Cookie Store API where available and
`document.cookie` otherwise. Open tabs pick up changes from each other.

## Development

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev        # dev server
npm run ci         # lint, typecheck, unit tests, production build
npm run format     # apply formatter and safe lint fixes
npm run preview    # serve the production build
```

### Adding a source

1. Check that the endpoint is public and sends `Access-Control-Allow-Origin`.
2. Add an adapter in `src/sources/` that default-exports a `SourceAdapter` and
   exports a pure `parse` function. Run URLs from the response through `safeUrl`.
3. Add its metadata to `SOURCES` and its loader to `LOADERS` in
   `src/sources/index.ts`.
4. Cover `parse` in `test/sources.test.ts`.

Existing readers get a new source appended to their list, switched off.

## Deployment

`.github/workflows/pages.yml` verifies every pull request and deploys `main` to
GitHub Pages. One manual step is needed once: in the repository settings under
**Pages**, set **Source** to **GitHub Actions**.

The build uses relative asset URLs, so it works both under
`https://<owner>.github.io/tureel/` and on a custom domain.

## License

MIT
