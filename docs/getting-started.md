# Getting Started — Rural Hospitality Outreach Pipeline

**Center for Rural AI**

This guide sets up the pipeline for a business that is new **to the pipeline**
(not necessarily a new business) and runs it end to end. It is written for the
operator doing the setup (which may be the business owner or a CRAI helper),
not a developer. Everything happens in a Claude project with two connectors;
no code checkout is required.

It was written from a full live acceptance run (2026-07-20) against a test
client, so the gotchas below are real ones we hit, not hypotheticals.

---

## What you need before you start

> For a printable, tick-as-you-go version of this list, see
> [`pre-flight-checklist.md`](./pre-flight-checklist.md). Come back here for
> the step-by-step run.

1. **A Claude account with Projects on a Team plan** and a new, empty project.
   Pro is not enough — `firm-discovery` and `contact-extraction` need code
   execution with network egress (web scraping), which Pro does not support.
2. **Two connectors enabled in the project:**
   - **Airtable** (all skills read/write here)
   - **Gmail** (required by the final step, email-generation)
3. **An Airtable account** you control.
4. **API keys:**
   - **Serper** (required, for discovery) from serper.dev
   - **Hunter** (optional, for the contact-enrichment pass) from hunter.io
5. **The 6 run-flow skill files** from `dist/`: `client-onboarding`,
   `voice-intake`, `firm-discovery`, `firm-review`, `contact-extraction`,
   `email-generation`. These are the pipeline, run in order.
   (`corporate-research` is **optional** — a Desktop research skill for clients
   running the Corporate segment. Upload it only if you plan to research the
   corporate planner landscape; it is not part of the core run flow.)

> **Email note:** the pipeline currently drafts through **Gmail only** — but a
> non-Gmail business can still run this pipeline through discovery, review, and
> contact-extraction with no change at all; none of that depends on email
> provider. Only the last step, email-generation, is affected: instead of "create
> a Gmail draft per Contact," ask it to **compose the emails and give you the
> text** (it already produces a `{ to, subject, body }` per contact internally
> before the Gmail-draft step; just have it stop there rather than calling the
> Gmail connector) and paste them into your own mail client manually. A native
> IMAP/other-provider draft path is not built yet — this is the interim
> workaround, not a reason the pipeline is unusable for you.

---

## Step 1 — Grant Airtable access

**Do not pre-create a base yourself.** `create_table` into an existing,
manually-created base is unreliable through the connector; the path that
actually works is letting `client-onboarding` create the base itself via
`create_base` (which creates the base and all 8 tables with their fields in one
call, then adds the two cross-table link fields and prompts you for the one
Created-time field as quick follow-ups — Airtable can't create those in the
initial call). Because that base doesn't exist yet at grant time, the connector
needs enough access to list your workspaces and create a base in one of them —
not access scoped to one already-existing base.

1. **Grant the Claude Airtable connector access to a workspace**, not a
   specific base.
   - claude.ai → **Settings → Connectors → Airtable → Connect** → on Airtable's
     screen choose **"Everything you have access to"** (or **Custom access** and
     select the whole **workspace** you want the new base created in) →
     **Grant access**.
   - For a real client's own Airtable account, scope Custom access to the
     workspace where this pipeline's base should live.
2. **If the connect flow loops** between the desktop app and browser: finish the
   **Grant access** click in the browser, then **quit and reopen the desktop
   app** — or just run the project in a **browser** at claude.ai. The skills and
   project are account-level, so the desktop app is not required.
3. If your Airtable account has more than one workspace, `client-onboarding`
   will ask which one to create the base in — have an answer ready.

---

## Step 2 — Upload the 6 skills

For each of the 6 `.skill` files: claude.ai → **Settings → Skills → Add Skill** →
upload. Each installs once and is then available in any conversation.

---

## Step 3 — Get and store your API keys

1. Create a **Serper** key at serper.dev (required). Optionally a **Hunter** key
   at hunter.io (only needed for the enrichment pass).
2. Give the key to the skill one of two equally-supported ways:
   - **Config table:** after onboarding builds the tables (Step 4), add one row,
     `label` = `Keys`, and paste each key into `serper-api-key` /
     `hunter-api-key`. Discovery and extraction can then pull the key via the
     connector — no per-run step. This is the tidiest option **when Desktop is
     cooperating**, but the tool call that reads that row has been unreliable in
     testing (a Claude-side tool-loading issue, not Airtable), so treat the next
     option as an equal, not a fallback.
   - **Paste or upload per run:** paste the key into the chat when the skill asks,
     or upload a one-line file named `serper.key` (and/or `hunter.key`) into the
     working directory. The skill reads either automatically. This does not depend
     on the connector, so it's the reliable choice when Config reads are flaky.

   Either way the key lands in the same place at runtime; pick whichever is
   working for you that session.

**Key safety (low-stakes keys only):**
- Only **Serper** and **Hunter** (and free-plan Apollo) may live in Airtable.
  **Never** store passwords, OAuth tokens, mail/IMAP credentials, or payment
  methods.
- Keep the base **private**. **Do not screenshot or export the Config table.**
- If a key is ever exposed (shared, exported, screenshotted), **rotate it** —
  all providers regenerate in one click.

---

## Step 4 — Run the skills in order

Run these **in order**, in the project. `client-onboarding` must go **first** —
the others hard-stop if the Business Profile is empty.

Each step below shows a **quoted line to say to Claude, verbatim**, to start
that skill — paste it into the project chat as-is. The bullets under it explain
what happens next and what it'll ask you for.

### 4.1 client-onboarding
> "Onboard a new client."

- On a **first run** it creates the base for you (see Step 1) and will ask
  **which workspace** to create it in — have an answer ready if your Airtable
  account has more than one. On a **re-run against an existing base**, it will
  instead ask for that **base URL** (paste it from your browser's address bar;
  the skill extracts the ID) so it tops up the existing base rather than making
  a second one.
- Tell it the **segments** (Wedding, Corporate, or both).
- It will interview you for the **intake facts** it needs (business name,
  location, capacity, highlights, the email signature block, one **destination
  airport** near the property — the airport guests fly *into*, not the
  origin-city airports, and so on). Work from
  `docs/onboarding/worksheet-template.md` — Section 1 covers everything
  required, Sections 2–3 are optional and add richer copy — rather than trying
  to guess what "intake info" means on the fly.
- It provisions **8 tables**, writes a single **Business Profile** row, and (with
  your approval) writes **Region Travel** sentences. It will **research and verify
  travel facts** and may correct optimistic drive-time estimates — let it.
- **One manual step it will prompt for:** open the **Firms** table → add a field →
  choose **Created time** → name it exactly `discovered-date`. (Airtable's API
  cannot create this field type, so a human adds it once.)

### 4.2 voice-intake
> "Capture the voice for <Business> and draft the outreach templates."

- Interviews you on how the owner writes, drafts per-segment copy for approval,
  then writes **Email Templates** rows. Templates can use two tokens, both
  filled in at send: `{{travel}}` (the per-region travel line) and `{{firm}}`
  (the firm lead-in). `{{travel}}` is the common one; `{{firm}}` is optional and
  mainly used in Corporate copy — a Wedding template with only `{{travel}}` and
  no `{{firm}}` is correct, not a mistake. Templates must not include a greeting
  or signature (those are added automatically at send).

### 4.3 firm-discovery
> "Run firm-discovery for <City>, <segment>, small sample."

- Geocodes the city, searches, returns **firm records as JSON**. Writes **nothing**
  to Airtable. Spends real Serper credits on real firms. Start with one city and
  one page as a smoke test.

### 4.4 firm-review
> "Review those discovery results and save the good ones to Firms."

- Categorizes planner / venue / vendor, marks Keep / Review / Discard, and is the
  **only writer** to the Firms table — only the ones marked Keep get saved.
  Do not trust Google's "Type" label; the skill overrides it with name-level
  judgment.

### 4.5 contact-extraction
> "Run contact-extraction on the Firms — pass 1 (scrape)."
> Optional: "Run pass 2 (Hunter enrichment)."

- Pass 1 scrapes each firm's site for an email (no key needed). Pass 2 uses Hunter
  to recover named people and retry the misses (needs `hunter.key`; the free tier
  is ~25–50 searches/month). Writes **Contacts** linked to their firm.

### 4.6 email-generation
> "Create one Gmail draft per Contact — drafts only, do not send."

- Renders each template (greeting, travel line, firm lead-in, signature) and
  creates **Gmail drafts**. It never sends. The operator reviews and sends each
  draft from their own inbox.

---

## Current limitations (know these before a real deployment)

- **Custom travel lines are per-client — but the mapping must be set up.** Region
  mapping and travel copy are both per-client Airtable tables (Region Naming,
  Region Travel), written by onboarding; a new client's own regions render their
  verified sentences. Two things to get right or emails fall back to the generic
  line: (1) each Region Naming row's **anchor city (or an alias) must match the
  market your discovery actually searches** — the match is a case-insensitive
  substring, so "Nashville" matches a "Nashville, TN" market but a mismatch
  silently returns the fallback; (2) a base **provisioned before 2026-07-22**
  predates the Region Naming table — **re-run `client-onboarding`** so it is
  created and populated.
- **Multi-word city markets** (e.g. "Little Rock", "Santa Fe") are handled
  correctly — the earlier truncation bug (F22) is fixed in discovery's
  `extractSearchMarket()`, which strips only a trailing US state code and keeps
  the full city name.
- **Gmail only** for drafting (see the email note up top).
- **Desktop app can be flaky, in two distinct ways** — both on the Claude side,
  not Airtable's service (in testing, every well-formed call that reached Airtable
  succeeded):
  1. **Connection-level reconnect loops** between the app and browser. Quitting
     and reopening the app, or running the project in a **browser**, fixes these.
  2. **Individual tool calls intermittently failing** — a tool not loading when
     the skill goes to call it, or a call's arguments getting mangled in transit.
     This can hit plain **record reads** (the Config key row, Business Profile /
     Region tables), not just table creation. Retry the step; switch to a browser;
     and for the key read specifically, fall back to paste/upload per Step 3
     rather than waiting on the connector.
- **After changing a live base's schema**, start a fresh session before the next
  skill run — an in-progress session can keep using a cached schema and silently
  skip new fields.

---

## Safety checklist

- **Test / fictitious clients:** the discovered firms are **real businesses**.
  Never send drafts written on behalf of a business that does not exist — review,
  then **delete** the drafts.
- **Rotate keys** that were ever screenshotted, shared, or exported.
- The pipeline **never sends** on its own; a human sends every email.
