# 4. Hosted sources are fetched by GitHub workflows

Status: Accepted

## Context

Many feeds cannot be read from a browser: they send no CORS header or need an API key.
The app is a static page with no server of its own.

## Decision

- A direct source uses a public endpoint that sends CORS headers; the browser reads it
  itself. A hosted source is fetched by a per-source GitHub workflow of this repository
  on a schedule, which force-pushes one file, `feed.json`, to a branch `data-<source>`.
  The app reads that file through `raw.githubusercontent.com`, which sends
  `Access-Control-Allow-Origin: *`.
- The feed file is produced by this project but is still validated like any other input
  (minimum entries, generation time).
- A hosted source is listed only after the app has read a feed recent enough. A workflow
  that has not published within the staleness limit counts as broken; the source is hidden
  from the tabs and settings. A feed's age is the workflow run that produced it, not the
  last download.
- A network failure says nothing about the feed, so the last known availability stays.
- Product Hunt needs a developer token, passed to its workflow from the repository secret
  `PRODUCTHUNT_TOKEN`. Its API must not be used commercially.

## Consequences

The static app can show keyless and non-CORS feeds without a backend. A hosted source
appears when its first feed arrives and disappears when its feed goes stale; the settings
sheet re-checks hidden hosted sources in case a workflow recovered.