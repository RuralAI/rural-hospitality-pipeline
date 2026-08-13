# Airtable Schema

One Airtable base. Three linked tables — Firms → Contacts → Outreach — plus standalone Business Profile, Email Templates, Region Travel, Region Naming, and Config tables; the with-review variant adds a Review table. Field names are canonical — the pipeline code and Claude prompts reference them exactly. Do not rename fields without updating the pipeline modules and prompt templates.

**How the base gets built.** The `client-onboarding` skill provisions it through the
Airtable connector — the operator creates nothing by hand except the one
`discovered-date` field (Airtable's API cannot create Created-time fields). Onboarding
always builds the **basic** shape. The **with-review** shape (adds a Review table for
in-Airtable triage) exists only in the maintainer script; see
[Provisioning](#provisioning) below.

---

## Tables

### Firms

Written by `firm-review`, which is the sole writer to this table (Keep records only).

Two categories of location data are stored separately:

- **Where the firm actually is** — `city-metro` and `zip` are parsed from the firm's address (truth about the firm).
- **What surfaced the firm** — `search-market` and `search-zip` capture the query `firm-discovery` used to find it (exactly one of the two will be populated per record).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `firm-name` | Text | Yes | Dedup compares the normalized form (see `src/lib/normalize.js`) |
| `city-metro` | Text | No | Firm's actual city, parsed from the place address. Empty if address parsing fails. |
| `website-url` | URL | Yes | |
| `segment` | Single select | Yes | `Wedding` \| `Corporate` |
| `audience` | Single select | No | `Agency` \| `In-house`. Who the email is written to, independent of segment. `Agency` (the default, and every Maps-sourced firm) places other people's groups. `In-house` is an employer booking for its own team, written only by `corporate-research`'s Apollo step. Selects the Email Templates variant; blank reads as `Agency`. |
| `source` | Text | Yes | Where found: ILEA directory, Google Maps, TheKnot, etc. |
| `zip` | Text | No | Firm's actual 5-digit US zip, parsed from the place address. Never falls back to the search query. |
| `search-market` | Text | No | The geography string used in the discovery search (e.g. `Telluride`, `Northgate`). Empty when the search was zip-based. |
| `search-zip` | Text | No | The zip code used in the discovery search. Empty when the search was city-based. |
| `firm-size-est` | Text | No | 1–5, 6–20, 20+ |
| `specialties` | Text | No | Primary personalization signal for email generation |
| `notes` | Long text | No | Researcher notes, flags, manual review |
| `discovered-date` | Created time | Auto | Populated automatically by Airtable on record creation |

---

### Contacts

Written by `contact-extraction`. Linked to Firms.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `first-name` | Text | No | Often blank on scraped records — the scrape pass captures the email but not the human behind it |
| `last-name` | Text | No | Same as above; populated by the Hunter enrichment pass or manual research |
| `title` | Text | No | Job title — used in email generation |
| `email` | Email | Yes | Best/primary address. When multiple are found, the full set is in `all-emails` |
| `all-emails` | Long text | No | All addresses found for the contact, one per line |
| `email-verified` | Checkbox | Yes | Informational only. Scraped records start unchecked; it does not gate `email-generation`. Any contact with an email gets a draft. |
| `contact-source` | Single select | No | `Scraped` \| `Hunter` \| `Manual` \| `Apollo` — how the email was obtained. The scrape pass writes `Scraped` |
| `firm-id` | Link to Firms | Yes | A firm with no linked Contact is the `needs_manual` signal — no email was found |
| `linkedin-url` | URL | No | Additional personalization signal |

---

### Outreach

Provisioned for send tracking, but **no skill writes to it today** — `email-generation`
creates Gmail drafts and stops there, and the operator sends from their own inbox. Treat
these fields as a manual log if you want one. Linked to Contacts.

| Field | Type | Notes |
|-------|------|-------|
| `contact-id` | Link to Contacts | |
| `generated-subject` | Text | The subject line that was drafted |
| `generated-body` | Long text | The body that was drafted |
| `send-status` | Single select | `Pending` \| `Sent` \| `Bounced` \| `Error` |
| `date-sent` | Date | Set on confirmed send |
| `opened` | Checkbox | Manual |
| `replied` | Checkbox | Manual |
| `follow-up-sent` | Checkbox | Manual; true after a follow-up email is sent |

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

Holds the approved outreach letter, one record per segment **and audience**. Written
by `voice-intake` (after the owner approves the draft) and read by
`email-generation`. Not linked to other tables. There is **no** fallback: a missing
record is a hard stop, because the only copy that goes out is copy a human approved
(`email-templates-store.mjs`). A Corporate client ends up with two records, both
`segment: Corporate`, one per audience.

| Field | Type | Notes |
|-------|------|-------|
| `subject` | Text | Approved subject line (primary field) |
| `segment` | Single select | `Wedding` \| `Corporate` |
| `audience` | Single select | `Agency` \| `In-house`. Matched against the firm's `audience` to pick the variant. Blank reads as `Agency`, so never leave it blank on in-house copy: it would overwrite the agency record. |
| `body` | Long text | Paragraphs separated by blank lines; keep `{{travel}}`/`{{firm}}` tokens verbatim |
| `sign-off` | Text | e.g. `Warm regards,` |
| `updated-at` | Text | ISO timestamp stamped by the skill that wrote the row |

### Region Travel

Per-client, human-approved travel notes, one record per region + segment. Written by `client-onboarding`'s region-setup step and read by `email-generation`; a region with no record falls back to a generic no-transit-claim sentence, so this table can start empty. Not linked to other tables.

| Field | Type | Notes |
|-------|------|-------|
| `region-id` | Text | Region key, e.g. `north_valley` (see Region Naming below) |
| `segment` | Single select | `Wedding` \| `Corporate` — one record per region + segment |
| `sentence` | Long text | The travel sentence rendered into the `{{travel}}` token |
| `updated-at` | Text | ISO timestamp stamped by the skill that wrote the row |

### Region Naming

Per-client, one record per region. Written by `client-onboarding`'s region-setup step and read by `email-generation` to resolve a contact's `search-market`/`city-metro` to a `region-id` before looking up Region Travel. A market that matches no row (or an empty table) falls back to the generic sentence — this is what stops a new client from inheriting another client's regions (e.g. Example Inn's Northgate/Baytown/Southport/Junction City never resolve for a client that hasn't defined them). Not linked to other tables.

| Field | Type | Notes |
|-------|------|-------|
| `region-id` | Text | Primary field. Stable slug, e.g. `north_valley` — matches Region Travel's `region-id` and Business Profile's `target-region-ids` |
| `anchor-city` | Text | The region's main city, e.g. `Northgate` |
| `aliases` | Long text | Nearby cities/suburbs worth matching, one per line, e.g. `Oakdale` / `Pinecrest`. May be empty |

### Config

Single-row home for the operator's service API keys. This is the **only** permitted place to store the Serper / Hunter / Apollo keys, per `docs/key-handling-standard.md` (the Skills surface has no environment store). Single-row convention: the operator fills in one row by hand; provisioning creates the table empty and never seeds it. Private base assumed — see the standard for the guardrails (private base, rotate on exposure). Not linked to other tables. Present in **both** variants.

| Field | Type | Notes |
|-------|------|-------|
| `label` | Text | Primary field. A name for the row, e.g. `Keys` |
| `serper-api-key` | Text | Serper.dev search key |
| `hunter-api-key` | Text | Hunter.io enrichment key |
| `apollo-api-key` | Text | Apollo.io enrichment key. Account-scoped — rotate on exposure (see standard) |

### Review (with-review variant only)

Not created by `client-onboarding` — it exists only in bases provisioned by the maintainer
script with `--variant with-review`. It supports an alternate, manual triage flow where
discovery output lands here for categorize + Keep/Review/Discard in Airtable, and Keep rows
are moved to Firms by hand. The skills pipeline does not read or write it; `firm-review`
triages in conversation and writes Keepers straight to Firms. Reuses the Firms field
definitions for the overlapping columns plus two triage fields. No `discovered-date` (the
Meta API cannot create Created-time fields).

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

## Provisioning

**Operators: you do not build any of this by hand.** Run `client-onboarding` — it
creates the base and every table above through the Airtable connector, then prompts you
for the single field Airtable's API cannot create (`Firms.discovered-date`, type
**Created time**). See [`getting-started.md`](./getting-started.md) Step 4.1.

For a new client, onboarding creates a **new base**. The schema is identical across
deployments — client-specific values are data, not structure.

<a id="provisioning"></a>

**Maintainers only.** `config/airtable-schema.mjs` is the single source for this schema;
it is synced verbatim into `skills/client-onboarding/table-schema.mjs`, so a schema change
belongs there and nowhere else. A repo owner can also apply the schema to an existing base
over the Airtable REST API — useful for a full field-level reconcile, which onboarding's
top-up path does not do:

```bash
cp .env.example .env.local   # fill in AIRTABLE_API_KEY + AIRTABLE_BASE_ID
npm run setup:airtable                          # basic shape
npm run setup:airtable -- --variant with-review  # adds the Review table
```

The token needs `schema.bases:read`, `schema.bases:write`, and `data.records:write`, **and**
the target base explicitly added under **Access** — the scopes alone are not enough. This
path is not part of the operator run flow; it writes to whatever base `AIRTABLE_BASE_ID`
points at, so double-check it before running.
