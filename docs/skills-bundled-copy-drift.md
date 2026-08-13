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

## There are two hops, and both need guarding

The goal above was stated as "a skill can never ship stale logic again." That was
half true, because the code travels **two** hops and only the first was checked:

```
src/ + config/  --(1) sync-skills.mjs-->  skills/<name>/  --(2) package-skill.sh-->  install/<name>.skill
```

Hop 1 is guarded by `npm run sync:skills:check` and `skills/sync.test.mjs`.

Hop 2 was unguarded until 2026-07-27, and it drifted for real: the Apollo work
added an `"Apollo"` choice to `Contacts.contact-source` in
`config/airtable-schema.mjs`, sync carried it into
`skills/client-onboarding/table-schema.mjs`, and `npm test` went green — but
`install/client-onboarding.skill` was never rebuilt. **`install/` is the copy people
actually install**, so the shipped skill provisioned bases missing a field value
that `apollo-search.mjs` writes to, while every test in the repo passed.

`skills/install-drift.test.mjs` now guards hop 2: for each skill it compares the
archive's file list and every file's bytes against `skills/<name>/`, and fails
with `Run: npm run package:skills`. It reads archives with `unzip`, which
`package-skill.sh` already requires.

The lesson worth keeping: a green test suite only proves the hops you actually
check. Verify the artifact you ship, not just the source it came from.
