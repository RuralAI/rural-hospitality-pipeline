# Bundled-Copy Drift in the Skills Pipeline

Plain-language explainer of what "bundled-copy drift" is, why it happens, and
what we're doing about it. Written 2026-07-13.

## Why the skills carry copies at all

When a skill runs in Claude Desktop, its code executes in an isolated sandbox
that contains **only the files zipped into the `.skill`**. It cannot import
from this repo's `src/` — the repo isn't there at runtime. So every skill has to
carry its own self-contained copy of any logic it needs. Those bundled `.mjs`
files are genuine Node files, just standalone copies rather than imports.

## What drift is

When you improve the canonical code in `src/` (or `config/`), the copies inside
the skills do **not** update automatically. They silently fall behind. That is
exactly what happened with the geocoding bug: `src/lib/normalize.js` had the
bare-state-code fix (`expandStateCode`), but `firm-discovery`'s bundled copy
didn't — so "Bayfield CO" resolved to Bayfield, Wisconsin until we caught it in
the live validation run.

## The three categories of skill file

Not every bundled file is a drift problem. There are three kinds:

| Category | Files | Drift risk |
|---|---|---|
| **Verbatim copies** of a canonical source | `contact-extraction/stage-02-extraction.mjs` (= `src/pipeline/stage-02-extraction.js`); `email-generation/email-templates.mjs`, `region-travel.mjs`, `region-naming.mjs`, `client-data.json` (= the `config/` files) | Byte-identical today, but nothing stops them drifting the moment someone edits the source and forgets to re-copy. |
| **Diverged amalgam** | `firm-discovery/lib.mjs` — a hand-flattened merge of a *subset* of `src/lib/normalize.js` (plus geo logic) plus skill-specific helpers | Already drifted once. The hardest to keep in sync because it isn't a clean 1:1 copy. |
| **Skill-only glue** | the CLI runners `discover.mjs` / `extract.mjs` / `compose.mjs`; `signature.mjs`; `lib.mjs`'s `mapToFirm` / `loadExistingNames` | None — these legitimately live only in the skill. |

## The goal

Make `src/` and `config/` the **single source of truth**, and make the skill
copies **generated from it** at package time — so a skill can never ship stale
logic again. The hard constraint: whatever we do must still produce
*self-contained* skill files, because the sandbox can't import from `src/`.

Chosen direction (2026-07-13): **generate the copies from `src/` during
packaging**, so hand-editing them is impossible and they can't drift. Design and
implementation tracked separately.
