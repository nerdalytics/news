# 7. Source adapter constraints

Status: Accepted

## Context

Each source adapter reads a public API or feed. Several have non-obvious constraints that
shape the implementation; these were verified against the live services.

## Decision

- Hacker News uses two parallel requests: the official Firebase API returns the front-page
  order as ids, and one Algolia HN Search request returns those stories with points and
  comments. The official API alone would need one request per story. More ids than needed
  are compared because the search index lacks job posts; when the two answers disagree,
  the ids are looked up directly. Ask HN / text posts have no URL, so they link to the
  discussion. Show HN uses the same pattern in page order.
- GitHub has no API for github.com/trending; the adapter uses the Search API for
  repositories created in the last week, ordered by stars.
- Stack Exchange is used without a key; all keyless requests from one IP share a daily
  quota (`quota_max: 300`). The 30-minute cache limits automatic refreshes to 48 a day per
  reader. The API HTML-encodes titles.
- Nick Launches' trailing slash matters: without it the server redirects, and the redirect
  carries no CORS header.
- Lemmy posts link to the post page on the local instance (`ap_id` can point to another
  server); cross-posted links are deduplicated, keeping the highest-ranked.
- Wikipedia's feed answers 404 for a day it has not compiled yet (shortly after midnight
  UTC yesterday's list may not exist); that is treated as an empty list.
- Medium appends an `rss` tracking parameter to every link; it is stripped. DevHunt's
  route is the home page's load-more endpoint, starting at rank 41, each entry carrying
  its real rank. Lobsters text posts have no link, so the discussion is the entry.
- Product Hunt entries open the product's own site; the comment count opens the Product
  Hunt discussion.
- BetaList titles embed a one-line description after an en-dash (`Name – description`);
  the probe splits on the en-dash, taking the first part as the title and the rest as the
  description, and strips `utm_` tracking parameters from the link.

## Consequences

The adapters stay keyless and CORS-safe where possible. The quirks above are properties
of the external services, not choices to revisit lightly.