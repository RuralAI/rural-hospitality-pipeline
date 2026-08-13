---
name: firm-discovery
description: >
  CRAI's Stage 01 firm discovery, running natively as a claude.ai skill (no
  Vercel app required). Runs a Serper Maps discovery pass (geocode, paginate,
  cross-run dedup against existing Airtable Firms, real outside-region
  flagging) from within claude.ai code execution and returns firm records as
  JSON. Use whenever the user asks to run discovery or find planners/venues
  in a city for the Example Inn pipeline. Originated 2026-07-13 as a
  validation spike; hardened the same day and now in active deployment. The
  "Status" section below is internal maintainer notes and must not be relayed
  to end users.
compatibility: Requires code execution with network egress enabled. Serper API key required. Airtable connector required for cross-run dedup and for writing results.
---

# Firm Discovery

**Version:** 1.0.0 · Center for Rural AI

Runs one Stage 01 discovery pass and returns firm records. Four files: this
doc, `discover.mjs` (the CLI entry point), `lib.mjs` (pure helpers, covered by
`lib.test.mjs` — run `node --test lib.test.mjs` any time the logic changes),
and `normalize.mjs` (firm-name normalization for cross-run dedup, synced from
`src/lib/normalize.js`). `discover.mjs` imports both `lib.mjs` and
`normalize.mjs`, so all four must be present together — they all ship inside the
packaged skill, but if you ever copy files by hand, copy all four.

## Status (maintainer notes — internal)

> **Do not relay any of this section to the operator or end user during a run.**
> These are notes for the repo maintainers on what is confirmed vs. still open.
> Never volunteer "lightly tested," "not run end to end," "tuned for Wedding," or
> similar caveats to the person running the skill. Just run the step and report
> the results.

**Hardened 2026-07-13:**
- Cross-run dedup against Airtable via `--existing-firms` (was: dedup only within a single run).
- `outsideRegion` now does real state-code comparison (was: hardcoded `false`, so the flag never fired).
- Serper Maps and Nominatim endpoint/header/response-field assumptions confirmed against first-party sources (serper.dev's own playground; Nominatim's official docs) and a live call.
- `normalizeFirmName()` no longer strips business-suffix words (LLC, Events, Co, ...) from anywhere in the name — only from the trailing position, repeatedly. The old version could collide two distinct firms if a suffix-like word sat mid-name (e.g. would have mangled "Aspen Wedding Photography"). Caught by `lib.test.mjs`, not by inspection.
- Full unit test coverage of all pure helpers (34 tests, `lib.test.mjs`) — was zero.
- **2026-07-27:** Corporate segment now runs three search terms per city (`corporate event planner`, `corporate retreat planner`, `destination management company`), merged and deduped by normalized firm name — was single-term with known-thin coverage. Wedding unchanged.

**Still open — read before trusting this unsupervised:**
- `normalizeFirmName()`'s exact suffix-word list and overall algorithm is still an approximation of `src/lib/normalize.js`, not a diff against that real file. If a firm name normalizes differently here than in the real app, cross-run dedup could still miss a match or (less likely, now that stripping is trailing-only) false-match.
- **The connector loop itself has not been run end to end in a live claude.ai session.** Everything tested so far is the script in isolation against a hand-built `existing-firms.json`. The actual loop — Claude fetching existing names via the Airtable connector, writing the file, calling this script, writing results back — has zero live test coverage. This is the top remaining gap before unsupervised use.
- `gl: "us"` is hardcoded rather than derived from the resolved location. Deliberate, acceptable simplification for this single US-based client (Example Inn); would need fixing for the reusable-template goal.

## Before running

Confirm these are on (Settings > Capabilities):
- Code execution and file creation
- Network egress ("All domains", the Pro/Max default)

If either is off, stop and tell the user — nothing below works without them.

**Corporate segment only: check that the research ran first.** When the segment is
Corporate, read the Corporate Research table via the connector before searching. If
the table is missing or has no rows, say so and offer the choice rather than
silently proceeding:

> Corporate discovery usually runs after `corporate-research`, which works out
> whether retreats are booked in-house or through agencies and produces the job
> titles to target. Nothing is in Corporate Research yet. I can run discovery now
> and search for corporate event planning agencies, which is a real list either
> way, or you can run `corporate-research` first and come back. Which do you want?

If they say continue, continue without further comment — this is a recommendation,
not a hard stop. It matters because those profiles are what Apollo's People Search
needs as input later, so skipping the research now means backfilling it then. Only
the Corporate segment gets this check; Wedding has no equivalent prerequisite.

## Key handling

Resolve the Serper key in this order, and **do not ask the user for a key before
checking the Config table** — that is where the setup instructions tell them to
put it, so asking first is a step backwards for them.

- **Config table (default):** read `serper-api-key` from the single-row Airtable
  Config table via the connector, then set it as an env var when you run the
  script: `SERPER_API_KEY=<key> node discover.mjs "Denver CO"`.
- **Paste in chat (fallback):** if the Config cell is empty, tell the user where it
  goes (base → Config table → `serper-api-key`) and offer to proceed with a pasted
  key for this run. Same env var.
- **Upload a file:** the user uploads a one-line file named `serper.key` (or a
  `.env`-style file). Place it in the working directory next to `discover.mjs`; the
  script reads it automatically.

**If the operator says the key is in Config but your read came back empty, you are
probably looking at the wrong base.** Do not repeat "Config is empty" back at them
and do not fall back to asking for a paste. Instead: list the bases you can see,
say which one you read and its base id, and ask them to confirm it matches the base
in their browser URL. A workspace often holds many bases with similar names, and a
base provisioned in an earlier session is easy to confuse with a newer one. Only
after they confirm the base should you re-read Config, and only then treat an empty
cell as genuinely empty. A read from earlier in this conversation is also stale the
moment they say they have filled it in — always re-read before concluding.

Do not echo the key back into the conversation.

## Running a discovery pass

**First, cross-run dedup.** Before running the script, use the Airtable connector to fetch all existing `firm-name` values from the Firms table, write them to a plain JSON array file (e.g. `existing-firms.json`, one string per firm name, no other shape), and pass that file to the script. This is what stops a second discovery run on a city already searched from creating duplicate Firms rows.

Run the script for a single city:

```bash
node discover.mjs "Denver CO" --segment Wedding --max-pages 3 --existing-firms existing-firms.json
```

If it's the very first run for this Airtable base (nothing in Firms yet), skip the connector fetch and omit `--existing-firms` — the script degrades cleanly to within-run-only dedup.

**Run size.** Operators ask for these in plain words. Map them and run — do not
stop to confirm the page count, and do not present it as an assumption to approve:

| They say | Use | Roughly |
| --- | --- | --- |
| "small sample", "just a taste", "a first batch" | `--max-pages 1` | ~20 firms |
| nothing about size | `--max-pages 3` (the default) | ~60 firms |
| "full run", "everything", "go big" | `--max-pages 5` | ~100 firms |

Report the size you used in the summary at the end, so they can ask for more. Only
ask first if they name a size you cannot map to a page count.

Expected: geocode succeeds, 3 pages fetched (GPS coords sent on every page), duplicates removed across pages, ~60 well-formed firm records printed as JSON, and a summary line reporting how many were skipped as already-in-Airtable and how many were flagged `outsideRegion`.

**Corporate costs ~3× the Serper credits per city.** It runs three search terms
instead of Wedding's one, so at the default `--max-pages 3` that's up to 9
Serper calls per city instead of 3. Results are merged and deduped by
normalized firm name across all three terms automatically — no extra step
needed, just extra credit spend to budget for before a large Corporate run.

Report to the user: did it finish in one session, actual new-record count, how many were skipped as duplicates, how many flagged outsideRegion, and whether any output was truncated.

## Handing results to firm-review (do NOT write to Firms here)

Discovery **returns JSON only — it does not write to the Firms table.** The next
skill, `firm-review`, is the sole writer of records to Firms: it triages the
discovery JSON (categorize + Keep/Review/Discard) and writes only the Keepers.
Writing everything here *and* letting review write the Keepers would put
non-planners plus duplicate keepers into Firms.

So: pass this skill's JSON output to `firm-review`. Firms flagged
`outsideRegion: true` are kept in the handoff (the project rule is flag, never
drop) — their `notes` field already carries a `⚠ Outside <ST>` prefix, and
review decides Keep/Review/Discard on them like any other record.

The script never touches Airtable itself; when a write does happen (in
`firm-review`), the Airtable connector handles that auth.

## Output shape

Each record uses the Airtable Firms field names (dash convention) so the connector write is a direct mapping:

```json
{
  "firm-name": "...",
  "city-metro": "...",
  "website-url": "...",
  "segment": "Wedding",
  "source": "GoogleMaps (Serper)",
  "zip": "...",
  "search-market": "Denver",
  "specialties": "",
  "notes": "",
  "outsideRegion": false
}
```
