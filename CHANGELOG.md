# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

**If you have already installed the skills, read the `Operator impact` line under
each release heading.** It tells you which `.skill` files to re-upload from
[`install/`](install/), and whether an existing Airtable base needs migrating. Check the
`**Version:**` line under a skill's title in Claude to see which build you have.
Version numbers cover all seven skills at once and are defined in
[docs/versioning.md](docs/versioning.md).

---

## [Unreleased]

Nothing yet.

---

## [2.0.0] — 2026-08-12

**Operator impact:** Reinstall all skills, and reconcile the schema on any base
created by 1.0.0. Three fields are new or changed: an `"Apollo"` choice on
`Contacts.contact-source`, and an `audience` single select on both `Firms` and
`Email Templates`. Corporate clients also need a second Email Templates row (the
in-house variant) drafted by `voice-intake` before Apollo-sourced contacts can
generate drafts at all. Wedding-only deployments are unaffected beyond the
reinstall: a blank `audience` reads as `Agency`, which is what every existing row
already is.

Two things here need no reinstall at all. **Pro and Max accounts can run this
pipeline** — earlier docs said a Team plan was required, which was wrong; set
**Settings → Capabilities → Allow network egress** to **"All domains"** and you
are set. And **read the new machine-security gate**
([`pre-flight-checklist.md`](docs/pre-flight-checklist.md), section 1) even if you
are already running the pipeline: it covers the computer you have already put
other people's contact data on.

### Added
- **[`docs/README.md`](docs/README.md), an index that says who each document is
  for.** The folder held nine files in one flat list with nothing distinguishing
  the four an operator needs from the five that are internal engineering
  standards. A business owner opening `docs/` met "Bundled-Copy Drift in the
  Skills Pipeline" and "Versioning and releases" with no way to tell those were
  not steps they had missed. The index sorts them into operator and maintainer
  tables, and GitHub renders it automatically when someone clicks into the folder.

  Every document also opens with a one-line **Who this is for** banner, and the
  maintainer ones say plainly that operators can skip them, with a pointer to the
  operator-facing equivalent where one exists — `versioning.md` sends them to the
  **Operator impact** line, `key-handling-standard.md` to the practical key notes
  in the checklist, `skills/README.md` to `install/`.

  Deliberately **no file moves.** Splitting into `docs/operator/` and
  `docs/internal/` would look tidier and break two things: `docs/index.html` is
  the path that publishes the GitHub Pages site, and
  `docs/onboarding/worksheet-template.md` is synced into `client-onboarding.skill`
  per `sync-manifest.json`. The index buys the same clarity for neither cost.
  `worksheet-template.md` is also the one document with no banner, since it is
  bundled into a skill and a repo-navigation note has no business inside it.
- **A machine-security precondition, ahead of every other setup step.** The
  pipeline stores real people's names and work email addresses on the operator's
  computer, holds live Airtable and Gmail sessions plus three API keys, and drafts
  mail from the operator's own inbox. Nothing in the docs had ever asked whether
  that computer was safe to put it on. Prompted by a real deployment: an operator's
  machine was found to have malware, and setup is now held until the machine is
  verified clean.

  The exposure is not the operator's alone, which is why this is a gate and not
  advice. The businesses in a Contacts table never agreed to trust anyone's
  laptop, so a compromised machine turns an outreach project into a third-party
  breach — theirs, the rural business's, and CRAI's. `pre-flight-checklist.md`
  section 1 now carries the full gate (OS updates, a **full** scan that comes back
  clean, browser-extension and startup-item review, disk encryption), the
  Windows-specific Defender check, and a rotate-from-a-known-clean-machine
  procedure for anyone whose scan has ever found something — including signing all
  sessions out, since a stolen session token survives a password change.
  `getting-started.md` leads its prerequisites with the condensed version,
  `README.md` carries it before the install steps, and the walkthrough opens on a
  new **Start here** section covering it in plain language.

  Written for **both platforms deliberately.** The obvious framing was a Windows
  warning, but the malware that matters here steals browser sessions, keychain
  entries, and API keys, and it targets macOS too. A Mac-users-can-skip-this note
  would have been wrong in the direction that costs someone their data.
- **An `audience` dimension, so in-house corporate contacts get their own copy.**
  Found on a live Apollo run: the corporate template opens by referring to the
  reader's work planning retreats, which is true of an event agency and wrong for
  the VP of People it was addressed to. She organises one offsite a year; she does
  not plan events for a living. The mail composed cleanly and read as a mistake.

  `Firms.audience` and `Email Templates.audience` (`Agency` | `In-house`) now
  separate *who the mail is written to* from *what segment it is about*.
  `firm-review` writes `Agency` on everything from a Maps search;
  `corporate-research` writes `In-house` on Apollo results; `email-generation`
  matches the two and picks the variant. `voice-intake` drafts both Corporate
  templates and stores them as separate rows.

  Deliberately **not** a new segment: travel claims vary by region and segment, not
  by reader, and `resolveTravelSentence` refuses to lend one segment's approved
  sentence to another. A `Corporate In-house` segment would have forced operators
  to re-approve identical travel copy for every region. Blank `audience` reads as
  `Agency`, so every pre-existing row and template keeps working untouched, and
  `email-generation` throws rather than falling back when an in-house contact has
  no in-house template: sending agency copy is the failure being fixed.
- **Version stamping and a release standard** ([docs/versioning.md](docs/versioning.md)).
  Installed skills were previously anonymous: nothing in an uploaded `.skill` said
  which build it came from, so an operator could not tell whether a bug they hit
  was already fixed. `npm run sync:skills` now writes the `package.json` version
  under the H1 of every `SKILL.md`, which puts it inside every `.skill` archive and
  under both existing drift checks — a bumped version that has not been re-synced
  and repackaged now fails `npm test`. Releases carry a dated heading, an
  `Operator impact` line, and a `vX.Y.Z` git tag.
- `skills/install-drift.test.mjs` — a drift check for the second hop, `skills/` →
  `install/`. For every skill it compares the packaged `.skill` archive's file list
  and each file's bytes against `skills/<name>/`, and fails telling you to run
  `npm run package:skills`. It also catches a skill with no archive and an archive
  with no skill folder. Reads archives with `unzip`, which `package-skill.sh`
  already requires, so no new dependency.

  Only hop 1 (`src`/`config` → `skills/`) had been guarded, which is how a stale
  installable shipped while the suite stayed green (see Fixed). Because the check
  compares `install/` against `skills/`, **package before you test** — the
  maintainer checklist in `CLAUDE.md` has been reordered accordingly.

### Fixed
- **The docs turned away operators who could have run the pipeline.**
  `pre-flight-checklist.md` and `getting-started.md` both required a **Team plan**
  and said outright that Pro "will not work," which is wrong: code execution and
  file creation are available on every Claude plan. The real requirement was never
  the plan, it is the **"Allow network egress"** capability, which has to be set to
  **"All domains"** because discovery and contact-extraction reach arbitrary firm
  websites and the Serper, Hunter, and Apollo calls go to third-party domains.

  The claim was also backwards about which plan is easy. **Pro and Max have network
  access on by default** and the operator can set it themselves under **Settings →
  Capabilities**. **Team and Enterprise have it off by default** (package managers
  only) and need an **organization owner** to change it — so the plan the docs
  demanded is the one with the extra blocker. Both docs now state the capability,
  the per-plan default, where the setting lives, and link Anthropic's
  [support article](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude),
  and `README.md` and the walkthrough carry it too — the walkthrough had never
  stated a plan requirement at all, and now opens on one.
  `skills/firm-discovery/SKILL.md` already described egress correctly, so no skill
  changed.
- **Apollo-sourced contacts silently lost their travel sentence.** Apollo's People
  Search does not return an organization's city, so `city-metro` is blank on those
  Firms rows. `compose.mjs` resolves a region from `search-market` first and
  `city-metro` second, and neither was set, so every Apollo-sourced contact fell
  through to the claim-free fallback line and lost the verified flight or drive
  claim — the most persuasive sentence in the email. The safety behaviour was
  correct; the missing input was not. `corporate-research` now writes
  `search-market` from the city passed as `--location`, which it knows because it
  is the search input. Caught on a live Denver run.
- **Discovery dropped `city-metro` on any listing without a full street-and-zip
  address.** `extractCity` and `extractState` in `src/lib/normalize.js` matched on
  the literal shape `", CITY, ST 12345"`, so three common Google Maps listing
  formats returned `""`: no zip (`"123 Main St, Denver, CO"`), no street line
  (`"Aurora, CO 80011"` — zip parsed, city did not), and a spelled-out state
  (`"…, Denver, Colorado 80202"`). Those records then landed in `firm-review` as
  Reviews for a missing required field, costing 3 of 20 firms on a Denver sample.
  Rural markets tested earlier happened to return complete addresses, which is why
  this only surfaced now.

  Both functions now split the address on commas and anchor on the segment that is
  *only* a state (optionally with a zip), searching from the end so `"Kansas City,
  MO"` cannot mistake the city for the state. A street line containing a state-like
  word is never matched, since the whole segment has to be the state.

  `extractZip` was wrong in a related way and is fixed alongside: it took the first
  5-digit run anywhere in the string, so `"12345 Main St, Denver, CO 80202"`
  returned the street number. It now prefers the zip attached to the state segment.
- `client-onboarding` referenced a worksheet it could not open. `SKILL.md` pointed
  at `docs/onboarding/worksheet-template.md`, a repo path that was never bundled
  into the `.skill`, so in Claude the file did not exist. Claude spent its opening
  message explaining the missing file instead of starting the interview. The
  worksheet is now synced into the skill folder (and so into the archive) via
  `sync-manifest.json`, and `SKILL.md` tells it to read the bundled copy, interview
  live by default, and only pull from a pasted worksheet if the operator supplies
  one.
- `install/client-onboarding.skill` was stale: the Apollo work added an `"Apollo"`
  choice to `Contacts.contact-source` in `config/airtable-schema.mjs` and synced it
  into `skills/client-onboarding/table-schema.mjs`, but the installable was never
  repackaged. Anyone installing the shipped `.skill` provisioned a base without
  that choice, so `apollo-search.mjs` writes to the field would have failed.
  Repackaged. Note the drift check cannot catch this class of bug: it compares
  `src`/`config` against `skills/`, never `skills/` against `install/`.

### Changed
- **The walkthrough's footer no longer addresses a fictional inn.** It read
  "Prepared for Example Inn, Rivertown — swap in your own business name and cities
  as you go," a leftover from when the page was a per-client artifact. On a public
  site it reads as a page someone forgot to finish. Now just the CRAI attribution.
- **The `audience` split now appears in the docs an operator actually reads.** It
  had landed in the schema reference and nowhere else, so the one thing it asks of
  a Corporate client — approve **two** letters in `voice-intake`, not one — was
  documented only where nobody looks for instructions. Since `email-generation`
  hard-stops rather than substituting agency copy, an operator could reach the last
  step of a campaign before discovering the requirement. `README.md`,
  `getting-started.md` (4.2 and 4.7), `pre-flight-checklist.md` (section 6), and
  the walkthrough (Card B and Step 4) now each explain the two readers and why the
  same letter cannot serve both.
- **`corporate-research` is now a numbered step in `getting-started.md`.** Step 4
  ran 4.1 through 4.6 and never mentioned it, so an operator following the guide
  for a Corporate client silently skipped the step that everything else in that
  segment depends on. It is now **4.3**, between `voice-intake` and
  `firm-discovery`, marked Corporate-only, and carries what the live run taught:
  the Apollo step's flagged out-of-band candidates, its reported title
  distribution and the gaps in it, and that an unpublished `capacity` is fine
  because the headcount band is only a search filter. `README.md` and
  `pre-flight-checklist.md` state the ordering as well. The walkthrough already
  had this right as setup Card C.
- **`getting-started.md` steps 4.5 through 4.7 describe what the skills now
  actually do.** They still described the pre-live-run behaviour: `firm-review`
  returning prose rather than a numbered decision table whose rows are lost with
  the session, `contact-extraction` holding every result to the end rather than
  writing Contacts after pass 1, and no mention that Apollo-sourced contacts skip
  the step entirely.
- **Apollo's `--employee-range` format is confirmed against a live call.**
  `apollo-search.mjs` carried an honesty flag saying the string format
  `organization_num_employees_ranges[]` expects had never been verified, so the
  skill warned operators the first call might fail. A live run on 2026-08-12 with
  `"20,200"` was accepted and returned 25 candidates, so the flag is resolved and
  the warning removed.
- **The Apollo step now pre-screens candidates and reports title coverage.** Two
  things surfaced on that same live run. Apollo's size filter appears to match a
  local office rather than the whole organization, so results included a city
  agency and orgs well above the band; those are now flagged in the table with a
  suggested skip rather than left for the operator to catch, and never dropped
  silently. And a six-title query returned only People/HR leadership and Chief of
  Staff, with Executive Assistant, Office Manager, and Operations Lead all empty.
  Cause is unresolved (Apollo's title matching, its admin-role coverage, or real
  scarcity at that company size), so the skill now reports the title distribution
  alongside the count and says outright that a profile whose titles never return
  needs a sourcing path other than Apollo.
- **A missing `capacity` no longer blocks the Apollo search.** `corporate-research`
  derived Apollo's `--employee-range` from the property's guest capacity, so a
  client whose capacity is unpublished hit a hard stop, with the only way forward
  being a chain of guesses off the room count. The skill now separates the two
  ideas: `capacity` is a fact about the property and must never be invented, while
  the headcount band is a search filter the operator can tune. When capacity gives
  nothing usable, the band defaults to 20-200 and is reported as a starting filter.
  Company headcount was always a loose proxy anyway, since a large company sends a
  small team to an offsite and that team is the target. The Apollo step also now
  states up front that it covers the in-house profile only, rather than raising it
  as a problem mid-run.
- **The walkthrough now covers the Corporate segment.** Its four numbered steps
  were written wedding-first, and `corporate-research` sat outside them ("not one
  of the 4 numbered steps below"), so a corporate operator reaching step 3 found
  instructions that did not match what they were doing. Corporate now appears as a
  setup card C (run the research before step 1) plus a neutral aside on steps 1, 2,
  and 3: the segment word and the roughly 3× Serper spend on discovery, Apollo as a
  second source of people that Maps cannot reach, and confirmation that contact
  extraction runs unchanged for corporate agencies while skipping Apollo-sourced
  records that already have an email.
- **`firm-discovery` warns when the Corporate segment runs before its research.**
  The docs have always said `corporate-research` must precede corporate sourcing,
  but nothing enforced or even mentioned it at the point of use. Corporate runs now
  read the Corporate Research table first and, when it is empty, offer the choice
  between continuing and running the research first. It stays a recommendation, not
  a hard stop, since the agencies discovery finds are real either way. The reason it
  matters is that those profiles are the input Apollo's People Search needs later.
- **`contact-extraction` now writes Contacts after pass 1 instead of holding
  everything to the end.** The write step ran last, after the optional Hunter pass,
  so a full scrape plus a full enrichment could sit unsaved in
  `stage-02-results.json` while Claude asked permission to write. That file is
  crash-safe within a session but does not survive one ending: a closed tab or a
  session limit lost the entire batch, including any Hunter credits already spent.
  Pass 1 results are now written as soon as the scrape finishes, and a new step 6
  reconciles pass 2 into those rows, updating in place where Hunter won and
  creating rows only for firms recovered from `needs_manual`. The old numbering
  (3.5 for Hunter, 4 for the write) is now 4 write, 5 Hunter, 6 update.
- **`contact-extraction` pass 1 now reports a result instead of opening a debate.**
  The skill had no reporting spec at all, so Claude produced a 14-row table of
  every firm and its address, commentary on the hit rate, an explanation of blank
  name fields, Hunter's pricing tiers, and then two open questions. Pass 1 now
  leads with the headline ("10 of your 14 firms now have a contact email, saved to
  Contacts"), names only the firms that came up empty, and closes by offering the
  Hunter pass. The per-firm dump, rate commentary, and field-level explanations are
  explicitly excluded, since they are already visible in Airtable.

  The second question is gone too: writing the `found` results no longer asks
  permission, and `needs_manual` firms are skipped by default rather than being
  offered as a choice between blank-email placeholder rows and skipping. A
  blank-email Contact is one `email-generation` cannot send to, and the firm stays
  in Firms regardless, so nothing is lost.
- **`firm-review` now hands back a decision table instead of an essay.** The output
  spec asked for a summary table but said nothing about how the operator should
  resolve the Review verdicts, so they came back as paragraphs: to act on them you
  had to re-read the prose, pull out the names, and Google each one yourself. The
  Reviews now come last, as a numbered table with a **link on every row** (the
  firm's website, or a Google Maps search URL built from name and city when
  discovery found no site), a short phrase for why it's held, and a one-word
  recommendation, followed by a single prompt asking for decisions by row number.
  Keepers collapse to one line, since they are already in Airtable. Claude is also
  told to fill in a missing `city-metro` or zip itself when the firm's own site or
  Maps listing answers it, rather than holding a row over a lookup, and never to
  end a turn leaving Reviews unresolved without saying they will be lost with the
  session.
- **`firm-discovery` now maps plain-language run sizes instead of negotiating
  them.** "Small sample" appeared in the walkthrough's suggested prompt but was
  defined nowhere in the skill, so Claude guessed a page count and then asked the
  operator to approve the guess. The skill now maps "small sample" to
  `--max-pages 1`, silence to the default 3, and "full run" to 5, and is told to
  run rather than confirm.
- **`firm-discovery` no longer declares the Config table empty without checking
  which base it read.** A workspace can hold many similar bases, so an empty read
  is more often the wrong base than a missing key. When the operator says the key
  is there, the skill now names the base and id it read, asks them to confirm it
  against their browser URL, and re-reads before concluding. It also treats any
  earlier read in the conversation as stale once the operator says they have filled
  it in.
- **The Airtable Config table is now the default source for every API key.** The
  schema has always had `serper-api-key`, `hunter-api-key`, and `apollo-api-key`
  fields, but only `firm-discovery` mentioned the table, and it listed
  paste-in-chat first — so Claude asked for a key that was sitting in Airtable the
  whole time. All three skills now read their key from Config first and fall back
  to a pasted key or a `.key` file only when that cell is empty, telling the
  operator where the key belongs when they do. The walkthrough now says to fill the
  Config table once, before the first run, rather than pasting a key into the chat.
- **Renamed `dist/` to `install/`.** `dist/` is a developer convention and meant
  nothing to the operators this repo is for, who were left guessing between it and
  the `skills/` source folder (the obvious-looking but wrong choice). `README.md`
  now also spells out how to get the files without cloning: **Code → Download ZIP**
  for all seven, or the per-file **Download** button for a single skill. Renamed
  `skills/dist-drift.test.mjs` to `skills/install-drift.test.mjs` to match.
- Renamed `docs/pilot-walkthrough.html` to `docs/index.html`. GitHub Pages already
  publishes this repo from `main` + `/docs`, so the walkthrough is now the site
  landing page at https://ruralai.github.io/rural-hospitality-pipeline/ instead of
  leaving the site root on a 404. `README.md` points at the published URL.
- Test fixtures now use fictional businesses throughout. Some fixture contact data
  had been carried over from a live acceptance run, which meant real firms' contact
  addresses (and one real person's name) sat in the test suite and inside one
  packaged `.skill`. Replaced with fictional firms on RFC 2606 `.example` domains.
  Behaviour is unchanged; two internal test titles and one comment that referred to
  a discovered firm by name were renamed to describe the rule instead.
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
- Packaged, installable `install/*.skill` files for each skill.
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
