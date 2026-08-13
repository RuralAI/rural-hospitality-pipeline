# Pre-Flight Checklist — Before You Run the Pipeline

Everything you need in hand before running the pipeline in Claude Desktop. Work top to bottom; if every box is checked, you're ready for Step 4 of `docs/getting-started.md` (running the skills). This is a readiness checklist, not the full walkthrough — `getting-started.md` is the step-by-step.

---

## 1. Account and project

- [ ] A **Claude account on a Team plan** with Projects. *(Pro will not work — the pipeline needs code execution with network egress, which discovery and contact-extraction require.)*
- [ ] A **new, empty Claude project** to hold the skills and connectors.

## 2. Connectors (enabled in the project)

- [ ] **Airtable connector** connected with **workspace-level** access, not single-base. *(The base does not exist yet when you grant access — `client-onboarding` creates it — so single-base scoping fails.)*
- [ ] **Gmail connector** connected. Required by the final step (`email-generation`, which creates drafts).
  - Not on Gmail? You can still run discovery through composing. Have the skill output the emails as text instead of calling Gmail, and paste them into your own mail client. See the email note in `getting-started.md`.

## 3. Accounts and API keys

- [ ] An **Airtable account you control.** *(You do not build any tables by hand — `client-onboarding` provisions them. You just need the account and the workspace access from step 2.)*
- [ ] A **Serper API key** (required, for discovery) from serper.dev.
- [ ] *(Optional)* A **Hunter API key** (for the contact-enrichment pass) from hunter.io. The free tier is 25 searches/month; a paid plan is needed for real volume.
- [ ] *(Required for the Corporate segment)* An **Apollo API key** (for `corporate-research`'s Apollo-backed Track A candidate search) from apollo.io. The free tier is 75 credits/month — similar low volume to Hunter's; a paid plan is needed for real enrichment spend.

> **Where keys go (two equally-supported ways):** (a) the Airtable **Config** table — one row, `label` = `Keys`, paste into `serper-api-key` / `hunter-api-key` / `apollo-api-key` (after Step 4 builds the tables), which the skills pull via the connector; or (b) **paste the key in chat / upload a `serper.key` (and `hunter.key`, `apollo.key`) file** into the working directory when a skill asks. Config is tidiest when the connector cooperates, but its read has been flaky in testing — the paste/upload path doesn't touch the connector, so keep it as an equal option, not a fallback.
>
> **Key safety:** only low-stakes service keys (Serper, Hunter, free-plan Apollo) may live in Airtable. No passwords, OAuth tokens, or mail credentials. Rotate any key that was ever shared, exported, or screenshotted.

## 4. The 6 skills to upload

Upload these `.skill` files from `install/` into the project. They run in this order:

- [ ] `client-onboarding.skill`
- [ ] `voice-intake.skill`
- [ ] `firm-discovery.skill`
- [ ] `firm-review.skill`
- [ ] `contact-extraction.skill`
- [ ] `email-generation.skill`

*(`corporate-research.skill` is a research aid, not part of the run loop — skip it for a standard run. If you do run it for a Corporate-segment client, you'll need the Apollo key from section 3.)*

## 5. Intake information to have ready

You will feed these to the skills during the run. Fill the worksheets in advance so the sessions go quickly.

- [ ] **Business facts** — answers to `docs/onboarding/worksheet-template.md`. Section 1 is the minimum (gets you a contacts list); add Sections 2–3 for grounded, on-goal emails. `client-onboarding` writes these to the Airtable **Business Profile** table.
- [ ] **Voice** — answers to `docs/onboarding/voice-worksheet.md`, if you want emails in a specific person's voice. `voice-intake` uses these to draft the **Email Templates**. Skip if you only want a contacts list.

## 6. One manual Airtable step

- [ ] After onboarding creates the tables, open the **Firms** table and add a field of type **Created time**, named exactly `discovered-date`. *(The connector cannot set this field type on create, so it is added by hand once.)*

---

## Know before you start (current limitations)

- **Travel copy is gated until verified.** Region travel sentences render only after a human approves them during onboarding; unapproved regions fall back to a safe generic line.
- **Gmail only** for drafting (see the workaround in step 2).
- **`email-generation` never sends.** It creates Gmail drafts; a human reviews and sends each one from their own inbox.
- **The Desktop app can be flaky** — connector reconnect loops and occasional tool-loading hiccups. Retry the step if a connector call fails.

## Ready?

If every box above is checked, open `docs/getting-started.md` at **Step 4 — Run the skills in order** and go.
