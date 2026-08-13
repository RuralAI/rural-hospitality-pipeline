---
name: client-onboarding
description: >
  Onboards a new business onto the pipeline: provisions its Airtable base,
  captures its facts and goals, and writes them to Airtable (Business Profile,
  Region Travel). Use when setting up a new client/deployment, running the
  onboarding worksheet, or the user says "onboard a new client", "set up a new
  business", or "fill in the intake".
compatibility: Requires code execution and the Airtable connector (creates tables; writes Business Profile and Region Travel).
---

# Client Onboarding Skill

**Version:** 2.0.0 · Center for Rural AI

Turns a completed onboarding worksheet (or a live interview) into a ready-to-run
Airtable base: it provisions the tables, writes the single-row Business Profile,
and writes approved Region Travel sentences. The worksheet questions are in
`worksheet-template.md`, bundled alongside this file: read it and work through its
sections in order. Most operators have not filled it in beforehand, so interview
them live rather than asking them to go find it. If they do paste in a completed
worksheet, take the answers from that instead of re-asking. Voice and email copy
are captured separately by the `voice-intake` skill (see the handoff at the end).

Nothing is written to the repo. Everything this skill produces lives in the
client's own Airtable base, read at runtime by the four pipeline skills.

## Step 0: Provision the Airtable base

The pipeline needs eight tables: Firms, Contacts, Outreach, Email Templates,
Region Travel, Region Naming, Config, Business Profile. Clients running the
Corporate segment get a ninth, Corporate Research (written by the
`corporate-research` skill) - `plan-tables.mjs` includes it automatically when
Corporate is one of the segments, so nothing extra to do here. Do not ask the
operator to pre-create a base or any tables by hand - `create_table` into a
manually-created empty base proved unreliable through the connector. Create the
base yourself with `create_base`, which makes the base and all its tables and
(non-link) fields in one call.

1. Ask which segments the client runs (Wedding, Corporate, or both) - this is
   Section 1 anyway and the segment fields need it.
2. Get the authoritative plan. In code execution, run:

   ```bash
   node plan-tables.mjs --segments Wedding,Corporate
   ```

   (substitute the client's actual segments). It prints `{ order, tables }` -
   the exact tables and fields to create, in dependency order. Two field kinds
   need special handling below: the first field of each table is its primary
   (always a text type), and any field carrying a `linkTo` key is a link to
   another table.

3. **Decide fresh vs. existing base.** If the operator already has a base for
   this client from a previous run, get its base id (`app...`, from the base
   URL) and go to step 6 (top-up). Otherwise create it fresh (steps 4-5). Never
   create a second base for a client that already has one.

4. **Create the base (fresh run).** Ask which workspace to create it in
   (`list_workspaces` if the operator is unsure; a workspace id is `wsp...`).
   Call `create_base` with that `workspaceId`, a name (e.g.
   `<Business> Outreach Pipeline`), and a `tables` array built from the plan -
   but **omit every field that has a `linkTo`** from the `tables` payload.
   `create_base` cannot create a link field, because a `multipleRecordLinks`
   field requires a `linkedTableId` and none of the tables have ids until the
   base exists. Everything else (text, url, email, select, multi-select,
   checkbox, date) is created in this one call.

5. **Add the link fields (fresh run).** After `create_base`, get each table's id
   (from the `create_base` response, or `list_tables_for_base` on the new base).
   For each `linkTo` field in the plan, call `create_field` on its table with
   `{ type: "multipleRecordLinks", options: { linkedTableId } }`, where
   `linkedTableId` is the id of the table named in `linkTo`. As of this writing
   the plan has exactly two: `Contacts.firm-id` → Firms, and
   `Outreach.contact-id` → Contacts. Then go to step 7.

6. **Top-up an existing base (re-run).** List the base's tables
   (`list_tables_for_base`). For each table in the plan that is missing, create
   it with `create_table` (its `linkTo` fields resolve to `linkedTableId` using
   the ids of tables that already exist or that you create earlier in the plan's
   `order`). For any table that exists but is missing a `linkTo` field, add it
   with `create_field` as in step 5. Never recreate or duplicate an existing
   table. (Field-level top-up beyond links is out of scope here; for a full
   schema reconcile a repo owner runs `npm run setup:airtable`.)

7. **The one manual field.** Tell the operator to add it by hand - Airtable's API
   cannot create Created-time fields: open the Firms table, add a field, choose
   "Created time", name it exactly `discovered-date`.

Re-running is safe: an existing base is topped up, not duplicated.

## Step 1: Capture business facts and write Business Profile

Work through worksheet Sections 1-2 (interview one or two questions at a time if
there is no completed worksheet). Then write a single Business Profile row.

**Single-row upsert:** read the Business Profile table first. If a row exists,
update it; otherwise create one. Never insert a second row. A redo replaces the
field values wholesale (it does not merge).

Fields (write whatever was answered; leave the rest blank - the intake is
modular and downstream skills degrade per missing field):

- `label`: `Profile`
- `business-name`, `business-url`, `location` (e.g. `Rivertown, Colorado`)
- Signature block: `signing-name`, `signature-title`, `signature-address`,
  `signature-phone`, `signature-website` - the name spelling, address, and phone
  as they should appear at the foot of an email. (The closing *wording* like
  "Warmly," is captured later by `voice-intake`, not here.)
- `capacity` (free text, e.g. `16-21 guests (full-property buyout)`)
- `destination-airport-code`, `destination-airport-name`
- `highlights`, `corporate-highlights` (one per line)
- `target-region-ids` (one region_id per line - see Step 2)
- `segments` (multi-select: the segments from Step 0)

House style: no em dashes in any value you write.

Writes require ids, not names: use the Business Profile table id (`tbl...`) and
field ids (`fld...`). If `list_tables_for_base` is unreliable, ask the operator
to open the Business Profile table in Airtable and paste the URL - the `tbl` id
is in it.

## Step 2: Region setup - write Region Naming, then research/approve/write Region Travel

Region Naming and Region Travel are two different layers, both per-client, both
written here. Region Naming is what lets email-generation's `search-market` /
`city-metro` matching resolve a contact to a region at all; Region Travel is the
human-approved copy that renders once it does. Get Region Naming wrong (or skip
it) and every contact in that region silently gets the generic no-transit-claim
fallback, even if Region Travel has an approved sentence sitting unused.

Region ids: pick a stable slug per region (e.g. `north_valley`, `coastal`).
Put the same slugs in Business Profile's `target-region-ids`. Each client's
region ids and aliases live only in that client's own Region Naming table -
there is no shared cross-client list to fall into or leak out of, so a new
client never inherits another client's regions (e.g. Example Inn's Northgate/
Junction City/Baytown/Southport never show up for a client that hasn't defined
them).

For each target region:

1. **Write the Region Naming row first.** Ask the operator for (or infer from
   the target geography) the region's anchor city - the main city contacts in
   that region are searched from or near (e.g. "Northgate" for a North Valley
   region) - and any aliases worth matching (nearby cities/suburbs a contact's
   `search-market` or `city-metro` might actually say, e.g. "Oakdale", "Fort
   Collins"). Write one Region Naming row: `region-id`, `anchor-city`,
   `aliases` (one per line, may be empty). Upsert: if a row for that region-id
   already exists, update it; never duplicate.
2. Research travel from the region's main city to the destination airport
   (from Business Profile): is there a nonstop (origin, carrier, rough
   duration, frequency)? Is a drive realistic (time, character)? Keep a source
   citation for your own confidence.
3. Draft the complete travel sentence - the exact copy that will render, on the
   pattern of the existing verified sentences (a short, plain statement of how a
   group gets there; no em dashes; no claim you could not verify). Wedding and
   Corporate sentences differ in address ("couples" vs "a team").
4. Present the drafted sentence(s) plus the facts to the operator for approval.
   Refine until approved. If they reject or skip a region, write nothing to
   Region Travel for it (email-generation will use a safe generic fallback) -
   but still write its Region Naming row if you have the anchor city, so
   matching works once travel copy is approved later.
5. On approval, write one Region Travel row per approved region+segment:
   `region-id`, `segment`, `sentence`, and `updated-at` (today's date). Upsert:
   if a row for that region+segment already exists, update it; never duplicate.

## Step 3: Positioning (captured, not stored) and handoff

Ask the Section 3 positioning questions - primary goal, ideal customer, what to
emphasize, what to steer away from. Nothing in the pipeline reads a positioning
file, so do not write one. Instead, carry these answers into the handoff: they
are the drafting input `voice-intake` uses to write on-target email copy.

Finish by telling the operator to run the `voice-intake` skill next, and pass
along the positioning notes so its template-drafting step can use them.

## What this skill does NOT do

- It does not write any `config/*` file. All output is in Airtable.
- It does not capture voice or draft email templates - that is `voice-intake`.
- It does not populate the Config table (service API keys) - the operator fills
  that single row in by hand per `docs/key-handling-standard.md`.
