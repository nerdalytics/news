# 12. Unseen items: viewport-based seen lists, flash on scroll-in

Status: Accepted

## Context

Readers want items they have never physically seen to stand out: a bold headline and a
brief flashlight sweep as the row comes into view. "Seen" means the row actually appeared
on screen, not merely that its source was opened: on a phone only the first rows fit, and
rows below the fold must stay new until scrolled to. Seen is per source and distinct from
read (`read.ts` tracks opened links globally); a seen item is ordinary on the next visit
even if it was never opened.

## Decision

- `seen.ts` keeps one recency list per source (`thenews:seen:v1:<id>`, `url-list`, 200
  entries), batch-written through `UrlList.addAll`. Best-effort like the other lists
  (ADR 5) and cleared by `startFresh` with the rest of the `thenews:` keys.
- `Column` observes its rows with an `IntersectionObserver`. An item is marked seen only
  when it intersects the viewport (`onIntersect`); rows below the fold are never marked,
  so they remain new across reloads until the reader scrolls to them. The observer is
  connected while the column is visible and disconnected when hidden; a hidden column
  marks nothing seen, so a prefetched source still greets the reader with its new items.
- `Column` keeps a `fresh` set of URLs that are new this visit. `paintFresh` re-applies the
  bold to those rows after a re-render so a resize or pull-to-refresh does not strip the
  visit's highlights, but it never triggers the flash. On becoming hidden, or on
  `endVisit`, `fresh` is cleared.
- Two classes split the signal from the effect: `.is-unseen` bolds the headline (weight
  600 to 800, outside the motion block so reduced-motion readers keep it); `.is-flashing`
  runs the sweep and is added only in `onIntersect`, i.e. only when an unseen row enters
  view. The flashlight therefore never runs for a row outside the physical view, even
  when `paintFresh` re-bolds an off-screen row, and it plays as the row scrolls in.
- The flashlight is a `::before` pseudo-element inset to the row box, a soft brand-tinted
  gradient band (`background-size: 250% 100%`) swept left to right by animating
  `background-position` only, so it cannot spill into neighbouring rows. It lives inside
  the `prefers-reduced-motion: no-preference` block (ADR 3), runs twice, and uses
  `backwards` fill so the band rests off-row before and after the sweep.
- Returning to the app ends the visit. A home-screen web app resumes rather than reloads,
  so `Deck.onResume` calls `Column.endVisit` before `activate` for each visible column.
  A `wasHidden` flag (set on `visibilitychange` to hidden, and on a persisted `pageshow`)
  gates this so it fires only on a genuine return from background, not on the initial
  load's `visibilitychange`, which would otherwise wipe the first visit's highlights.

## Consequences

Only rows the reader actually sees are marked seen; below-fold rows stay new until
scrolled to, and the sweep plays as they enter view. Returning to a source or resuming
the app shows a calm list with only genuinely new arrivals bold. Seen state costs one
small localStorage list per source and survives reloads. An item evicted from the
200-entry list could highlight again if it reappears in a feed, which requires it to stay
in a top-20 feed across many visits.