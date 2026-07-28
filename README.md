# Rural Hospitality Outreach Pipeline

A reusable set of [Claude Skills](https://support.claude.ai/hc/en-us/articles/27900216893325) that help a small hospitality business run warm, honest B2B outreach: find relevant planning firms in a target market, triage them, extract contacts, and draft outreach email in the owner's own voice. Built and released by the **[Center for Rural AI](https://ruralai.org)** as an open template for rural hospitality businesses.

The pipeline runs entirely inside **Claude Desktop** — there is no server to host and no web app to deploy. Each stage is a skill you install once and run in a conversation. Skills use code execution for deterministic work (searching, scraping, composing) and connectors for anything that touches an external account (Airtable, Gmail).

> The sample data throughout this repo describes a fictional **"Example Inn"** in **Rivertown, Colorado**. Replace it with your own business during onboarding.

---

## The pipeline

Run these four skills in order for a target city + segment:

1. **firm-discovery** — searches a city/segment (Serper Maps + geocoding) and returns firm records. Writes nothing.
2. **firm-review** — categorizes each firm (planner / venue / vendor / unclear), assesses quality (Keep / Review / Discard), and writes only the Keepers to the Airtable `Firms` table. It is the sole writer to `Firms`.
3. **contact-extraction** — scrapes each firm's site for a contact address (free pass), with an optional [Hunter](https://hunter.io) enrichment pass. Writes the Airtable `Contacts` table.
4. **email-generation** — renders your approved template (verified per-region travel line, firm lead-in, signature) and creates one Gmail draft per contact. You review and send each draft from your own inbox.

Two setup skills run first, once per business:

- **client-onboarding** — provisions the Airtable base and writes your Business Profile and approved Region Travel facts.
- **voice-intake** — captures how you write and drafts your per-segment outreach copy into the Airtable Email Templates table.

One optional skill:

- **corporate-research** — a guided research process for the corporate-retreat segment (in-house vs. agency planners, who to target). Writes decision-maker profiles to an Airtable `Corporate Research` table. Only needed if you run the Corporate segment.

---

## Getting started

1. Read **[docs/getting-started.md](docs/getting-started.md)** for the full run-through (accounts, connectors, and API keys you'll need).
2. Connect the **Airtable** connector with **workspace-level** access. Do not pre-create a base — `client-onboarding` creates it for you, so there is nothing to build by hand.
3. Install the skills: in Claude, go to **Settings → Skills → Add Skill** and upload the `.skill` files from **[`dist/`](dist/)**.
4. Run `client-onboarding`, then `voice-intake`, then the four pipeline skills in order.

There is also a visual walkthrough at **[docs/pilot-walkthrough.html](docs/pilot-walkthrough.html)**.

### Reference docs

- **[docs/airtable-schema.md](docs/airtable-schema.md)** — the tables and fields the pipeline uses
- **[docs/key-handling-standard.md](docs/key-handling-standard.md)** — where API keys may (and may not) live
- **[docs/pre-flight-checklist.md](docs/pre-flight-checklist.md)** — before your first live batch
- **[docs/onboarding/](docs/onboarding/)** — the intake and voice worksheets

---

## For maintainers

Nothing below is needed to *run* the pipeline — running it takes a Claude project, the two
connectors, and the `.skill` files from `dist/`. This is the tooling for changing the skills
and rebuilding them.

```
skills/       the skills (each SKILL.md + its bundled scripts and tests)
dist/         packaged .skill files — install these into Claude
config/       example client data + the shared Airtable schema
src/          canonical source for the logic the skills bundle (see below)
scripts/      sync, packaging, and the maintainer-only Airtable provisioning script
docs/         setup guides, schema reference, and the walkthrough
```

### Editing skills — source of truth and anti-drift

Some skill scripts are generated **verbatim** from canonical sources in `src/` and `config/`, mapped by [`skills/sync-manifest.json`](skills/sync-manifest.json). Fix logic in the source, never by hand-editing a bundled skill copy:

```bash
npm run sync:skills        # regenerate bundled copies from src/ + config/
npm run sync:skills:check  # fail if any bundled copy has drifted
npm run package:skills     # rebuild every dist/*.skill
npm test                   # unit tests + the drift check
```

`npm test` runs on Node's built-in test runner — this repo has **no runtime dependencies**. See [docs/skills-bundled-copy-drift.md](docs/skills-bundled-copy-drift.md) for details.

### Applying the schema to an existing base

`npm run setup:airtable` writes the schema in `config/airtable-schema.mjs` to a base over the
Airtable REST API, using an `.env.local` you create from [`.env.example`](.env.example). It is
a maintainer escape hatch for a full field-level reconcile — **operators never need it**, since
`client-onboarding` provisions the base through the connector. See
[docs/airtable-schema.md](docs/airtable-schema.md#provisioning).

---

## License

Released under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0) by the Center for Rural AI. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
