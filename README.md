# TheNews

TheNews shows the top 20 entries of Hacker News, GitHub and sixteen other
sources on one page. It is a static site without accounts. The browser fetches
most feeds from the source's public API. For sources a browser cannot read, a
scheduled GitHub workflow fetches the feed and the browser reads the published
file.

- On the first visit the reader chooses the sources. No source is on by default.
- Each source shows up to 20 entries.
- Clicking a row opens the item. Clicking the comment count opens the item's
  discussion on the source.
- Readers can switch sources on and off and drag them into any order.
- TheNews dims the entries the reader has opened.
- Pulling down at the top of the page refreshes the source under the finger.
- The tab bar hides while the reader scrolls down and returns on the way up.
- Four swipes on an entry, short and long in each direction, can each be given
  an action. No swipe has an action by default.
- The page reloads itself after a new release.
- Tapping the name of a linked site, such as `slate.com`, offers to favorite
  or block that site. Entries that link to a favorited site carry a star and
  a faint tint. Entries that link to a blocked site stay in the list, dimmed,
  with the site name crossed out. Tapping the name again offers to undo either.
- The theme follows the system or stays fixed on light or dark.
- TheNews stores settings in browser cookies.

## Sources

Readers can enable only the sources listed in `src/sources/index.ts`. There are
two kinds.

A direct source has an endpoint that is public, needs no key or login, and
sends CORS headers. The browser reads it itself.

A hosted source lacks the CORS header or needs a key. Its own GitHub workflow
fetches it, see [Hosted sources](#hosted-sources).

### Direct sources

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
| Show HN | Show HN in page order | `hacker-news.firebaseio.com/v0/showstories.json`, then `hn.algolia.com/api/v1/search` | 2 | comments |
| Uneed | Today's launch ranking | `mcp.uneed.best/v1/trending?period=daily` | 1 | none |
| Nick Launches | This week's launches by upvotes | `nicklaunches.com/api/v1/feed/week/` | 1 | comments |
| Launch Llama | Top products of the week | Launch Llama's API on `supabase.co` | 1 | none |

Notes on individual sources:

- The official Hacker News API returns ids only and needs one request per
  story. TheNews takes the front page order from the official API and the
  stories from one Algolia HN Search request. Both requests run in parallel.
  That index does not contain job posts, so TheNews does not show them.
- GitHub counts unauthenticated requests per IP address. Readers who share an
  address, for example behind a mobile carrier, share the limit. TheNews then
  shows a rate limit message with a retry button.
- GitHub has no API for github.com/trending, so TheNews uses the Search API.
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

### Hosted sources

| Source | Shows | Fetched from | Schedule | Discussion link |
| --- | --- | --- | --- | --- |
| Lobsters | Hottest stories | `lobste.rs/hottest.json` | Hourly | comments |
| Product Hunt | Top products of the last 24 hours | Product Hunt's GraphQL API, with a token | Hourly | comments |
| BetaList | Newest startups | `betalist.com/startups/feed_original` | Every 3 hours | none |
| Smol Launch | This week's ranking | `smollaunch.com/api/v1` | Every 2 hours | comments |
| DevHunt | This week's launches, ranks 41 to 60 | `devhunt.org/api/home/more-launches` | Every 3 hours | none |

DevHunt's public route starts at rank 41. The top 40 are only in the page
itself. TheNews shows the real ranks, so the DevHunt column counts from 41.

How it works:

- Each source has its own workflow, `.github/workflows/source-<id>.yml`, with
  its own schedule. The schedules follow what each source asks for or can
  bear. None runs more often than hourly.
- The workflow runs `scripts/hosted/run.mjs <id>`, which fetches the source and
  writes `feed.json` in the app's entry format.
- If that worked, the workflow replaces the single commit on the branch
  `data-<id>` with the new file. The repository does not grow with every
  update.
- The app reads
  `https://raw.githubusercontent.com/<owner>/<repo>/data-<id>/feed.json`.
  GitHub serves that address with `Access-Control-Allow-Origin: *` and a five
  minute cache.

What happens when a workflow fails:

- A failed run publishes nothing. The script exits with an error if the source
  does not answer or returns fewer than 5 usable entries. The app keeps
  reading the last good feed and shows its real age.
- A source whose feed is older than 3 days counts as broken. The app removes
  it from the tabs, the settings sheet and the first-run screen. The reader's
  choice is kept, and the source returns when a new feed arrives.
- A source whose workflow has never succeeded has no feed file. The app does
  not list it at all. Product Hunt is in this state until the repository
  secret `PRODUCTHUNT_TOKEN` holds a developer token from Product Hunt's API
  dashboard.

GitHub disables scheduled workflows in a public repository after 60 days
without repository activity. The sources then age out as described above.

The Product Hunt script has never run with a token. Its query follows
Product Hunt's public schema, but the first real run is its first test.

### Evaluated and left out

Results of requesting each endpoint with an `Origin` header on 2026-11-15:

| Source | Result |
| --- | --- |
| Reddit | Unauthenticated JSON requests from the test machine got `403` and no CORS headers. |
| Echo JS | The API answers but sends no CORS headers. |
| Smashing Magazine, Front-end Front, Slashdot, Tildes, arXiv | The feeds send no CORS headers. |
| Designer News | The former API path `/api/v2/stories` answers `404`. No other endpoint was tried. |

A further survey on 2026-11-16 covered 59 launch boards, 33 directories and
7 community sites. The results that matter for later work:

- Usable directly but not added: Ask HN, ToolPilot, Awesome Indie, Founder.best,
  ScrollLaunch, Aback Launch.
- Candidates for a hosted source: hot100, Glama, OpenAlternative, Firsto,
  Fazier, KittyLaunch, PitchWall, PeerPush.
- Reddit and Hashnode have closed their free access.

## How it loads

- The first load is one HTML file, one stylesheet and one script of about
  14 kB gzipped. The first-run screen, the settings dialog and the debug panel
  are separate chunks. The browser downloads a chunk the first time it is
  needed.
- TheNews caches each feed in `localStorage`. A cached feed counts as fresh for
  5 to 60 minutes, depending on the source. A column renders its cached entries
  in the first frame and refetches a stale feed in the background.
- The source on screen loads first. TheNews then fetches the other enabled
  sources one after another at low priority, so a source is ready before the
  reader switches to it. A fresh cached feed costs no request.
- On the first-run screen, TheNews starts fetching a source when the reader
  switches it on.
- TheNews prefetches nothing when the browser reports data saver mode.
- TheNews removes the splash screen when the first column has content, and
  after three seconds at the latest. Columns without data show placeholder
  rows until the data arrives.
- When the reader returns to the tab or comes back with the back button,
  TheNews refetches stale feeds.

## Layout

The layout has no width breakpoints. The deck is a CSS grid with
`repeat(auto-fit, minmax(min(100%, var(--column-min)), 1fr))`, so it fits as
many columns of at least `--column-min` (24rem) as the width allows. A script
reads how many fit and displays that many consecutive sources, starting at the
one the reader chose. A phone shows one source, a 1440 px window three.

- The page itself scrolls at every width. No column has its own scrollbar.
- The tab bar is fixed to the bottom edge at every width. A dot marks each
  displayed source.
- Tapping a tab displays that source first and restores the scroll position.
  Tapping the tab of a displayed source scrolls to the top.

## Touch gestures

- Pull to refresh. A pull that starts at the top of the page brings down an
  indicator. Releasing it after the indicator has travelled 64 px fetches the
  feed of the column under the finger again, even if the cached copy is fresh.
- Swipes. An entry can be swiped left or right, and each direction has a short
  swipe (64 px) and a long swipe (160 px). The settings sheet assigns one
  action to each of the four. The actions are mark as read, mark as unread,
  block or unblock the linked site, open the comments, hide the entry, open in
  the browser, and switch to the next or previous source.
- While the finger is down, a label behind the row names the action that
  lifting the finger would carry out. A long movement falls back to the short
  swipe if the long one has no action.
- A swipe that switches the source moves the whole column, not the row under
  the finger. The label sits behind the column, at the center of the screen.
  The next and previous actions wrap around the ends of the reader's list.
  With only one source enabled, the swipe does nothing.
- A hidden entry stays hidden until the reader chooses "Show them again" in
  the settings sheet. TheNews keeps the 500 most recently hidden entries.
- "Open in the browser" opens a new tab. In a home screen web app on iOS it
  uses the `x-safari-https:` address to hand the link to Safari. Apple does
  not document that address, and it was not tested on a device.
- A tap within 0.4 seconds after a swipe is ignored, so that the swipe does not
  open the link.
- The tab bar hides after the page has scrolled down by 8 px and shows again
  after 8 px upwards. It is always shown within 64 px of the top and within
  24 px of the end of the page.

The numbers are constants in `src/ui/gestures.ts`.

Scrolling stays with the browser. The swipe rows use `touch-action: pan-y`, and
the one listener that can cancel a scroll, for pull to refresh, is attached
only while a touch that started at the top of the page is down.

## Debugging on a phone

Append `?debug` to the URL. TheNews then shows uncaught errors and the duration
of every feed request in a panel at the top of the page.

## Settings

TheNews stores four cookies. Their path is the directory that serves the app,
and they expire after 400 days.

| Cookie | Value |
| --- | --- |
| `thenews_sources` | Source ids in display order, joined by `.`. A `-` prefix marks a disabled source, as in `hn.github.-devto`. |
| `thenews_theme` | `light` or `dark`. Without the cookie, or with `auto`, the theme follows the system. |
| `thenews_newtab` | `1` opens links in a new tab. |
| `thenews_swipe` | The swipes that have an action, joined by `.`, as in `left_read.leftlong_hide.right_unread`. The swipes are `left`, `leftlong`, `right` and `rightlong`. |

TheNews keeps six more things in `localStorage`, because they are not
settings or can outgrow the 4096 bytes of a cookie.

| Key | Value |
| --- | --- |
| `thenews:blocked:v1` | The hosts of blocked sites. The list has no size limit. |
| `thenews:favorites:v1` | The hosts of favorited sites. The list has no size limit. |
| `thenews:read:v1` | The 500 most recently opened links. |
| `thenews:hidden:v1` | The 500 most recently hidden entries. |
| `thenews:hosted:v1` | When the feed of each hosted source was generated. |
| `thenews:feed:v1:<source>` | The cached feed of a source. |

TheNews does not use the browser's `:visited` state to dim links. That state
misses links opened from a home screen web app or a private window, and a
script cannot clear it when the reader marks an entry as unread.

"Start fresh" at the end of the settings sheet deletes the cookies and
every `thenews:` key, then shows the first-run screen. The button asks for a
second tap before it deletes anything.

A site can be favorited or blocked when an entry links away from its source,
as entries on Hacker News, Lemmy and Mastodon do. TheNews matches the exact
host without a leading `www.`, so favoriting `example.com` does not favorite
`news.example.com`. The highlight uses the accent colour of the theme, a star
before the site name and a faint tint behind the entry.

TheNews writes cookies with the Cookie Store API and falls back to
`document.cookie` in browsers without it. In browsers with the Cookie Store
API, a change in one tab updates the other open tabs.

Safari deletes cookies created in JavaScript and `localStorage` after 7 days
without a tap or click on the site, according to WebKit's
[tracking prevention policy](https://webkit.org/tracking-prevention/). After
that, TheNews shows the first-run screen again. The policy exempts web apps
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
3. Add its metadata to `SOURCES` and its adapter to `ADAPTERS` in
   `src/sources/index.ts`.
4. Cover `parse` in `test/sources.test.ts`.

A hosted source needs no adapter in the app:

1. Add `scripts/hosted/sources/<id>.mjs`. It default-exports an async function
   that returns the entries.
2. Run `node scripts/hosted/run.mjs <id> /tmp/feed.json` and check the file.
3. Add `.github/workflows/source-<id>.yml` with a schedule the source can bear.
4. Add its metadata to `SOURCES` with `hosted: true`.

Readers who have already chosen their sources see a new source at the end of
their list, switched off.

## Updates

Every build writes its id to `version.json`. When the reader returns to the
page, the app fetches that file, at most every 10 minutes, and reloads if the
id differs from its own. A web app on the home screen can stay in memory for
days, and without this check it would keep running the old release.

## Deployment

The workflow in `.github/workflows/pages.yml` runs the checks on every pull
request and deploys `main` to GitHub Pages. Before the first deployment, open
the repository settings, go to Pages, and set Source to GitHub Actions.

The build uses relative asset URLs, so it works under
`https://<owner>.github.io/news/` and on a custom domain.

## License

MIT
