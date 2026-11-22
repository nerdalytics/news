# 0. Comment audit and the comment ban

Status: Accepted (2026-11-22)

## Context

Comments accrue that restate the code, rot, or excuse hacks. This audit categorised every
code comment in `src`, `scripts`, `test`, `vite.config.ts` and `index.html`, removed the
dead ones, and preserved the decisions as ADRs (0001-0011).

## Method

`scripts/comments.mjs` extracts every comment (a scanner that skips strings and template
literals). Each comment was categorised:

- **Tautology** — restates what the code shows: JSDoc paraphrasing a function or field
  name, CSS section headers (`/* Skeleton */`, `/* Motion */`), and obvious `//` notes.
  These were the majority. Deleted.
- **Stale** — rotting references, notably the fixture notes "checked on 2026-11-19 /
  2026-11-15" in `test/hosted-feed.test.ts` and `test/sources.test.ts`. Deleted; the
  durable substance (fixtures match live field names, content is invented) is in ADR 0011.
- **Excuse** — none found. The codebase carries no hack-justifying comments. The two
  `biome-ignore noDocumentCookie` suppressions in `src/cookies.ts` are a deliberate,
  documented fallback (Cookie Store API is unsupported in Safari/Firefox), not an excuse;
  they are functional and kept (ADR 0005). No issues were filed.
- **Decision Record** — the non-obvious why: the swipe motion model, scroll containment,
  opt-in motion, hosted-source architecture, storage conventions, iOS quirks, adapter
  constraints, update detection, the deck window and transitions, dialog dismissal, and
  the test environment. Moved to ADRs 0001-0011 and deleted from the code.

## Result

- 460 comments, 761 comment lines audited.
- 759 comment lines removed; 2 functional `biome-ignore` lines kept.
- 77 files changed, ~790 lines shed (759 comment lines plus the blank lines the formatter
  collapsed).

## The ban and the ratchet

`scripts/lint-comments.mjs` (npm `lint:comments`, part of `ci`) counts non-exempt comments
and fails above the `comment-budget` file. The budget ratchets down only:
`node scripts/lint-comments.mjs --write-budget` sets it to the current count. It is now 0.
`biome-ignore` comments are always exempt. The `/delete-comment` skill
(`.agents/skills/delete-comment`) repeats this audit.

## Consequences

The code carries no comments except functional lint suppressions; the decisions live in
`adr/`. New comments fail the gate unless the budget is deliberately raised, and the
skill lowers it again after each cleanup.