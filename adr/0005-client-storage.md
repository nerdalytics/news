# 5. Client storage is best-effort

Status: Accepted

## Context

The app has no accounts and no server; settings, read marks, blocked/favorite sites and
cached feeds live in the browser. Storage can be blocked (private mode) or full, and
stored data can be invalid or set by another page on the origin.

## Decision

- Every read tolerates blocked storage and invalid data and starts from nothing known;
  every write tolerates failure, and the in-memory state still applies to the current
  visit.
- Cookies are read synchronously because the app needs settings before the first paint.
  Chrome caps cookie lifetime at 400 days. The Cookie Store API is used where available,
  with `document.cookie` as the fallback (the two `biome-ignore noDocumentCookie`
  suppressions are this deliberate fallback).
- Read marks are tracked in `localStorage`, not the browser's `:visited` state: `:visited`
  misses links opened from a home-screen web app or a private window, and a script cannot
  clear it when the reader marks an entry unread.
- The read and hidden lists are recency lists (`url-list`): re-adding moves a URL to the
  end so the oldest entries drop out first; each keeps a fixed maximum.
- Blocked and favorited hosts live in `localStorage` because they can outgrow the 4096
  bytes of a cookie.
- Cookie formats: sources are ids in display order joined by `.`, a `-` prefix marks a
  disabled source (`hn.github.-devto`); unknown ids are dropped and unmentioned catalogue
  sources are appended switched off. Swipes are `slot_action` joined by `.`
  (`left_read.leftlong_hide`).

## Consequences

The app works in private mode and degrades gracefully when storage fails. A `storage`
event (fired in other tabs, not the writer) applies cross-tab settings changes.