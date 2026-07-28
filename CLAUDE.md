# CLAUDE.md — Rural Hospitality Outreach Pipeline
**Center for Rural AI**

Project context for anyone (human or Claude) working in this repository. For how
to *use* the pipeline, see `README.md` and `docs/getting-started.md`.

---

## What this is

A reusable set of Claude Skills for small hospitality businesses to run honest
B2B outreach. Everything runs in **Claude Desktop** — there is no web app or
hosted service. Skills use code execution for deterministic work and connectors
(Airtable, Gmail) for anything touching an external account.

The sample data throughout describes a fictional **Example Inn** in **Rivertown,
Colorado**. It exists to show the shape of the data and to back the tests; a real
deployment replaces it via the `client-onboarding` and `voice-intake` skills,
which write to Airtable.

## The skills

Setup (run once per business):
- `client-onboarding` — provisions the Airtable base; writes Business Profile and approved Region Travel rows.
- `voice-intake` — captures the owner's voice; writes per-segment copy to the Email Templates table.

Pipeline (run in order per city/segment):
- `firm-discovery` — Serper Maps search + geocode. Returns firm records; writes nothing.
- `firm-review` — categorizes and triages firms; sole writer to the `Firms` table (Keepers only) for Serper/Google-Maps-sourced records. Exception: `corporate-research`'s optional Apollo step writes Apollo-sourced Corporate records directly (an ordinary employer doesn't fit the planner/venue/vendor categorization), gated by its own human-approval step instead.
- `contact-extraction` — scrapes contact addresses (free), with an optional Hunter enrichment pass. Writes `Contacts`.
- `email-generation` — renders the approved template and creates one Gmail draft per contact.

Optional:
- `corporate-research` — guided research for the corporate-retreat segment; writes decision-maker profiles to the `Corporate Research` table (provisioned only when the client runs the Corporate segment). Also bundles `apollo-search.mjs`, an optional real discovery step (needs an Apollo key) that searches Apollo's People Search API for in-house decision-makers and writes them directly to `Firms`/`Contacts`.

Each skill lives in `skills/<name>/SKILL.md`. Packaged installables are in `dist/`.

## Source of truth and anti-drift

`src/` and `config/` are canonical. Some skill scripts are generated **verbatim**
from them per `skills/sync-manifest.json`, so a fix belongs in the source, never
hand-edited into a bundled skill file.

Code travels **two hops**, and `npm test` guards both — a change has not shipped
until it has made it through both:

```
src/ + config/  --sync-->  skills/<name>/  --package-->  dist/<name>.skill
```

- Hop 1 (`skills/sync.test.mjs`): bundled copies must match their canonical source.
- Hop 2 (`skills/dist-drift.test.mjs`): each `dist/*.skill` must match its
  `skills/<name>/` folder, file list and bytes. `dist/` is what people install, so
  editing a skill without repackaging ships stale logic to every new installation.

```bash
npm run sync:skills        # regenerate bundled copies (hop 1)
npm run sync:skills:check  # fail on drift (hop 1)
npm run package:skills     # rebuild dist/*.skill (hop 2)
npm test                   # unit tests + both drift checks (Node built-in runner; no deps)
```

`config/airtable-schema.mjs` is the single source for the Airtable table/field
schema, consumed both by `scripts/setup-airtable.mjs` (local provisioning) and,
via sync, by `client-onboarding`'s connector-based provisioning.

## House style

- No em dashes in any client-facing value or generated copy. (They read as
  machine-written; en-dash ranges like 16–21 are fine.)
- Scraping is honest: skills identify themselves with a truthful User-Agent built
  from the client's own business name and URL. Never spoof a browser or evade
  bot controls.
- Travel claims (flights, drive times) are gated: a transit claim is only asserted
  to a recipient when a human has verified it. Unverified regions fall back to a
  safe, claim-free sentence.

## Adding or changing a skill

1. Edit the `SKILL.md` (and, for bundled logic, the canonical source in `src/`/`config/`).
2. `npm run sync:skills` if you touched a synced source.
3. `npm run package:skills` to rebuild the `dist/` installable.
4. `npm test` — must pass, including both drift checks.
5. Update `README.md`, `skills/README.md`, and `CHANGELOG.md` as needed.

Package **before** you test. The hop-2 drift check compares `dist/` against
`skills/`, so testing first reports a stale-archive failure that repackaging is
what actually fixes. Commit the rebuilt `.skill` alongside the source change —
they are one logical change.
