# 8. Update detection for a long-lived page

Status: Accepted

## Context

A home-screen web app can stay in memory for days, so it never loads the new files of a
later release. The app must notice a new build without a reload loop.

## Decision

Every build writes its id to `version.json` (the same value is injected as a build
constant). When the reader returns to the page, the app compares that file with the id it
was built with and reloads if they differ. The check is throttled to a minimum interval.
A reload remembers the build it was made for in session storage, so a stale server copy
cannot cause a reload loop; without session storage there is no loop protection, so the
app does not reload at all. Offline or a missing file (as on the development server) is
ignored.

## Consequences

Long-lived pages pick up new releases on return. The loop guard makes the reload safe even
if the server serves a stale `version.json`.