---
name: contact-extraction
description: >
  Extracts a best-guess contact email for each firm in an Airtable Firms table by
  scraping the firm website (homepage plus contact/about pages, mailto and
  plaintext harvest), then writes one Contact per firm back to Airtable, deduped
  against existing Contacts. Use whenever the operator wants to get emails for
  discovered firms, run Stage 02, extract contacts, or find contact addresses for
  a list of firms. Reads Firms via the Airtable connector, runs the scraper in
  code execution, writes Contacts via the connector.
compatibility: Requires code execution with network egress. Airtable connector required (reads Business Profile and Firms, writes Contacts). A paid Hunter plan is needed for the optional enrichment step to be useful at real volume (free tier is 25 searches/month).
---

# Contact Extraction

Turns discovered Firms into Contact records, one best email each. The scrape
logic is the real Stage 02 core (`stage-02-extraction.mjs`), unchanged.
`extract.mjs` is the runner: input loading, a resumable holding file, progress
logging, an optional graceful deadline. Neither script touches Airtable.

## Flow: connector, then script, then connector

The connector handles the read and the write. The script does the scraping in
between. This split is deliberate and proven.

### 0. Read Business Profile via the connector

Read the Business Profile table (single row). If the table is empty, stop and
tell the operator to run the `client-onboarding` skill first. `business-url`
is required: the scraper's User-Agent has no fallback for a missing URL, so a
blank field is also a hard stop.

Write `business-profile.json` in the working directory:

```json
{ "business-name": "Example Inn", "business-url": "https://www.example.com" }
```

### 1. Read Firms via the connector

Read the Firms table (read tools accept the plain name "Firms"). Filter to the
segment in play (e.g. Wedding). Keep each firm's Airtable record id (the `rec...`
value): it is the link key for the Contact you will write.

Write the firms to `firms.json` in the working directory as a JSON array. The
runner accepts the Airtable record shape directly:
`{ "id": "rec...", "fields": { "firm-name": "...", "website-url": "..." } }`

### 2. Dedup against existing Contacts, before scraping

The connector does not dedup. Read existing Contacts, collect their linked firm
ids into a Set, and remove any firm already linked to a Contact from
`firms.json`. Skipping this creates duplicate Contacts. This is the reliable
pattern.

### 3. Run the scraper

```bash
node extract.mjs --input firms.json --out stage-02-results.json
```

One attempt per firm, no retries. Results are written after every firm (crash
safe and resumable: re-running skips firms already done). For a large batch add
`--deadline-ms 45000` to stop cleanly before a session limit, then run again to
resume.

Each result carries: `firm_id` (the link key), `email` (best), `all_emails`,
`status` ("found" or "needs_manual"), `contact_source` ("Scraped"), and
`email_verified` (always false: scraping is not deliverability).

### 3.5. Optional: enrich weak results with Hunter

`extract.mjs`'s scrape alone finds an address, not a person, and often
nothing usable at all — a Hunter Domain Search pass recovers named contacts
and upgrades generic inboxes on the firms the scrape left weak.

A Hunter key is required (a paid plan — the free tier's 25 searches/month
isn't meaningful at real batch volume; the first paid tier's 24K credits is).
Resolve it the same way `discover.mjs` resolves Serper's: paste it in chat as
an env var, or upload a `hunter.key` file next to the script.

```bash
node enrich.mjs --hunter-key <key>
# or: HUNTER_API_KEY=<key> node enrich.mjs
```

Reads `stage-02-results.json` (from step 3) and `firms.json` (from step 1,
for a `needs_manual` firm's website), queries Hunter only for firms that were
`needs_manual` or had a generic shared-inbox address, and writes
`stage-02-final.json` — same crash-safe/resumable pattern as `extract.mjs`.
If this step runs, step 4 reads from `stage-02-final.json` instead of
`stage-02-results.json`; otherwise nothing about step 4 changes.

### 4. Write Contacts via the connector

For each `found` result, create one Contact linked to its firm. `needs_manual`
results can be written with a blank email (the no-email signal) or skipped for a
demo.

Writes require ids, not names. The create tool rejects the plain table name. You
need the Contacts table id (`tbl...`) and field ids (`fld...`). If
`list_tables_for_base` does not return them reliably, ask the operator to open
the Contacts table in Airtable and paste the URL: the `tbl` id is in it. Pass the
linked firm as a list containing the firm record id string. Pass `email-verified`
as boolean false.

## Field mapping (holding file to Contacts)

- `email` to `email`
- `all_emails` (array) to `all-emails` (newline joined)
- `contact_source` to `contact-source`
- `email_verified` to `email-verified` (false)
- `firm_id` to `firm-id` (link: a list holding the firm record id)
- first-name, last-name, title: blank unless the Hunter enrichment step
  (3.5) ran and won for that firm — the scrape alone yields no name.
- `contact_source` is "Scraped" unless Hunter's result won, in which case
  it's "Hunter".

## Known limits

- Scraping finds an address, not a person. The optional Hunter step (3.5)
  recovers names for weak results; without it, or where Hunter also comes up
  empty, names stay blank.
- `fetch()` plus regex only. No paid APIs, no new dependencies.
