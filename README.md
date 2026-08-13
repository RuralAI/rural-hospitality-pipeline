# Rural Hospitality Outreach Pipeline

A reusable set of Claude Skills that help a small hospitality business run warm, honest B2B outreach: find relevant planning firms in a target market, triage them, extract contacts, and draft outreach email in the owner's own voice. Built and released by the **[Center for Rural AI](https://ruralai.org)** as an open template for rural hospitality businesses.

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

- **corporate-research** — a guided research process for the corporate-retreat segment (in-house vs. agency planners, who to target). Writes decision-maker profiles to an Airtable `Corporate Research` table. Only needed if you run the Corporate segment, and **run it before discovery**, not after — it builds the profiles the later steps aim at. Its optional [Apollo](https://apollo.io) search reaches in-house decision-makers that a Maps search cannot see, writing them straight to `Firms` and `Contacts` behind its own approval step.

### Who the email is written to

Corporate outreach has two kinds of reader, and they need different letters. An **agency** plans other people's events for a living. An **in-house** contact — a VP of People, an office manager — organizes maybe one offsite a year. Agency copy sent to an in-house reader opens by praising a business they do not have, which reads as a mistake.

So `Firms` and `Email Templates` each carry an **`audience`** (`Agency` | `In-house`), separate from segment. Maps-sourced firms are `Agency`; Apollo-sourced people are `In-house`; `email-generation` matches the two. A Corporate client approves **two** Corporate letters in `voice-intake`, one per audience. Blank reads as `Agency`, so Wedding-only deployments never encounter this.

---

## Getting started

**What you need:** a **clean, secured computer** (see below), a **Claude account with Projects** on **any** plan — Pro, Max, Team, or Enterprise — with **Settings → Capabilities → Allow network egress** set to **"All domains"**, the **Airtable** and **Gmail** connectors, and a **Serper** API key. Egress is on by default for Pro and Max and off by default for Team and Enterprise, where an org owner has to change it. Details: [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude).

1. Confirm the computer you'll run this on is clean and secured — **[`docs/pre-flight-checklist.md`](docs/pre-flight-checklist.md), section 1**. Do this first; the rest of the list assumes it.
2. Read **[docs/getting-started.md](docs/getting-started.md)** for the full run-through (accounts, connectors, and API keys you'll need).
3. Connect the **Airtable** connector with **workspace-level** access. Do not pre-create a base — `client-onboarding` creates it for you, so there is nothing to build by hand.
4. Download the skills — see below. You do not need git, and you do not need to clone anything.
5. Install them: in Claude, go to **Settings → Skills → Add Skill** and upload each `.skill` file.
6. Run `client-onboarding`, then `voice-intake`, then the four pipeline skills in order. (Corporate segment: run `corporate-research` after `voice-intake` and before `firm-discovery`.)

### Before you install: the computer matters

This pipeline stores real people's names and work email addresses on your machine, holds live Airtable and Gmail sessions plus your API keys, and drafts mail from your own inbox. The businesses you contact never agreed to trust your computer, so a compromised machine makes your outreach their breach.

Before setup: full OS updates, a **full** malware scan that comes back clean, unrecognized browser extensions and startup items removed, disk encryption on. **This applies to Macs as well as Windows** — the malware that matters here steals browser sessions, keychain entries, and API keys, and it is written for macOS too. The full gate, including what to do if a scan has ever found something, is **[`docs/pre-flight-checklist.md`](docs/pre-flight-checklist.md), section 1**. On CRAI-assisted deployments we confirm this before setup begins.

### Downloading the skills

The `.skill` files live in **[`install/`](install/)**. Two ways to get them:

**Get all seven at once.** Click the green **Code** button at the top of this page, choose **Download ZIP**, unzip it, and open the `install/` folder. Everything else in the download is source and documentation you can ignore.

**Get one at a time.** Open **[`install/`](install/)**, click the skill you want, then click the **Download** button. Useful when only one skill has changed and you just need to re-upload that one.

Either way you end up with files named `client-onboarding.skill`, `firm-review.skill`, and so on. Those are what you upload to Claude.

There is also a visual walkthrough, published at **https://ruralai.github.io/rural-hospitality-pipeline/** (source: [`docs/index.html`](docs/index.html)).

### Am I running the current version?

An installed skill never updates itself, so it is worth checking before you blame a bug on the pipeline.

1. **What you have** — open the skill in Claude (**Settings → Skills**) and read the `**Version:**` line under its title.
2. **What's current** — the top version heading in **[CHANGELOG.md](CHANGELOG.md)**.
3. **What to do** — every release says what it costs you, on an **Operator impact** line: whether you need to reinstall nothing, some named skills, or everything plus an Airtable migration. Re-upload the named `.skill` files from [`install/`](install/). Uploading a skill you already have replaces it in place, so there is nothing to delete first.

All seven skills share one version number. See **[docs/versioning.md](docs/versioning.md)** for what major, minor, and patch mean here.

### Reference docs

- **[docs/versioning.md](docs/versioning.md)** — version numbers, what they promise, and when to reinstall
- **[docs/airtable-schema.md](docs/airtable-schema.md)** — the tables and fields the pipeline uses
- **[docs/key-handling-standard.md](docs/key-handling-standard.md)** — where API keys may (and may not) live
- **[docs/pre-flight-checklist.md](docs/pre-flight-checklist.md)** — before your first live batch
- **[docs/onboarding/](docs/onboarding/)** — the intake and voice worksheets

---

## For maintainers

Nothing below is needed to *run* the pipeline — running it takes a Claude project, the two
connectors, and the `.skill` files from `install/`. This is the tooling for changing the skills
and rebuilding them.

```
install/      packaged .skill files — the ones you upload into Claude
skills/       skill source (each SKILL.md + its bundled scripts and tests)
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
npm run package:skills     # rebuild every install/*.skill
npm test                   # unit tests + both drift checks
```

Code reaches an installed skill in two hops, and `npm test` guards both:

```
src/ + config/  --sync-->  skills/<name>/  --package-->  install/<name>.skill
```

So after changing a skill, run `npm run package:skills` **before** `npm test` — the second check compares each `install/*.skill` against its `skills/` folder, and `install/` is the copy people download.

`npm test` runs on Node's built-in test runner — this repo has **no runtime dependencies**. See [docs/skills-bundled-copy-drift.md](docs/skills-bundled-copy-drift.md) for details.

### Cutting a release

`package.json` holds the one version number for the pilot; `npm run sync:skills` stamps it into every `SKILL.md`, so a bumped version that hasn't been re-synced and repackaged fails `npm test` like any other drift. Every release gets a dated `CHANGELOG.md` heading with an **Operator impact** line and a `vX.Y.Z` git tag. Full procedure and the definitions of major/minor/patch: **[docs/versioning.md](docs/versioning.md)**.

### Applying the schema to an existing base

`npm run setup:airtable` writes the schema in `config/airtable-schema.mjs` to a base over the
Airtable REST API, using an `.env.local` you create from [`.env.example`](.env.example). It is
a maintainer escape hatch for a full field-level reconcile — **operators never need it**, since
`client-onboarding` provisions the base through the connector. See
[docs/airtable-schema.md](docs/airtable-schema.md#provisioning).

---

## License

Released under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0) by the Center for Rural AI. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
