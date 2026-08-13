# Pre-Flight Checklist — Before You Run the Pipeline

> **Who this is for:** operators getting ready to run the pipeline. No coding
> required. Changing the pipeline itself? See [`../CLAUDE.md`](../CLAUDE.md).

Everything you need in hand before running the pipeline in Claude Desktop. Work top to bottom; if every box is checked, you're ready for Step 4 of `docs/getting-started.md` (running the skills). This is a readiness checklist, not the full walkthrough — `getting-started.md` is the step-by-step.

---

## 1. A clean, secured computer

Clear this section first. It is the one item on this list that protects someone other than you.

This pipeline puts three sensitive things on the machine you run it from:

- **Other people's personal data** — names and work email addresses for real staff at real businesses, gathered and stored on your behalf.
- **Live credentials** — an Airtable session, a Gmail session, and your Serper, Hunter, and Apollo API keys.
- **Your own mail identity** — `email-generation` drafts from your inbox, so whatever reaches your machine reaches your outbound reputation.

The businesses in your Contacts table never agreed to trust your computer. A compromised machine turns a marketing project into a breach that lands on them, on your business, and on the Center for Rural AI. Checking these boxes is what keeps outreach from becoming that.

**On every machine, Windows and Mac alike:**

- [ ] The **operating system is fully updated**, including any pending restart.
- [ ] A **full** (not quick) **malware scan has been run and came back clean.**
- [ ] **Browser extensions and startup/login items reviewed**, and anything unrecognized removed. This is where credential-stealing malware usually persists.
- [ ] **Screen lock and full-disk encryption are on** — BitLocker on Windows, FileVault on macOS.

**On Windows**, confirm **Windows Security → Virus & threat protection** has real-time protection **on** with current definitions, and run the full scan from there or from another reputable scanner.

**On macOS**, do not skip this section because it's a Mac. Keeping macOS current is what keeps Apple's built-in XProtect current, so the update box is doing real work. Run the full scan with a reputable on-demand scanner. The malware that matters here steals browser sessions, keychain entries, and API keys, and it is written for macOS too — the exposure is the same, only the tooling differs.

> **If a scan has ever found something on this machine, assume every credential the pipeline touches was taken.** From a **different computer you know is clean**: change your Google and Airtable passwords, **sign out all active sessions**, and rotate your Serper, Hunter, and Apollo keys. Signing sessions out is the part that actually cuts access — a stolen session token keeps working after a password change on its own.

**For CRAI-assisted deployments:** we confirm this before setup begins, not after. Expect to show the scan result.

## 2. Account and project

- [ ] A **Claude account with Projects.** Pro, Max, Team, and Enterprise all work.
- [ ] **"Allow network egress" set to "All domains."** This is the real requirement — `firm-discovery` and `contact-extraction` run code that reaches arbitrary firm websites, and the Serper, Hunter, and Apollo calls go to third-party domains, so the "package managers only" setting is not enough.
  - **Pro and Max:** network access is on by default, and the setting is yours to change — **Settings → Capabilities**.
  - **Team and Enterprise:** network access is **off** by default. An **organization owner** has to open **Organization settings → Capabilities** and allow all domains; a member cannot do it themselves.
  - Reference: [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude).
- [ ] A **new, empty Claude project** to hold the skills and connectors.

## 3. Connectors (enabled in the project)

- [ ] **Airtable connector** connected with **workspace-level** access, not single-base. *(The base does not exist yet when you grant access — `client-onboarding` creates it — so single-base scoping fails.)*
- [ ] **Gmail connector** connected. Required by the final step (`email-generation`, which creates drafts).
  - Not on Gmail? You can still run discovery through composing. Have the skill output the emails as text instead of calling Gmail, and paste them into your own mail client. See the email note in `getting-started.md`.

## 4. Accounts and API keys

- [ ] An **Airtable account you control.** *(You do not build any tables by hand — `client-onboarding` provisions them. You just need the account and the workspace access from section 3.)*
- [ ] A **Serper API key** (required, for discovery) from serper.dev.
- [ ] *(Optional)* A **Hunter API key** (for the contact-enrichment pass) from hunter.io. The free tier is 25 searches/month; a paid plan is needed for real volume.
- [ ] *(Required for the Corporate segment)* An **Apollo API key** (for `corporate-research`'s Apollo-backed Track A candidate search) from apollo.io. The free tier is 75 credits/month — similar low volume to Hunter's; a paid plan is needed for real enrichment spend.

> **Where keys go (two equally-supported ways):** (a) the Airtable **Config** table — one row, `label` = `Keys`, paste into `serper-api-key` / `hunter-api-key` / `apollo-api-key` (after Step 4 builds the tables), which the skills pull via the connector; or (b) **paste the key in chat / upload a `serper.key` (and `hunter.key`, `apollo.key`) file** into the working directory when a skill asks. Config is tidiest when the connector cooperates, but its read has been flaky in testing — the paste/upload path doesn't touch the connector, so keep it as an equal option, not a fallback.
>
> **Key safety:** only low-stakes service keys (Serper, Hunter, free-plan Apollo) may live in Airtable. No passwords, OAuth tokens, or mail credentials. Rotate any key that was ever shared, exported, or screenshotted.

## 5. The skills to upload

Upload these `.skill` files from `install/` into the project. They run in this order:

- [ ] `client-onboarding.skill`
- [ ] `voice-intake.skill`
- [ ] `firm-discovery.skill`
- [ ] `firm-review.skill`
- [ ] `contact-extraction.skill`
- [ ] `email-generation.skill`

**Running the Corporate segment?** Add a seventh:

- [ ] `corporate-research.skill` — needs the Apollo key from section 4. Run it **before** discovery, not after: it builds the decision-maker profiles the later steps aim at, and its Apollo search is the only way to reach in-house people a Maps search cannot see. Skip it for a Wedding-only run.

## 6. Intake information to have ready

You will feed these to the skills during the run. Fill the worksheets in advance so the sessions go quickly.

- [ ] **Business facts** — answers to `docs/onboarding/worksheet-template.md`. Section 1 is the minimum (gets you a contacts list); add Sections 2–3 for grounded, on-goal emails. `client-onboarding` writes these to the Airtable **Business Profile** table.
- [ ] **Voice** — answers to `docs/onboarding/voice-worksheet.md`, if you want emails in a specific person's voice. `voice-intake` uses these to draft the **Email Templates**. Skip if you only want a contacts list.
- [ ] *(Corporate segment)* Be ready to approve **two Corporate letters, not one.** Both are `segment: Corporate` and differ by **audience**: the `Agency` letter is written to an event-planning business that books groups for a living, the `In-house` letter to someone at an ordinary employer who organizes one offsite a year. Agency copy sent to an in-house reader praises a business they do not have. `email-generation` stops rather than substituting, so an unapproved in-house letter blocks drafts to every Apollo-sourced contact.

## 7. One manual Airtable step

- [ ] After onboarding creates the tables, open the **Firms** table and add a field of type **Created time**, named exactly `discovered-date`. *(The connector cannot set this field type on create, so it is added by hand once.)*

**Reusing a base built by an earlier version?** A fresh base gets all of this automatically — this is only for bases that already exist. Check `CHANGELOG.md` for the current release's **Operator impact** line, which names exactly what to reconcile. As of the pending release that means an `audience` single select (`Agency` | `In-house`) on both **Firms** and **Email Templates**, and an `Apollo` choice on **Contacts.contact-source**.

---

## Know before you start (current limitations)

- **Travel copy is gated until verified.** Region travel sentences render only after a human approves them during onboarding; unapproved regions fall back to a safe generic line.
- **Gmail only** for drafting (see the workaround in section 3).
- **`email-generation` never sends.** It creates Gmail drafts; a human reviews and sends each one from their own inbox.
- **The Desktop app can be flaky** — connector reconnect loops and occasional tool-loading hiccups. Retry the step if a connector call fails.

## Ready?

If every box above is checked, open `docs/getting-started.md` at **Step 4 — Run the skills in order** and go.
