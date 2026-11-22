# 6. iOS home-screen web app integration

Status: Accepted

## Context

The app runs as a home-screen web app on iOS, which behaves differently from a browser
tab: it opens every link in its own built-in view, and the page can stay in memory for
days. Pull-to-refresh must coexist with the system's own overscroll and reload gesture.

## Decision

- Opening a link: in a browser tab it opens a new tab. In an iOS home-screen web app the
  link goes through the `x-safari-https:` address, which hands it to Safari. Apple does
  not document that address; if it stops working, nothing opens. The home-screen state is
  detected via `navigator.standalone`.
- Pull-to-refresh: a pull that starts at the top of the page brings down an indicator;
  releasing far enough refreshes the column under the finger. The `touchmove` listener
  must cancel the browser's own overscroll, so it cannot be passive; it is attached only
  while a touch that started at the top is down, so scrolling elsewhere is unaffected.
  The indicator follows the finger directly and grows slightly at the commit point.

## Consequences

Links escape the home-screen web view into Safari. Pull-to-refresh works without fighting
the system gesture, and ordinary scrolling carries no non-passive listener. The
`x-safari-https:` reliance is a known, undocumented risk with no alternative API.