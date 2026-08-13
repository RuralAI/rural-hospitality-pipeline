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

**Version:** 2.0.0 · Center for Rural AI

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

### 4. Write Contacts via the connector, before offering pass 2

**Write as soon as pass 1 finishes. Do not hold results back waiting for a
decision about Hunter.** Everything up to this point lives only in
`stage-02-results.json` in the session's working directory. That file is crash-safe
*within* a session, but it does not survive the session ending: a closed tab, a
dropped connection, or a hit session limit takes the whole batch with it, and any
Hunter credits already spent are spent for nothing. Airtable is the only durable
place, so get the rows in early. Pass 2 updates them in place (step 6), so writing
first costs nothing.

For each `found` result, create one Contact linked to its firm. **Write them
without asking** — this is the step the operator asked for, and a Contact with an
email is never the wrong outcome.

Skip `needs_manual` results by default: a blank-email Contact is a row
`email-generation` cannot send to, so it buys nothing and clutters the table. The
firm stays in Firms either way, so nothing is lost and the Hunter pass (step 5) or
a later re-run can still fill it in. Only write blank-email placeholders if the
operator asks for them by name.

Writes require ids, not names. The create tool rejects the plain table name. You
need the Contacts table id (`tbl...`) and field ids (`fld...`). If
`list_tables_for_base` does not return them reliably, ask the operator to open
the Contacts table in Airtable and paste the URL: the `tbl` id is in it. Pass the
linked firm as a list containing the firm record id string. Pass `email-verified`
as boolean false.

Keep the firm id → Contact record id mapping from these writes. Step 6 needs it to
update rather than duplicate.

### 5. Optional: enrich weak results with Hunter

`extract.mjs`'s scrape alone finds an address, not a person, and often
nothing usable at all — a Hunter Domain Search pass recovers named contacts
and upgrades generic inboxes on the firms the scrape left weak.

A Hunter key is required (a paid plan — the free tier's 25 searches/month
isn't meaningful at real batch volume; the first paid tier's 24K credits is).
Resolve it the same way `discover.mjs` resolves Serper's, and in the same order:
read `hunter-api-key` from the single-row Airtable Config table via the connector
first, and only if that cell is empty ask the user to paste one (telling them it
belongs in base → Config table → `hunter-api-key`) or upload a `hunter.key` file
next to the script. Do not echo the key back into the conversation.

```bash
node enrich.mjs --hunter-key <key>
# or: HUNTER_API_KEY=<key> node enrich.mjs
```

Reads `stage-02-results.json` (from step 3) and `firms.json` (from step 1,
for a `needs_manual` firm's website), queries Hunter only for firms that were
`needs_manual` or had a generic shared-inbox address, and writes
`stage-02-final.json` — same crash-safe/resumable pattern as `extract.mjs`.

### 6. Update Contacts with what pass 2 won

Read `stage-02-final.json` and reconcile it against what step 4 already wrote.
Same rule as step 4: apply it, do not ask first. Per firm:

- **Hunter won, and the firm already has a Contact** (it was `found` in pass 1):
  update that record in place. Set `email`, `all-emails`, `first-name`,
  `last-name`, `title`, and `contact-source` to "Hunter". Update, never create, or
  you get two Contacts for one firm.
- **Hunter recovered a firm that was `needs_manual`** (so step 4 skipped it):
  create the Contact now, exactly as step 4 would have.
- **The scrape held:** leave the record alone.

Then report, briefly: how many records gained a real name, how many firms were
recovered from `needs_manual`, and the running total of Contacts. Do not re-list
every firm — the table is in Airtable, and they can look.

## Field mapping (holding file to Contacts)

- `email` to `email`
- `all_emails` (array) to `all-emails` (newline joined)
- `contact_source` to `contact-source`
- `email_verified` to `email-verified` (false)
- `firm_id` to `firm-id` (link: a list holding the firm record id)
- first-name, last-name, title: blank unless the Hunter enrichment step
  (step 5) ran and won for that firm — the scrape alone yields no name.
- `contact_source` is "Scraped" unless Hunter's result won, in which case
  it's "Hunter".

## Reporting pass 1

The operator wants to know it worked and what to do next. They do not want a
per-firm audit. Keep the whole report to a few lines, in this shape:

1. **Lead with the result.** "10 of your 14 firms now have a contact email, saved
   to Contacts." That is the headline, and it goes first.
2. **Name only the firms with no email**, as a short list. These are the ones the
   next step goes after, so they are the only per-firm detail that earns its place.
3. **Close with the Hunter prompt**, as an invitation to one action: say that
   Hunter can chase the ones that came up empty and can also put a real name to
   the generic `info@` style addresses, then ask if they want to run it.

Do **not** put in the pass 1 report: a table of every firm and its address, hit
rate percentages or commentary on whether the rate is good, an explanation of why
`first-name`/`title` are blank, the `email_verified` or `contact_source` values, or
Hunter's pricing tiers. All of that is either already visible in Airtable or
irrelevant to the one decision in front of them.

Never end pass 1 with two open questions. The `needs_manual` firms are handled by
the default above, so the only question is whether to run Hunter.

## Known limits

- Scraping finds an address, not a person. The optional Hunter step (step 5)
  recovers names for weak results; without it, or where Hunter also comes up
  empty, names stay blank.
- `fetch()` plus regex only. No paid APIs, no new dependencies.
