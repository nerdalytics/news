# 2. Scroll containment, scrollbars, and the dialog backdrop frost

Status: Accepted

## Context

The app has several scrollers (the page, the settings sheet, the tab strip). Inconsistent
scrollbar styling once shrank only some scrollers' bars. Modal dialogs must not let a
gesture chain to the page behind them. On iOS the content under the notch is blurred by
native status-bar vibrancy, and that blur vanished when a modal dialog took the top layer,
leaving a hard cut-off.

## Decision

- The operating system draws every scrollbar; no visible scroller sets a `scrollbar-*`
  property or a `::-webkit-scrollbar` rule. The one exception is the bottom tab strip,
  whose bar is hidden entirely (chrome, not content).
- `html` uses `overscroll-behavior-y: contain` and `scrollbar-gutter: stable` so opening a
  dialog (which hides the document scrollbar) does not shift the page.
- Modal dialogs use `overscroll-behavior: contain` on the dialog and its backdrop. Safari
  does not support it, so `html:has(dialog[open]) { overflow: hidden }` is the fallback
  there.
- The dialog backdrop uses `backdrop-filter: blur(20px)` so the page behind (notch
  included) stays soft while the sheet is open, matching the native vibrancy instead of
  cutting off.

## Consequences

Every scroller looks the same; dialogs do not scroll the page; the notch stays blurred
behind a sheet. The backdrop frost is a progressive enhancement where `backdrop-filter`
is unsupported.