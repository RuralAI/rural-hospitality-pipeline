---
name: corporate-research
description: >
  Guides structured research into the corporate retreat planning landscape to
  determine who books retreats, whether planning is in-house or outsourced, and
  what decision-maker profiles to target. Use this skill whenever the user is
  researching corporate planners, trying to understand who books retreats at
  companies, mapping out the corporate segment, or asking questions like "who
  should we be targeting?", "how do companies plan retreats?", or "is this
  in-house or outsourced?". Also trigger when the user is preparing to build
  the corporate planner discovery pipeline.
compatibility: Airtable connector required (reads Business Profile and Region Naming, writes Corporate Research).
---

# Corporate Research Skill

The corporate segment has a structural unknown that must be resolved before building
a discovery pipeline: **who actually books corporate retreats?** This skill guides
the research needed to answer that question, then writes the decision-maker profiles
it produces to the client's Airtable **Corporate Research** table.

Runs in Claude Desktop. It reads the client's facts from Airtable (Business Profile
and Region Naming) so the research is framed around the actual property and target
markets, not any one client's numbers. It writes its structured output back to
Airtable. Nothing is written to the repo.

## The Core Question

For any given company, retreat planning could sit with:

- An **internal employee** — HR director, office manager, executive assistant, operations lead
- An **external agency** — a corporate event planning firm hired for this purpose
- A **hybrid** — internal owner who outsources execution to an agency

The answer likely varies by company size, industry, and culture. The goal of this
research phase is to identify which profile is most common in the target markets and
most reachable for the client's capacity.

## Step 0: read the client's facts from Airtable

Before any research, read the **Business Profile** table (single row) via the
connector. If the table is empty, stop and tell the operator to run the
`client-onboarding` skill first.

Pull these fields and use them in place of any hardcoded values below:

- `capacity` — the group size the property serves (e.g. "16-21 guests, full-property
  buyout"). This defines what company sizes are realistic.
- `location` and `destination-airport-code` / `destination-airport-name` — where the
  property is and how groups fly in, i.e. what "within reach" means.
- `target-region-ids` — the markets to research (one region_id per line).
- `highlights` / `corporate-highlights` — what makes the property appealing vs. a
  hotel or resort.
- `segments` — confirm "Corporate" is one of them. If it is not, tell the operator
  this research only applies to clients running the corporate segment.

Then read the **Region Naming** table to translate each `target-region-id` into its
`anchor-city` (the main city to research from) plus its `aliases`. Research each
region by its anchor city. If a region_id has no Region Naming row, ask the operator
for its main city rather than guessing.

If `capacity` or `target-region-ids` is blank, do not invent values: research what
you can and note the gap in the findings.

---

## Research Framework

Work through these questions in order. Don't skip to sourcing until the framing
questions are answered. All specifics come from Step 0, not from any example below.

### Step 1 — Frame the Target

Answer these before looking at any specific companies or planners:

1. **What company sizes are realistic for this property?**
   - Read `capacity`. A small full-property capacity suggests small teams, not
     enterprise all-hands: leadership offsites, sales kickoffs, product retreats.
   - Translate capacity into a headcount band (e.g. a 16-21 guest property maps to
     companies of roughly 20-150 employees, or specific teams within larger ones).

2. **What industries are most likely to book a retreat here?**
   - Culture fit for the property and its `location` / `highlights` (e.g. an
     outdoor-oriented property fits tech, creative agencies, outdoor brands,
     nonprofits).
   - Within reasonable travel of the target markets (see `destination-airport-*`).
   - Has a travel budget (not bootstrapped startups).

3. **What makes this property appealing vs. a hotel or resort?**
   - Draw directly from `highlights` / `corporate-highlights`
     (e.g. full-property exclusivity, intimate scale, character and location).

### Step 2 — Map the Planner Landscape

For each target market (each region's anchor city from Step 0), research:

**In-house planning signals:**
- What titles at small-to-mid companies typically own retreat logistics?
- Are there LinkedIn job posts or profiles that mention "retreat planning" or "offsite coordination"?
- What does an EA or office manager job description say about event responsibilities?

**Third-party agency signals:**
- Are there corporate event planning firms in these cities that specialize in offsites or retreats?
- Do any agencies specifically mention small-group or leadership retreat work?
- Are there concierge or travel management companies that book corporate travel including lodging?

### Step 3 — Identify Decision-Maker Profiles

For each planning type found, define a decision-maker profile. Each profile becomes
one row in the Corporate Research table (Step 4):

```
Type: [In-house / Agency / Hybrid]
Title(s): [e.g. "Executive Assistant", "Head of People", "Corporate Event Planner"]
Company size: [e.g. "50–200 employees"]
Industry signals: [e.g. "tech, creative, outdoor brands"]
How they find venues: [e.g. "Google search", "referral", "venue directories"]
What matters to them: [e.g. "exclusivity, logistics simplicity, outdoor access"]
Sourcing path: [where to find them — see Step 4]
```

### Step 4 — Sourcing Strategy

Once decision-maker profiles are defined, identify where to find them. Capture this
as the `sourcing-path` for each profile:

- **LinkedIn** — title + location search for in-house planners
- **Agency directories** — ILEA, PCMA (Professional Convention Management Association), SPIN (Special Events Network)
- **Google Maps** — "corporate event planning [city]", "retreat planning [city]"
- **Industry associations** — local chamber of commerce, HR association chapters

---

## Output: write findings to the Corporate Research table

When the research is complete, write the decision-maker profiles to the client's
Airtable **Corporate Research** table (provisioned by `client-onboarding`). Write
one row per profile:

- `profile-label` — a short descriptor, e.g. "In-house EA, tech, 50-200"
- `planner-type` — In-house / Agency / Hybrid
- `titles` — the target title(s), one per line
- `company-size` — the headcount band
- `industry-signals` — the industries that fit
- `how-they-find-venues` — how this profile discovers venues
- `what-matters` — what this profile cares about when choosing a venue
- `sourcing-path` — where and how to find this profile (from Step 4)
- `notes` — anything profile-specific worth carrying forward: open questions, the
  in-house-vs-third-party reasoning that applies to this profile, confidence level
- `updated-at` — today's date

Upsert on `profile-label`: if a row with the same label exists, update it; never
duplicate. Writes require ids, not names — use the Corporate Research table id
(`tbl...`) and field ids (`fld...`). If `list_tables_for_base` is unreliable, ask
the operator to open the Corporate Research table in Airtable and paste the URL; the
`tbl` id is in it.

If the base has no Corporate Research table, the client was onboarded without the
corporate segment — tell the operator to re-run `client-onboarding` with Corporate
included (it provisions the table), then write the rows.

House style: no em dashes in any value you write.

### Also present a landscape summary in chat

The per-profile rows are the durable, reusable artifact. Alongside writing them,
present a short landscape summary to the operator in the conversation, so the
human-readable narrative is captured too:

```
## Corporate Planner Landscape — [today's date] — [client]

### Finding: In-house vs. Third-party
[1–2 paragraphs on what the research revealed for this client's markets]

### Primary Decision-Maker Profile(s)
[Table: type, title, company size, industry, sourcing path — matches the rows written]

### Recommended Discovery Approach for Stage 01
[Where to find them, what to search for, what to filter by]

### Open Questions Remaining
[Anything still unclear that would block building the pipeline]
```

---

## Notes for Future Iterations

- This skill is a research guide, not a data collection tool. Once the structural
  question is answered, the profiles feed directly into Stage 01 of the corporate
  pipeline when it is built.
- The corporate segment may end up splitting into two sub-pipelines (in-house and
  agency) with different discovery sources and prompt templates.
- Update this skill once the first real corporate outreach data comes in — the
  response patterns will reveal whether the targeting assumptions were correct.
