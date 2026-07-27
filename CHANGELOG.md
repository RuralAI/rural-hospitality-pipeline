# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
