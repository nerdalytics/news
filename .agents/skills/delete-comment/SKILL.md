---
name: delete-comment
description: Audit every code comment, categorise it (Tautology / Excuse / Stale / Decision Record), delete the dead ones, move decisions to ADRs, file issues for excuses, and ratchet the comment budget down. Use when asked to clean up comments, run /delete-comment, or reduce the comment budget.
---

# delete-comment

Repeatable comment audit for this repository. Comments must earn their place: a comment
that restates the code, rots, or excuses a hack is deleted; a comment that records a
non-obvious decision is moved to an ADR. The `comment-budget` file ratchets the allowed
count down over time; `npm run lint:comments` (part of `npm run ci`) fails above it.

## Tooling

- `node scripts/comments.mjs` — per-file comment counts and total comment lines.
- `node scripts/comments.mjs --json` — full inventory: every comment with `path`,
  `startLine`, `endLine`, `type`, and `text`. Save it before deleting anything.
- `node scripts/strip-comments.mjs` — deletes every comment except functional
  `biome-ignore` suppressions. Run only after the decision records are saved to ADRs.
- `node scripts/lint-comments.mjs` — fails if non-exempt comments exceed `comment-budget`.
- `node scripts/lint-comments.mjs --write-budget` — ratchet the budget to the current count.

`biome-ignore` comments are functional lint suppressions and are always exempt.

## Procedure

1. Inventory: `node scripts/comments.mjs --json > /tmp/comments.json`. Record the total
   comment lines (the estimate of lines shed).
2. Categorise every comment in the inventory:
   - **Tautology** — restates what the code already shows (a JSDoc that paraphrases the
     function name, a CSS section header like `/* Skeleton */`, a `// increment i`). Delete.
   - **Stale** — references code, dates, or facts that no longer hold (a "checked on
     <date>" fixture note whose date has rotted). Delete.
   - **Excuse** — justifies a hacky implementation that should be fixed instead. Delete the
     comment and file an issue (`gh issue create`) describing the hack and the fix.
   - **Decision Record** — documents an important, non-obvious decision, constraint,
     invariant, or browser quirk (the why, not the what). Move it to an ADR.
3. Move decision records to `adr/NNNN-topic.md` (Status / Context / Decision /
   Consequences). Group related decisions into one ADR. Reference modules and functions by
   name, never by line number (line citations rot).
4. File an issue for each Excuse. If there are none, say so explicitly.
5. Delete the comments: `node scripts/strip-comments.mjs` (the decision-record text is
   already saved in the inventory and the ADRs). Then `npm run format`.
6. Ratchet: `node scripts/lint-comments.mjs --write-budget` to lower `comment-budget` to
   the new count. The budget only goes down.
7. Prove the gate: `npm run ci` (biome, types, tests, build, comment budget).

## Judgement notes

- A unit or contract that the type does not show (e.g. "epoch milliseconds" on a `number`)
  is a decision record, not a tautology.
- A documented browser fallback (e.g. `document.cookie` where the Cookie Store API is
  unsupported) is a decision record, not an excuse; the `biome-ignore` stays.
- When unsure whether a comment is a decision record, keep it as an ADR rather than lose
  the knowledge.