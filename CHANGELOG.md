# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Changed
- Relicensed from CC BY 4.0 to the Apache License, Version 2.0, matching the
  license used on the Center for Rural AI's other public repos. `LICENSE` now
  holds the full Apache 2.0 text; a new `NOTICE` file carries the project name
  and copyright line. Updated `package.json`'s `license` field and the license
  mentions in `README.md`/`skills/README.md` to match.

### Added
- `firm-discovery`: Corporate segment discovery now runs three search terms per
  city (`corporate event planner`, `corporate retreat planner`, `destination
  management company`) instead of one, merged and deduped by normalized firm
  name. Wedding is unchanged. Corporate now spends ~3× the Serper credits per
  city — noted in `SKILL.md`.
- `corporate-research` gains `apollo-search.mjs`: a real discovery script for
  the corporate segment's in-house decision-makers (Head of People, Executive
  Assistant, Office Manager, etc.). Calls Apollo's People Search API (free,
  zero credits) with title/location/employee-range filters, with an optional
  `--reveal N` (Apollo's People Match, credit-consuming, opt-in, cost always
  reported) to get a real name/email for up to N candidates. Results write
  directly to `Firms`/`Contacts` — a deliberate, documented exception to
  `firm-review`'s usual sole-writer role, since an ordinary employer doesn't
  fit its planner/venue/vendor categorization. `Contacts.contact-source`
  schema gains an `"Apollo"` choice. Live-tested with a real Apollo key: search
  and reveal both confirmed working, though Apollo's Search/Match responses
  only ever return organization *booleans* (`has_city`, `has_phone`, etc.),
  never real values — so Apollo-sourced Firms rows will have blank
  `city-metro`/`website-url` (a real Apollo API limitation, documented in
  `SKILL.md`, not a bug).

### Removed
- `docs/new-user-airtable-setup-guide.md` — a pre-skills guide that walked operators
  through `npm install` / `.env.local` / `npm run setup:airtable` to build the base by
  hand. It also contradicted the current flow (`client-onboarding` provisions the base;
  operators should *not* pre-create one) and had gone stale: it named a `.env.local.example`
  that does not exist and documented 3 tables when the schema builds 8.
- `docs/airtable-schema.md` "Setup Steps" — manual base-building and `.env.local`
  instructions, including a reference to a real deployment's base id.

### Changed
- `docs/airtable-schema.md`: replaced the stale references to a web app that no longer
  exists (`PUT /api/template`, `/api/generate`, the audit-tool promote endpoint, send
  webhooks) with the skill that actually reads or writes each table. Documented that
  **Outreach** is provisioned but written by no skill, and that **Review** exists only in
  bases provisioned by the maintainer script.
- `README.md`: getting-started step 2 now says to connect the Airtable connector at
  workspace scope rather than pointing at the deleted guide; repo-layout and npm tooling
  moved under a "For maintainers" heading that states none of it is needed to run the
  pipeline.
- Labelled the local provisioning path as maintainer-only in `scripts/setup-airtable.mjs`,
  `.env.example`, and `config/client.js` (whose only consumer is that script — no skill
  reads it).

---

## [1.0.0] — 2026-07-26

Initial public release of the Rural Hospitality Outreach Pipeline as a reusable
open template by the Center for Rural AI.

### Added
- Six Claude Desktop skills for the outreach flow: `client-onboarding`,
  `voice-intake`, `firm-discovery`, `firm-review`, `contact-extraction`,
  `email-generation`, plus the optional `corporate-research` skill for the
  corporate-retreat segment.
- Packaged, installable `dist/*.skill` files for each skill.
- Airtable schema (`config/airtable-schema.mjs`) and a local provisioning script
  (`npm run setup:airtable`); onboarding can also provision the base via the
  Airtable connector.
- Anti-drift tooling: canonical logic in `src/`/`config/` is synced verbatim into
  the skills via `skills/sync-manifest.json`, guarded by `npm run sync:skills:check`
  and the test suite. Zero runtime dependencies.
- Setup and reference docs under `docs/`, including a visual walkthrough
  (`docs/pilot-walkthrough.html`) and intake worksheets.
- Example client data (fictional "Example Inn," Rivertown, Colorado) throughout,
  as a worked example that a real deployment replaces via onboarding.
