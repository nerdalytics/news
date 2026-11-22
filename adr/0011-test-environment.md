# 11. The test environment is jsdom with stubs

Status: Accepted

## Context

Tests run in vitest's jsdom environment, which is not a full browser. Several APIs the app
uses are absent or behave differently, and a red test there can be an environment limit
rather than an app bug.

## Decision

- jsdom provides `HTMLDialogElement` and `PointerEvent` but not `dialog.close()`, layout
  (`getBoundingClientRect` returns zeros), `matchMedia`, or view transitions. Tests stub
  each: assign `dialog.close = vi.fn()`, fix the rect to a known box, stub `matchMedia`
  (and pick `matches` to select the branch), and stub `startViewTransition`.
- `closedBy` is absent from the prototype, so feature-detection fallback branches are
  reachable in tests.
- Feed fixtures use the field names of the live responses (verified against the services)
  but their content is invented; they are not real data.
- Modules that keep state in memory are imported fresh per test so state does not leak.

## Consequences

Tests exercise the real decision logic without a browser. When a DOM test fails, check
whether it is an environment gap (stub it) before treating it as an app bug.