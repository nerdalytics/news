# 3. Motion is opt-in; the theme glides by colour, not opacity

Status: Accepted

## Context

Readers who prefer reduced motion must get a safe, static path by default, not through an
override. A theme switch implemented as an opacity view-transition crossfade faded the
settings dialog's opaque background and let the source entries behind it show through.

## Decision

- Duration variables (`--fast`, `--micro`, `--sheet-move`, `--bar-move`) stay `0s` at the
  root. A single `@media (prefers-reduced-motion: no-preference)` block restores them, so
  reduced motion is the default and motion is opt-in.
- `--micro` is twice `--fast`, the beat for state marks and pops so they are noticed; it
  is registered as a `<time>` so script (the reorder glide) can read its computed value.
- The theme change interpolates colours (`background-color`, `color`) via `light-dark()`
  rather than crossfading opacity, so the settings dialog stays opaque and the sources
  behind it never show through. This also makes OS-driven theme changes glide.
- The row entrance stagger uses `animation-fill-mode: backwards` (not `both`) so an
  arrived row releases opacity and translate for the hide-exit transition to move them.

## Consequences

Reduced-motion readers get static UI by default. Theme switches glide cleanly on every
trigger without revealing the page behind a dialog.