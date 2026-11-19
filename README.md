# TheNews

TheNews puts the top 20 entries of Hacker News, GitHub and sixteen other
sources on one page. No account, no sign-up — open it, pick your sources,
read.

**Open TheNews: <https://nerdalytics.github.io/news/>**

It works in any modern browser, on a phone or a desktop. On a phone you can
add it to your home screen and it runs like an app.

## Getting started

On your first visit TheNews asks you to choose your sources. Nothing is
switched on by default. Switch on what you want to read, drag the sources
into the order you like, and tap **Start reading**. You can change both at
any time in the settings.

## Sources

| Source | What it shows | Discussion |
| --- | --- | --- |
| Hacker News | Top stories | comments |
| GitHub | Most starred new repos this week | — |
| DEV | Top posts today | comments |
| Lemmy | Technology on lemmy.world | comments |
| The Next Web | Latest stories | — |
| Mastodon | Trending links on mastodon.social | — |
| Stack Overflow | Hot questions this week | answers |
| Hugging Face | Trending models | — |
| Wikipedia | Most read articles yesterday | — |
| Show HN | Projects shared on Hacker News | comments |
| Uneed | Today's launch ranking | — |
| Nick Launches | This week's launches by upvotes | comments |
| Launch Llama | Top products this week | — |
| Lobsters | Hottest stories | comments |
| BetaList | Newest startups | — |
| DevHunt | This week's launches, from rank 41 | — |
| Smol Launch | This week's ranking | comments |
| Product Hunt | Today's top products — not available yet | comments |

Good to know:

- Most sources are read live from your browser. Four of them — Lobsters,
  BetaList, DevHunt and Smol Launch — are fetched on a schedule, every one to
  three hours, so their lists can lag a little behind the source's own site.
  If one of them stops updating for more than three days it disappears from
  your list until it recovers. Your choice is remembered.
- Product Hunt needs an API token that is not set up yet, so it does not
  appear in the app.
- DevHunt's list starts at rank 41 because its public API does not offer the
  top 40.
- Hacker News job posts are not shown.
- GitHub and Stack Overflow limit how often one IP address may ask. On a
  shared connection, a mobile network for example, you can hit that limit.
  The source then shows a message with a **Try again** button.

## Reading

- Every source shows up to 20 entries.
- Tap an entry to open it. Where a source has discussions, tap the comment
  count to go straight to them.
- Entries you have opened are dimmed, so you can see what is still unread.
- Pull down at the top of the page to refresh the source you are looking at.
- On a wide screen several sources sit side by side; on a phone you see one
  at a time. The tab bar at the bottom jumps between sources and hides
  itself while you scroll down.
- Feeds are cached in your browser, so a page you have visited before shows
  its entries immediately and refreshes in the background.
- When a new version of TheNews ships, the page updates itself the next time
  you come back to it.

## Swipe gestures

Every entry can be swiped left or right, and each direction has a short and
a long swipe — four gestures in total. In the settings you can give each one
an action:

- Mark as read, or mark as unread
- Favorite or block the site the entry links to
- Open the comments
- Hide the entry
- Open the link in the browser
- Switch to the next or previous source

No swipe does anything until you assign an action. While you swipe, a label
shows what will happen when you let go. The same gestures work with a mouse
drag on a desktop.

Hidden entries stay hidden until you bring them back with **Show them
again** in the settings.

## Favorite and block sites

Tap the name of the site an entry links to — `slate.com`, for example — to
favorite or block it.

- Entries from a favorited site carry a star and a faint tint.
- Entries from a blocked site stay in the list, dimmed, with the site name
  crossed out.
- Tap the name again to undo either.

The choice applies to that exact site: favoriting `example.com` does not
favorite `news.example.com`.

## Settings

The settings button in the tab bar opens a sheet where you can:

- Switch sources on and off and drag them into any order.
- Choose the theme: follow the system, or stay fixed on light or dark.
- Choose whether links open in a new tab.
- Assign the swipe actions and bring back hidden entries.
- **Start fresh**: delete everything TheNews stored in this browser and
  return to the first-run screen. It asks for a second tap before it deletes
  anything.

## Your data

TheNews has no accounts and no server of its own. Everything it remembers —
your sources and their order, the theme, the swipe actions, favorite and
blocked sites, opened and hidden entries, cached feeds — is stored in your
browser, in cookies and local storage.

Safari deletes data stored by a website after seven days without a visit. If
that happens, TheNews shows the first-run screen again and you pick your
sources once more. A copy added to the home screen is exempt from this rule.

## Reporting a problem

Open an issue at <https://github.com/nerdalytics/news/issues>. If something
fails on a phone, append `?debug` to the address: TheNews then shows errors
and the duration of every feed request at the top of the page.

## Development

TheNews is a static site built with Vite and TypeScript. Development needs
Node.js 22.12 or newer.

```sh
npm install
npm run dev        # start the dev server
npm run ci         # run lint, typecheck, unit tests and a production build
npm run format     # apply the formatter and safe lint fixes
npm run preview    # serve the production build
```

Every push to `main` is checked and deployed to GitHub Pages.

## License

MIT