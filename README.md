# TheNews

TheNews puts the top 20 entries of Hacker News, GitHub and other sources on
one page. You do not need an account. Open it, pick your sources, and read.

**Open TheNews: <https://nerdalytics.github.io/news/>**

On a phone you can add it to your home screen, and it opens in its own
window.

## Getting started

On your first visit TheNews asks you to choose your sources. Every source
starts switched off. Switch on what you want to read, drag the sources into
the order you like, and tap **Start reading**. You can change both at any
time in the settings.

## Sources

| Source | What it shows | Discussion |
| --- | --- | --- |
| Hacker News | Top stories | comments |
| GitHub | Most starred new repos this week | none |
| DEV | Top posts today | comments |
| Lemmy | Technology on lemmy.world | comments |
| The Next Web | Latest stories | none |
| Mastodon | Trending links on mastodon.social | none |
| Stack Overflow | Hot questions this week | answers |
| Hugging Face | Trending models | none |
| Wikipedia | Most read articles yesterday | none |
| Show HN | Projects shared on Hacker News | comments |
| Uneed | Today's launch ranking | none |
| Nick Launches | This week's launches by upvotes | comments |
| Launch Llama | Top products this week | none |
| Lobsters | Hottest stories | comments |
| BetaList | Newest startups | none |
| DevHunt | This week's launches, from rank 41 | none |
| Smol Launch | This week's ranking | comments |
| Product Hunt | Today's top products, not available yet | comments |

Good to know:

- The lists of Lobsters, BetaList, DevHunt and Smol Launch update only every
  few hours, so they can lag behind the source's own site. If one of them
  stops updating for three days it disappears from your list until it
  recovers. TheNews remembers your choice.
- TheNews does not show Hacker News job posts.
- If a source cannot load, it shows a message and a **Try again** button.

## Reading

- Every source shows up to 20 entries.
- Tap an entry to open it. Where a source has discussions, tap the comment
  count to go straight to them.
- TheNews dims entries you have opened, so you can see what is still unread.
- Pull down at the top of the page to refresh the source you are looking at.
- On a wide screen several sources sit side by side. On a phone you see one
  at a time. The tab bar at the bottom jumps between sources and hides
  itself while you scroll down.
- A source you have visited before shows its entries immediately and
  refreshes in the background.
- The page updates itself when a new version is available.

## Swipe gestures

You can swipe every entry left or right. Each direction has a short and a
long swipe, so there are four gestures. In the settings you can give each
one an action:

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

Tap the name of the site an entry links to, such as `slate.com`, to favorite
or block it.

- Entries from a favorited site carry a star and a faint tint.
- Entries from a blocked site stay in the list, dimmed, with the site name
  crossed out.
- Tap the name again to undo either.

The choice applies to that exact site. Favoriting `example.com` does not
favorite `news.example.com`.

## Settings

The settings button in the tab bar lets you:

- Switch sources on and off and drag them into any order.
- Choose whether the theme follows the system or stays fixed on light or
  dark.
- Choose whether links open in a new tab.
- Assign the swipe actions and bring back hidden entries.

**Start fresh** deletes everything TheNews stored in this browser and
returns you to the first-run screen. It asks for a second tap before it
deletes anything.

## Your data

TheNews keeps everything in your browser: your sources and their order, the
theme, the swipe actions, favorite and blocked sites, and the entries you
have opened or hidden. It does not send your choices anywhere.

Safari forgets a site's stored choices after about a week without a visit,
so TheNews may ask you to pick your sources again. Adding it to the home
screen avoids this.

## Reporting a problem

Something not working? Report it at
<https://github.com/nerdalytics/news/issues>.

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

A GitHub workflow checks every push to `main` and deploys it to GitHub
Pages.

## License

MIT