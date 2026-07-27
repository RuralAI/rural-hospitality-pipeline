# Airtable Schema

One Airtable base. Three linked tables — Firms → Contacts → Outreach — plus standalone Business Profile, Email Templates, Region Travel, Region Naming, and Config tables; the with-review variant adds a Review table. Field names are canonical — the pipeline code and Claude prompts reference them exactly. Do not rename fields without updating the pipeline modules and prompt templates.

**Template variants.** The pipeline ships as two copyable base templates: **basic** (no Review table) and **with-review** (adds the Review table for in-Airtable triage). Both include the Config table. `basic` is the default; pass `--variant with-review` to the setup script to provision the with-review shape.

---

## Tables

### Firms

Populated by Stage 01 (firm discovery) and the audit-tool promote endpoint (Keep records only).

Two categories of location data are stored separately:

- **Where the firm actually is** — `city-metro` and `zip` are parsed from the firm's address (truth about the firm).
- **What surfaced the firm** — `search-market` and `search-zip` capture the query Stage 01 used to find it (exactly one of the two will be populated per record).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `firm-name` | Text | Yes | Dedup compares the normalized form (see `src/lib/normalize.js`) |
| `city-metro` | Text | No | Firm's actual city, parsed from the place address. Empty if address parsing fails. |
| `website-url` | URL | Yes | |
| `segment` | Single select | Yes | `Wedding` \| `Corporate` |
| `source` | Text | Yes | Where found: ILEA directory, Google Maps, TheKnot, etc. |
| `zip` | Text | No | Firm's actual 5-digit US zip, parsed from the place address. Never falls back to the search query. |
| `search-market` | Text | No | The geography string used in the Stage 01 search (e.g. `Telluride`, `Northgate`). Empty when the search was zip-based. |
| `search-zip` | Text | No | The zip code used in the Stage 01 search. Empty when the search was city-based. |
| `firm-size-est` | Text | No | 1–5, 6–20, 20+ |
| `specialties` | Text | No | Primary personalization signal for email generation |
| `notes` | Long text | No | Researcher notes, flags, manual review. Promote endpoint appends `· Audit: <reason>` |
| `discovered-date` | Created time | Auto | Populated automatically by Airtable on record creation |

---

### Contacts

Populated by Stage 02 (contact extraction). Linked to Firms.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `first-name` | Text | No | Often blank for Stage 02 v1 scraped records — the scraper captures the email but not the human behind it |
| `last-name` | Text | No | Same as above; populated later by enrichment (Hunter) or manual research |
| `title` | Text | No | Job title — used in email prompt |
| `email` | Email | Yes | Best/primary address. When multiple are found, the full set is in `all-emails` |
| `all-emails` | Long text | No | All addresses found for the contact, one per line. Mirrors the v1 holding-file `all_emails` array |
| `email-verified` | Checkbox | Yes | Informational only. Scraped records start unchecked. No longer gates Stage 03. Any contact with an email gets a generated email. |
| `contact-source` | Single select | No | `Scraped` \| `Hunter` \| `Manual` — how the email was obtained. Stage 02 v1 writes `Scraped` |
| `firm-id` | Link to Firms | Yes | A firm with no linked Contact is the `needs_manual` signal — no email was found |
| `linkedin-url` | URL | No | Additional personalization signal |

---

### Outreach

Populated by Stage 03 (email generation and send). Linked to Contacts.

| Field | Type | Notes |
|-------|------|-------|
| `contact-id` | Link to Contacts | |
| `generated-subject` | Text | Output from Claude API |
| `generated-body` | Long text | Output from Claude API |
| `send-status` | Single select | `Pending` \| `Sent` \| `Bounced` \| `Error` |
| `date-sent` | Date | Set on confirmed send |
| `opened` | Checkbox | Set via webhook from sending tool |
| `replied` | Checkbox | Set manually or via webhook |
| `follow-up-sent` | Checkbox | True after follow-up email sent |

### Business Profile

Single-row home for the client's business facts (identity, signature block,
capacity, highlights, target regions, segments), same single-row convention as
Config. Written by the `client-onboarding` skill (single-row upsert, never a
duplicate insert); read at runtime by `firm-review`, `contact-extraction`, and
`email-generation`. Missing this table is a hard stop for all three: run
`client-onboarding` first. Not linked to other tables.

| Field | Type | Notes |
|-------|------|-------|
| `label` | Text | Primary field, e.g. `Profile` |
| `business-name` | Text | |
| `business-url` | URL | Required before `contact-extraction` can run — no fallback for a missing URL |
| `location` | Text | e.g. `Rivertown, Colorado` — feeds the generic travel fallback sentence when a region has no Region Travel row |
| `signing-name` | Text | |
| `signature-title` | Text | |
| `signature-address` | Text | |
| `signature-phone` | Text | |
| `signature-website` | Text | |
| `capacity` | Text | Free text, e.g. `16 to 21 guests (full-property buyout)` |
| `destination-airport-code` | Text | |
| `destination-airport-name` | Text | |
| `highlights` | Long text | One per line |
| `corporate-highlights` | Long text | One per line |
| `target-region-ids` | Long text | One `region_id` per line, keyed to this client's own Region Naming table |
| `segments` | Multiple select | `Wedding` \| `Corporate` |

### Email Templates

Holds the operator-edited outreach letter, one record per segment. Written by the
Stage 03 editable-letter tool (`PUT /api/template`) and read by generation
(`/api/generate`). Not linked to other tables. A segment with no record falls back
to the shipped default in `config/email-templates.js`, so this table can start empty.

| Field | Type | Notes |
|-------|------|-------|
| `subject` | Text | Editable subject line (primary field) |
| `segment` | Single select | `Wedding` \| `Corporate` — one record per segment |
| `body` | Long text | Paragraphs separated by blank lines; keep `{{travel}}`/`{{firm}}` tokens verbatim |
| `sign-off` | Text | e.g. `Warm regards,` |
| `updated-at` | Text | ISO timestamp stamped by the app on save |

### Region Travel

Per-client, human-approved travel notes, one record per region + segment. Written by `client-onboarding`'s region-setup step and read by `email-generation`; a region with no record falls back to a generic no-transit-claim sentence, so this table can start empty. Not linked to other tables.

| Field | Type | Notes |
|-------|------|-------|
| `region-id` | Text | Region key, e.g. `north_valley` (see Region Naming below) |
| `segment` | Single select | `Wedding` \| `Corporate` — one record per region + segment |
| `sentence` | Long text | The travel sentence rendered into the `{{travel}}` token |
| `updated-at` | Text | ISO timestamp stamped by the app on save |

### Region Naming

Per-client, one record per region. Written by `client-onboarding`'s region-setup step and read by `email-generation` to resolve a contact's `search-market`/`city-metro` to a `region-id` before looking up Region Travel. A market that matches no row (or an empty table) falls back to the generic sentence — this is what stops a new client from inheriting another client's regions (e.g. Example Inn's Northgate/Baytown/Southport/Junction City never resolve for a client that hasn't defined them). Not linked to other tables.

| Field | Type | Notes |
|-------|------|-------|
| `region-id` | Text | Primary field. Stable slug, e.g. `north_valley` — matches Region Travel's `region-id` and Business Profile's `target-region-ids` |
| `anchor-city` | Text | The region's main city, e.g. `Northgate` |
| `aliases` | Long text | Nearby cities/suburbs worth matching, one per line, e.g. `Oakdale` / `Pinecrest`. May be empty |

### Config

Single-row home for the operator's service API keys. This is the **only** permitted place to store the Serper / Hunter / Apollo keys, per `docs/key-handling-standard.md` (the Skills surface has no environment store). Single-row convention: the operator fills in one row; the setup script does not seed it. Private base assumed — see the standard for the guardrails (private base, rotate on exposure). Not linked to other tables. Present in **both** variants.

| Field | Type | Notes |
|-------|------|-------|
| `label` | Text | Primary field. A name for the row, e.g. `Keys` |
| `serper-api-key` | Text | Serper.dev search key |
| `hunter-api-key` | Text | Hunter.io enrichment key |
| `apollo-api-key` | Text | Apollo.io enrichment key. Account-scoped — rotate on exposure (see standard) |

### Review (with-review variant only)

Present only when the base was provisioned with `--variant with-review`. Its presence switches the operator into the **Option B in-Airtable triage flow**: discovery output lands here for categorize + Keep/Review/Discard, and Keep records promote to Firms. Reuses the Firms field definitions for the overlapping columns plus two triage fields. No `discovered-date` (the Meta API cannot create Created-time fields).

| Field | Type | Notes |
|-------|------|-------|
| `firm-name` | Text | Primary field (same as Firms) |
| `city-metro` | Text | Same as Firms |
| `website-url` | URL | Same as Firms |
| `segment` | Single select | `Wedding` \| `Corporate` |
| `source` | Text | Same as Firms |
| `zip` | Text | Same as Firms |
| `search-market` | Text | Same as Firms |
| `search-zip` | Text | Same as Firms |
| `specialties` | Text | Same as Firms |
| `notes` | Long text | Same as Firms |
| `category` | Single select | `Planner` \| `Venue` \| `Vendor` \| `Unclear` |
| `review-status` | Single select | `Keep` \| `Review` \| `Discard` |

---

## Setup Steps

1. Create a new Airtable base
2. Create the tables above with these exact field names (or run `npm run setup:airtable`; add `-- --variant with-review` for the Review table)
3. Link the tables: Contacts.`firm-id` → Firms, Outreach.`contact-id` → Contacts
4. Copy the base ID from the Airtable URL: `airtable.com/[BASE_ID]/...`
5. Add `AIRTABLE_BASE_ID` and `AIRTABLE_API_KEY` to your `.env.local`

Run the setup script against **each** base you deploy to — the dev base and prod
(your production base) — since it creates schema in whatever `AIRTABLE_BASE_ID` points at.

---

## Template Note

For a new client deployment, create a new Airtable base using this schema.
The schema is identical across deployments — client-specific values are data, not structure.
