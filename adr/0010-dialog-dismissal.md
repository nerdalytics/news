# 10. Dialog dismissal falls back to pointer position

Status: Accepted

## Context

Dialogs should close on a click outside, Esc, or the Android back gesture. The `closedby`
attribute provides this natively, but Safari does not support it.

## Decision

Dialogs set `closedby="any"` where supported. For browsers without it, `enableOutsideDismiss`
tests the pointer position rather than the event target, because the dialog is also the
target for clicks on its own padding and the gaps between its children. Both the press and
the release must land outside, so a text-selection drag that ends on the backdrop does not
dismiss the dialog. The first-run screen disables Esc because the reader must choose a
source.

## Consequences

Outside-dismiss behaves the same with and without `closedby`, and accidental drags do not
close a dialog. The fallback can be removed once Safari ships `closedby`.