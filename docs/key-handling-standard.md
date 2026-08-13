# Key-Handling Standard

> **Who this is for:** maintainers, as the decision record behind the key rules.
> **Operators need the practical version instead** — the "Where keys go" and "Key
> safety" notes in [`pre-flight-checklist.md`](pre-flight-checklist.md) section 4.

**Center for Rural AI · Market Segmentation & Outreach Pipeline**
Decision owner: Amy · Decided: 2026-07-11 · Applies to: Skills-delivered pipeline (claude.ai)

## Purpose

The Skills pipeline needs the operator to supply service API keys for discovery and enrichment. There is no native secret store on the claude.ai chat surface, and every handling method routes the key through model context regardless. The only meaningful difference between methods is persistence at rest and who else can see the value. This standard sets the documented default.

## Decision

Allow plaintext storage in a private Airtable base only for low-stakes, spend-capped, rotatable service keys. Draw a hard line prohibiting everything else.

The single merit being bought is set-once persistence: the operator enters the key once, and every future session reads it without re-pasting. That directly serves the low-tech operator profile the pipeline targets.

## Allowed keys

| Key | Exposure on leak | Notes |
|-----|-----------------|-------|
| Serper | Wasted search credits | Single-purpose search API. Lowest risk. |
| Hunter | Wasted enrichment searches (free: 25/month) | Enrichment only. Rotatable in one click. |
| Apollo | Enrichment credits (free: 75/month) and potentially more | See caveat below. Include, but treat rotate-on-exposure as mandatory, not optional. |

### Apollo caveat

Apollo API keys are account-scoped, not single-purpose. On free/enrichment-only use (Alex's case) the exposure is burned credits, same tier as Serper and Hunter. But the same key authenticates to the whole Apollo account, so a future user on a paid plan with a populated Apollo workspace could expose their contact/account database and sequences, not just credits. The low-stakes framing holds for free-tier enrichment use; it does not automatically extend to a paid Apollo workspace.

(This access-scope point is reasoned from general knowledge of Apollo's API, not an audit. Verify before a paid-plan user stores an Apollo key this way.)

## Prohibited

Never store any of the following in an Airtable cell, under any circumstance:

- Passwords
- OAuth tokens
- Mail / IMAP credentials or app passwords
- Payment methods or billing credentials
- Any key that grants broad account access or the ability to move money

If a credential does not sit clearly inside the "spend-capped, rotatable, limited-blast-radius" tier, it does not go in Airtable. When in doubt, it is prohibited.

## Guardrails

1. One labeled location. Keys live in a single, clearly labeled place in the base, not scattered across cells, so they are findable and clearable in one action. (Exact shape decided in S3, base provisioning.)
2. Private base assumed. This standard is valid only while the base is not shared publicly, shared with untrusted collaborators, or exported. Document this assumption for every operator.
3. Rotate on exposure. If the base is ever shared, exported, or screenshotted, regenerate the key. All three providers support instant regeneration. This guardrail carries the most weight for Apollo.
4. Support access is key-visible. Any CRAI staff granted collaborator access to an operator's base will see stored keys. (Open question, below.)

## Open questions

- Storage shape (couples to S3). Dedicated single-row Config table (labeled fields, isolated from pipeline data, one place to clear) vs a cell on an existing table. Leaning Config table. Resolve during S3 base provisioning.
- Support access model. Decide whether CRAI support access to an operator base is acceptable as-is (staff see keys) or whether support should be granted only to a key-free view.

## What this standard is not

It is not a claim that plaintext-in-a-database is secure. It is a deliberate trade: set-once convenience for the least technical operators, bounded to keys whose worst-case leak is a rotatable inconvenience, with a bright line stopping the pattern from spreading to credentials where it would be genuinely dangerous.
