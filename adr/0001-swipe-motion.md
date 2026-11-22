# 1. Swipe motion derives from one value

Status: Accepted

## Context

Entries swipe horizontally by touch, pen or mouse drag, while the browser must keep
handling vertical scrolling. A swipe can act on the row (read, hide, favorite, block,
comments, browser) or switch the whole source (next, previous). Early designs that
animated the row and the view as separate animations smeared into a double image at the
handover, and labels that chased the finger trailed it.

## Decision

The script writes a single custom property, `--dx` (the finger's horizontal distance),
registered as a `<length>` so it interpolates. Every moving part derives its offset from
`--dx` with `calc()` alone (see `styles.css`, `ui/swipe.ts`, `ui/gestures.ts`).

- Nothing transitions while the finger is down, so no layer can lag another and smear.
- A plain row swipe moves the row content directly, capped at `--swipe-max`.
- A source swipe hands over to the view at the action's distance (`--swipe-at`): the view
  offset is `--dx` minus the row offset, so the row never reverses or lags. The rejoin
  slope `max / (max - at)` lands the row home exactly at the travel limit.
- On release the deck transitions `--dx` back to zero, the one movement that may animate;
  every offset glides home together. A source swipe first jumps `--dx` to full travel
  (without a transition) so a short swipe moves the view as visibly as a long one.
- Two hint labels name the pending action: one anchored to the row, one for a source
  swipe. Each is placed once when its anchor changes and only its opacity crossfades;
  both sit at the swiped row's vertical centre so switching never jumps the label.
- Rows use `touch-action: pan-y`; clicks are suppressed for 400ms after a swipe, and the
  settle timer (200ms) outlasts the release glide so cleanup never cuts it short.

## Consequences

The motion is one continuous function of `--dx`, identical in both directions, with no
racing animations. The gesture math lives in `ui/gestures.ts` apart from the event
handling so it is testable without a browser.