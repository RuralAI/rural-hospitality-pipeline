---
name: firm-review
description: >
  Chat-assisted Keep/Review/Discard triage of discovered firms before they are
  saved. Categorizes each firm (planner, venue, vendor, unclear), assesses
  planner quality, and writes only the Keepers to the Airtable Firms table. Use
  after discovery, when reviewing a firm list, cleaning up results, deciding
  which firms to keep, categorizing firms, or running the review step.
compatibility: Airtable connector required (reads Business Profile, writes Firms).
---

# Firm Review (Keep / Review / Discard)

**Version:** 2.0.0 · Center for Rural AI

Option A review: triage happens in chat, and only Keepers are written to Firms.
No review table, no extra Airtable layer. Evaluate in two steps: categorize
first, then assess quality.

**Input:** the JSON produced by `firm-discovery` (that skill returns records but
does not write them). **This skill is the sole writer to the Firms table** —
discovery never writes there, so Keepers written here are the only Firms rows
created. That division is what prevents non-planners and duplicate keepers from
landing in Firms.

## Step 0: read Business Profile

Read the Business Profile table (single row) via the connector before
reviewing any firm. If the table is empty, stop and tell the operator to run
the `client-onboarding` skill first. Use `target-region-ids` and `capacity`
from this record in place of the hardcoded values below. A blank `capacity`
or `target-region-ids` field is not a hard stop — just skip the criterion
that depends on it (see Criteria).

## Step 1: categorize the business type

Identify what kind of business this is before any quality judgment. Venues and
vendors are not disqualified (they may be useful referral sources), just labeled.

| Category | Label | Examples |
|----------|-------|----------|
| Planner | the target | Wedding planner, event planner, coordinator |
| Venue | the place, not the planner | Ranch, estate, barn, inn |
| Vendor | service provider | Photographer, florist, caterer, DJ |
| Unclear | needs more research | Ambiguous |

Only Planners and Unclear move to Step 2. Venues and Vendors get a label and a
note, no quality verdict.

## Step 2: quality assessment (Planners and Unclear only)

- Keep: meets quality signals, worth moving to contact extraction.
- Review: has gaps worth investigating first.
- Discard: clearly unsuitable (inactive, duplicate, wrong fit).

## Criteria

Geography is a preference, not a hard filter. Primary metros come from Business
Profile's `target-region-ids`, translated to their display names via
`region-naming.js` (e.g. `north_valley` -> "the North Valley"). Firms in other
cities are valid for exploratory research: do not discard on geography alone.
If `target-region-ids` is blank, skip the geography criterion entirely rather
than guessing at metros.

Required fields (missing any is Review at minimum): firm name, city/location,
segment.

A missing website is a Review signal, not a Discard, especially for rural or
small-town businesses that are bookable by phone, social, or referral. Note it,
flag for manual follow-up.

Positive signals (toward Keep): active website updated in the last 12 months;
mentions destination, mountain, or relevant regional weddings; portfolio scale
compatible with Business Profile's `capacity` (skip this signal if `capacity`
is blank); listed in a professional directory; high rating with 10 or more
reviews.

Negative signals (toward Review or Discard): website stale 2 or more years;
portfolio scale clearly incompatible with `capacity` (e.g. only large-scale
weddings when `capacity` names a small property; skip if `capacity` is blank);
venue-exclusive, not an independent planner; no individual name findable
anywhere; duplicate of a record already in the list.

Corporate planners: flag as Review unless the firm explicitly offers corporate
retreat/offsite planning and there is a named individual with a relevant title.

## Step 3: write Keepers to Firms via the connector

Only records marked Keep. Dedup on the normalized firm-name against existing
Firms rows before writing. Append `. Audit: <reason>` to the `notes` field.

Set `audience` to **"Agency"** on every row you write. Everything reaching this
skill came from a Maps search, so it is a firm that places other people's groups,
which is what the segment's normal template is written for. The other value,
"In-house", belongs to employers booking for their own team and is written only by
`corporate-research`'s Apollo step.

Note: the normalized-name match strips only corporate suffixes (LLC, Inc, Co,
Company, ...), not descriptive words like "Events"/"Weddings" — that's a
deliberate choice to avoid falsely merging two distinct firms. So this step is
the safety net for the rarer near-duplicate it won't auto-catch (e.g. "Muse
Events" already in Firms as "Muse"): eyeball the list and don't Keep an obvious
restatement of a firm already saved.

Writes require ids, not names. Use the Firms table id (`tbl...`) and field ids
(`fld...`). If `list_tables_for_base` is unreliable, ask the operator to open the
Firms table in Airtable and paste the URL: the `tbl` id is in it.

## Output format

Single record:

```
Firm: [name]
Category: Planner / Venue / Vendor / Unclear
Verdict: Keep / Review / Discard   (skip if Venue or Vendor)
Reason: [1 to 2 sentences]
Action: [what to do next]
```

Batch: report in this order, and keep the prose short — the operator is here to
make decisions, not to read an essay.

1. **One line of counts.** Total reviewed, counts by category, counts by verdict.
2. **Keepers: one line.** How many were written to Firms. Do not list them all;
   they are in Airtable now and the operator can look. Name only near-duplicates
   you deliberately did not write, if any.
3. **Reviews: a numbered decision table.** This is the part the operator acts on,
   so it comes last and gets the most care. One row per Review, in this shape:

   | # | Firm | Why it's held | Look here | Suggested |
   | --- | --- | --- | --- | --- |
   | 1 | Jennifer Lane Events | No website found | [search](https://www.google.com/maps/search/?api=1&query=Jennifer+Lane+Events+Denver+CO) | Keep, follow up by phone |
   | 2 | Birch and Honey Collective | Missing city-metro | [birchandhoney.example](https://birchandhoney.example) | Keep if Denver metro |

   Rules for the table:
   - **Every row gets a link.** Use the firm's website when discovery found one.
     When it did not, build a Maps search link:
     `https://www.google.com/maps/search/?api=1&query=<firm name + city, URL-encoded>`.
     The operator should never have to retype a name into Google themselves.
   - **"Why it's held" is one short phrase**, not a sentence. "No website",
     "Missing city-metro", "Site says film and commercial work now".
   - **"Suggested" is your actual recommendation**, so answering is one word for
     most rows. Do not write "needs research" — you have already done the research.
4. **Then ask for the decisions in one prompt:** invite them to reply with row
   numbers, e.g. "keep 1 and 4, discard 2, skip the rest." Apply their answer,
   write the Keeps to Firms the same way as Step 3, and confirm what was written.

**Never end your turn with Reviews unresolved and unmentioned.** They live only in
this conversation — nothing about them is saved. If the operator leaves them
undecided, say plainly that they will be lost when the session ends and that
re-running discovery for that city is what recovers them.

If a Review's only gap is a missing `city-metro` or zip that you can determine
confidently from the firm's own site or its Maps listing, fill it in and say you
did rather than holding the row for that alone. Hold on judgment calls, not on
data you can look up.
