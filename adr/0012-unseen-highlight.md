# 12. Unseen items: per-source seen lists, visit-stable highlights

Status: Accepted

## Context

Readers want items they have never seen before to stand out: a bold headline and a brief
flashlight sweep across the row. "Unseen" is per source: an item is new until the reader
has visited the source showing it; on the next visit it is ordinary, even if it was never
opened. The read marks (`read.ts`) do not fit: they track opened links, not shown items,
and are global rather than per source.

## Decision

- `seen.ts` keeps one recency list per source (`thenews:seen:v1:<id>`, `url-list`, 200
  entries), written in one batch through `UrlList.addAll`. Like the other lists it is
  best-effort (ADR 5) and cleared by `startFresh` with the rest of the `thenews:` keys.
- `Column` owns a `fresh` set of URLs highlighted for the current visit. On the
  hidden-to-visible transition (`setVisible`, called by `Deck.applyLayout` before
  `activate`) it adopts the shown feed: every item not yet seen joins `fresh`, then all
  shown items are marked seen. On becoming hidden, `fresh` is cleared.
- Renders while visible adopt the same way, so a pull-to-refresh adds only the arrivals
  to `fresh`; highlights already granted this visit survive re-renders (a resize or a
  refresh returning the same feed must not strip them). Renders while hidden (prefetch)
  never mark seen, so a prefetched source still greets the reader with its new items.
- The first ever visit to a source highlights everything: nothing has been seen yet.
- The headline weight rises from 600 to 800 via `.is-unseen .title`, outside the motion
  media block so reduced-motion readers keep the signal.
- The flashlight is a `::before` pseudo-element inset to the row box, a soft brand-tinted
  gradient band (`background-size: 250% 100%`) swept left to right by animating
  `background-position` only. Because nothing transforms or overflows, the light cannot
  spill into neighbouring rows. It lives inside the `prefers-reduced-motion:
  no-preference` block (ADR 3), runs twice with the row-in stagger delay, and uses
  `backwards` fill so the band rests off-row before and after the sweep.

## Consequences

Returning to a source shows a calm list; only genuinely new arrivals flash and bold.
Seen state costs one small localStorage list per source and survives reloads. An item
evicted from the 200-entry list could highlight again if it reappears in a feed, which
requires it to stay in a top-20 feed across many visits.
