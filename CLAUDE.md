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

Each skill lives in `skills/<name>/SKILL.md`. Packaged installables are in `install/`.

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

Full procedure: `CONTRIBUTING.md`. Two rules from it matter in every session,
because getting them wrong is invisible until CI catches it:

- Edit `src/`/`config/`, never a synced file inside `skills/`. The copy in `skills/`
  is generated; a hand-edit there is silently overwritten or silently drifts.
- Repackage (`npm run package:skills`) in the same commit as any skill edit, or CI
  goes red on the next push.

## Versioning

Full standard: `docs/versioning.md`. The short version:

- **One version for the whole pilot**, held in `package.json`. `npm run sync:skills`
  stamps it under the H1 of every `SKILL.md`, so it travels the same two hops as
  the code and both drift checks guard it. Never hand-edit a stamp.
- **Levels are defined by operator cost, not code size.** MAJOR = an existing
  deployment needs work (any change to `config/airtable-schema.mjs` qualifies —
  bases provisioned by the older `client-onboarding` lack the new table, field, or
  select choice). MINOR = new capability, nothing breaks. PATCH = fix or wording.
  A release mixing levels takes the highest one.
- **Every release heading carries an `**Operator impact:**` line** naming which
  skills to reinstall, or `Reinstall: none`. That line is the whole point of the
  scheme: it is how someone knows whether to come back to the repo.
- **Release =** bump `package.json` → move `[Unreleased]` into a dated heading →
  `sync` → `package` → `npm test` → one commit → `git tag -a vX.Y.Z`.

Do not bump the version for ordinary work in progress. Accumulate entries under
`[Unreleased]` and cut one release when the batch of changes is done.
