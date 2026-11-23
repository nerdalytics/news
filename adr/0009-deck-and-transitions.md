# 9. The deck window, scroll restore, and source transitions

Status: Accepted

## Context

The deck shows as many source columns as the width allows, with no breakpoints. The
reader switches sources by tapping a tab or swiping; the app must keep scroll position
usefully and animate the switch consistently.

## Decision

- The deck is a CSS grid that fits columns of at least `--source-min` (a registered
  `<length>` the script reads in pixels). It displays that many consecutive sources
  starting at the chosen one and hides the rest; the page itself scrolls in every case.
  The window moves as a whole (`windowStep`), so a swipe works from every column and wraps
  around the ends.
- The displayed sources load first; the others are prefetched one at a time at low
  priority so they are ready when the reader switches. A fresh cached feed costs no
  request.
- Scroll position is remembered per first-displayed source. On re-visit, if the source's
  top entry id changed since the reader last saw it (new arrivals), the view starts at the
  top; an unchanged feed keeps the reader's place. Tapping the already-displayed tab
  scrolls to the top.
- A tab tap switches the source with a directional view transition: the deck is named,
  and the fixed bar is captured too and its group stacked above the deck's (z-index) so it
  stays on top. The transition is skipped while a swipe is still gliding home. A swipe
  switches via the `--dx` glide instead, so the two paths never double-animate.
- Drag-reorder glides the pushed rows with a FLIP animation over one `--micro` beat; the
  dragged row is excluded (it follows the pointer). Reduced motion (0s) skips the glide.
  Hit-testing uses the layout slots captured at each swap, scroll-compensated, never the
  live rects: a pushed row mid-glide still visually covers the pointer, and hit-testing
  its animated rect swaps it back, oscillating the order and misplacing the drop.
  A settings re-render (source availability change) is deferred while a drag is active
  and applied on release, so the dragged row is never detached mid-gesture.
  The drag lifts and starts swapping only after the first moved pixel, so a tap on the
  handle is inert. An SVG order-thread was tried and removed: drawing a 1-D order onto
  the 2-D grid reserved space and looked strange on narrow screens. Instead the dialog
  shows a live icon-strip preview (the enabled badges in strip order) above the grid; it
  re-renders on every change and highlights/scrolls to the source currently being
  reordered, so the grid-to-strip mapping is visible without explaining the grid order.
  A view-transition alternative was spiked and rejected: it defers the DOM mutation to an
  async capture callback (breaking the synchronous drag and keyboard tracking) and skips
  rapid successive transitions (9 of 10 in a measured burst), losing swaps.

## Consequences

Source switching is consistent whether by tap or swipe, the bar never gets covered, and
new arrivals are surfaced while a quiet feed keeps the reader's place.