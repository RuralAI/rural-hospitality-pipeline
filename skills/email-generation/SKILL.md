---
name: email-generation
description: >
  Renders the approved outreach email for each contact and creates a Gmail draft
  per contact. Reads Contacts and their linked Firms from Airtable, composes the
  segment template (verified per-region travel line, firm lead-in, greeting,
  signature) with a deterministic script, then creates one Gmail draft each via
  the Gmail connector. Use for Stage 03, generating outreach emails, creating
  drafts, or writing emails for a list of contacts.
compatibility: Requires code execution. Airtable connector (reads Business Profile, Email Templates, Region Travel, Region Naming, Contacts, Firms) and Gmail connector (create_draft) required.
---

# Email Generation and Gmail Drafts

Turns Contacts into ready-to-send Gmail drafts. The approved template copy and
per-region travel sentences come from Airtable (Email Templates, Region Travel),
read via the connector in step 0; `compose.mjs` only substitutes the two tokens,
adds the greeting, and appends the signature.

## Flow

### 0. Read Business Profile, Email Templates, Region Travel, and Region Naming via the connector

Read Business Profile (single row). If the table is empty, stop and tell the
operator to run `client-onboarding` first. Read Email Templates. If it has no
record for the segment you're generating, stop and tell the operator to run
`voice-intake`'s template-drafting step first -- there is no bundled default to
fall back to. Read Region Travel and Region Naming (both may be empty or
missing rows for some regions -- that's expected, not an error; a region with
no Region Naming row just never matches, and falls back the same as an
unverified one).

Write these files in the working directory:

```json
// business-profile.json
{ "business-name": "...", "business-url": "...", "location": "...", "signing-name": "...", "signature-title": "...", "signature-address": "...", "signature-phone": "...", "signature-website": "..." }
```

```json
// email-templates.json -- array, one record per Email Templates row
[{ "subject": "...", "segment": "Wedding", "body": "...", "sign-off": "..." }]
```

```json
// region-travel.json -- array, one record per Region Travel row (may be [])
[{ "region-id": "north_valley", "segment": "Wedding", "sentence": "..." }]
```

```json
// region-naming.json -- array, one record per Region Naming row (may be [])
[{ "region-id": "north_valley", "anchor-city": "Northgate", "aliases": "Oakdale\nPinecrest" }]
```

### 1. Read Contacts and linked Firms via the connector

Read the Contacts table (plain name works for reads). For each contact you need:
its email, its linked firm's name, and the market that firm was found in
(`search-market`, falling back to `city-metro`) so the right region travel line
is chosen. Read the linked Firms to get the firm name and market.

Write a `contacts.json` array in the working directory:

```json
[{ "email": "planner@firm.com", "firm": "Larkspur Events", "market": "Northgate", "segment": "Wedding", "name": "" }]
```

`name` is usually empty for scraped contacts, which produces a "Hello," greeting.

### 2. Compose

```bash
node compose.mjs --input contacts.json
```

Output is a JSON array of `{ to, subject, body }`, one per contact. The travel
line is the human-verified sentence for the contact's region, or a safe
no-transit-claim fallback if the region is unknown or unverified. Nothing about
the travel claim is composed at run time.

### 3. Create one Gmail draft per email

For each composed item, call the Gmail connector `create_draft` with `to`
(required), `subject`, and `body`. These are drafts, not sends. The operator
reviews and sends each from their own Gmail.

## Two things this skill does NOT do

- It does not log drafts to the Outreach table (not needed for the outreach
  flow). If you later want to log drafts there, that write hits the same
  `tbl`/`fld` ID requirement as any Airtable write (resolve via the table URL if
  `list_tables_for_base` is unreliable).
- It does not verify deliverability. Drafts go to whatever address extraction
  found.

## Config sources

- Business Profile, Email Templates, Region Travel, and Region Naming all come
  from the connector read in step 0 above, not from bundled config. Region
  Naming is per-client: a market only resolves to a region if this client's own
  Region Naming table has a matching row, so a new client never inherits
  another client's regions. Unmatched cities fall back safely to the generic
  no-transit-claim sentence.
- `email-templates.mjs`, `region-travel.mjs`, and `region-naming.mjs` still ship
  in this folder but are no longer read by `compose.mjs` -- they exist only as
  Example Inn's own migration-source data (see the self-service onboarding
  design's Migration section).
