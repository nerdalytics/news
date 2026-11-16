# tureel

tureel shows the top 20 entries of Hacker News, GitHub and seven other sources
on one page. It is a static site. The browser fetches every feed from the
source's public API, so tureel has no backend and no accounts.

- On the first visit the reader chooses the sources. No source is on by default.
- Each source shows up to 20 entries.
- Clicking a row opens the item. Clicking the comment count opens the item's
  discussion on the source.
- Readers can switch sources on and off and drag them into any order.
- The theme follows the system or stays fixed on light or dark.
- tureel stores settings in browser cookies.

## Sources

Readers can enable only the sources listed in `src/sources/index.ts`. A source
qualifies if its endpoint is public, needs no key or login, and sends CORS
headers. A page on GitHub Pages cannot read responses from other endpoints.

| Source | Shows | Endpoint | Requests per load | Discussion link |
| --- | --- | --- | --- | --- |
| Hacker News | Front page | `hacker-news.firebaseio.com/v0/topstories.json`, then `hn.algolia.com/api/v1/search` | 2 | comments |
| GitHub | Repositories created in the last 7 days, by stars | `api.github.com/search/repositories` | 1 | none |
| DEV | Most popular posts of the last day | `dev.to/api/articles?top=1` | 1 | comments |
| Lemmy | Hot posts in `technology` on lemmy.world | `lemmy.world/api/v3/post/list` | 1 | comments |
| The Next Web | Latest stories, 10 per feed | `thenextweb.com/feed` (RSS) | 1 | none |
| Mastodon | Trending links on mastodon.social | `mastodon.social/api/v1/trends/links` | 1 | none |
| Stack Overflow | Hot questions of the week | `api.stackexchange.com/2.3/questions?sort=week` | 1 | answers |
| Hugging Face | Trending models | `huggingface.co/api/models?sort=trendingScore` | 1 | none |
| Wikipedia | Most read articles of the previous UTC day | `api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD` | 1, or 2 just after midnight UTC | none |

Notes on individual sources:

- The official Hacker News API returns ids only and needs one request per
  story. tureel takes the front page order from the official API and the
  stories from one Algolia HN Search request. Both requests run in parallel.
  That index does not contain job posts, so tureel does not show them.
- GitHub counts unauthenticated requests per IP address. Readers who share an
  address, for example behind a mobile carrier, share the limit. tureel then
  shows a rate limit message with a retry button.
- GitHub has no API for github.com/trending, so tureel uses the Search API.
  GitHub limits unauthenticated search to
  [10 requests per minute](https://docs.github.com/en/rest/search/search).
- Without a key, all Stack Exchange API requests from one IP address share a
  [daily quota](https://api.stackexchange.com/docs/throttle). The API reports
  it as `quota_max: 300`.
- The Lemmy adapter uses API v3 of one instance. It shows cross-posts of the
  same link once and skips pinned, removed and NSFW posts.
- The Mastodon server caps the endpoint at
  [20 links](https://docs.joinmastodon.org/methods/trends/). The "shares"
  number counts the posts that used the link today and yesterday.

### Evaluated and left out

Results of requesting each endpoint with an `Origin` header on 2026-11-15:

| Source | Result |
| --- | --- |
| Product Hunt | The GraphQL API answers `401 invalid_oauth_token` without a token. The Atom feed sends no CORS headers. |
| Reddit | Unauthenticated JSON requests from the test machine got `403` and no CORS headers. |
| Lobsters | `hottest.json` answers but sends no `Access-Control-Allow-Origin`. |
| Echo JS | The API answers but sends no CORS headers. |
| Smashing Magazine, Front-end Front, Slashdot, Tildes, arXiv | The feeds send no CORS headers. |
| BetaList | `/feed` answers `404`. |
| Designer News | The former API path `/api/v2/stories` answers `404`. No other endpoint was tried. |

The sources that only lack CORS headers need a server-side step, for example a
scheduled job that fetches the feeds and publishes them as JSON next to the
site.

## How it loads

- The first load is one HTML file, one stylesheet and one script of about
  10 kB gzipped. The first-run screen, the settings dialog and the debug panel
  are separate chunks. The browser downloads a chunk the first time it is
  needed.
- tureel caches each feed in `localStorage`. A cached feed counts as fresh for
  5 to 60 minutes, depending on the source. A column renders its cached entries
  in the first frame and refetches a stale feed in the background.
- The source on screen loads first. tureel then fetches the other enabled
  sources one after another at low priority, so a source is ready before the
  reader switches to it. A fresh cached feed costs no request.
- On the first-run screen, tureel starts fetching a source when the reader
  switches it on.
- tureel prefetches nothing when the browser reports data saver mode.
- tureel removes the splash screen when the first column has content, and
  after three seconds at the latest. Columns without data show placeholder
  rows until the data arrives.
- When the reader returns to the tab or comes back with the back button,
  tureel refetches stale feeds.

## Layout

- Below 760 px width, tureel displays one source at a time and the page itself
  scrolls. Tapping a tab swaps the source and restores its scroll position.
  Tapping the current tab scrolls to the top.
- From 760 px width, 2 to 5 columns sit side by side and each column scrolls on
  its own.

## Debugging on a phone

Append `?debug` to the URL. tureel then shows uncaught errors and the duration
of every feed request in a panel at the top of the page.

## Settings

tureel stores three cookies. Their path is the directory that serves the app,
and they expire after 400 days.

| Cookie | Value |
| --- | --- |
| `tureel_sources` | Source ids in display order, joined by `.`. A `-` prefix marks a disabled source, as in `hn.github.-devto`. |
| `tureel_theme` | `light` or `dark`. Without the cookie, or with `auto`, the theme follows the system. |
| `tureel_newtab` | `1` opens links in a new tab. |

tureel writes cookies with the Cookie Store API and falls back to
`document.cookie` in browsers without it. In browsers with the Cookie Store
API, a change in one tab updates the other open tabs.

Safari deletes cookies created in JavaScript and `localStorage` after 7 days
without a tap or click on the site, according to WebKit's
[tracking prevention policy](https://webkit.org/tracking-prevention/). After
that, tureel shows the first-run screen again. The policy exempts web apps
added to the home screen.

## Development

Development requires Node.js 22.12 or newer.

```sh
npm install
npm run dev        # start the dev server
npm run ci         # run lint, typecheck, unit tests and a production build
npm run format     # apply the formatter and safe lint fixes
npm run preview    # serve the production build
```

### Adding a source

1. Check that the endpoint is public and sends `Access-Control-Allow-Origin`.
2. Add an adapter in `src/sources/` that default-exports a `SourceAdapter` and
   exports a pure `parse` function. Pass every URL from the response through
   `safeUrl`.
3. Add its metadata to `SOURCES` and its loader to `LOADERS` in
   `src/sources/index.ts`.
4. Cover `parse` in `test/sources.test.ts`.

Readers who have already chosen their sources see a new source at the end of
their list, switched off.

## Deployment

The workflow in `.github/workflows/pages.yml` runs the checks on every pull
request and deploys `main` to GitHub Pages. Before the first deployment, open
the repository settings, go to Pages, and set Source to GitHub Actions.

The build uses relative asset URLs, so it works under
`https://<owner>.github.io/tureel/` and on a custom domain.

## License

MIT
