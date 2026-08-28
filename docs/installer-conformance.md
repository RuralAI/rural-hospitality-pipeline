# Installer conformance record

> **Who this is for:** maintainers. This is the honest ledger against
> [docs/installer-standard.md](installer-standard.md): where `client-onboarding`
> actually stands today, not where the standard says it should be.

**As of:** 2026-08-27, against installer-standard.md and `client-onboarding` at
`2.0.0` (deployment-stamp and Step 0 degrade-check work done same day, ahead of the
next version bump). Update this file's date whenever a gap below is closed or a new
one is found; do not let it go stale silently.

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 1 | One installer, one invocation | **Met** | `client-onboarding` is the sole provisioner. `firm-review`, `contact-extraction`, `email-generation`, and `voice-intake` each stop and name `client-onboarding` when a prerequisite is missing, rather than creating anything themselves. |
| 2 | The seed document | **Met** | `skills/client-onboarding/worksheet-template.md` is bundled inside the installer's own folder and read at runtime; live interview is the stated default when no worksheet is attached. Filename differs from the standard's example name; that is not part of the requirement. |
| 3 | The deployment stamp | **Met** (2026-08-27) | `installer-version` added to `config/airtable-schema.mjs`'s Config table. `client-onboarding` Step 0 now routes Fresh / Reconcile / Upgrade off it, including the pre-stamp case: an existing base with the field missing or blank is backfilled with the literal `unknown (pre-stamp install)` and treated as Reconcile, never as Fresh. Written additively: only this field, only in Config, existing rows never cleared. |
| 4 | Three modes, explicitly routed | **Gap** | The routing decision (Fresh/Reconcile/Upgrade) now exists per #3, but the *behavior* is still identical across Reconcile and Upgrade (both just run the existing additive top-up in step 6). What it would take: differentiate what Upgrade actually does beyond top-up. |
| 5 | Data-safety rules during upgrade | **Gap** | Unchanged. Today's top-up is additive-only in spirit (never recreates or duplicates a table), which covers Reconcile informally, but the select-option-deletion guard, the no-auto-remap rule, and rename-triggers-full-regeneration still have no home. Blocked on #4 existing as a real mode. |
| 6 | Degrade usefully, Step 0 | **Met** (2026-08-27) | Step 0 now opens with a capability check (schema file present / code execution / Airtable connector and scope) and names a fallback or a stop-and-tell-the-operator action for each, on the pattern `firm-discovery` already used. |
| 7 | Set expectations before doing work | **Gap** | `client-onboarding` does not state duration, usage cost, or what will exist before it starts asking questions. What it would take: a few sentences before Step 0, then wait for a go-ahead. |
| 8 | Verify, and report each check | **Gap** | The skill ends at Step 3 with a handoff to `voice-intake`, but does not verify or report on what it actually provisioned first. What it would take: a short end-of-run checklist (tables present, single-row upsert didn't duplicate, link fields resolve) before the handoff line. |
| 9 | Packaging constraints | **Met** | Enforced by `.github/workflows/checks.yml` (check 5) and documented in `CONTRIBUTING.md`, "Packaging limits." |

**Score: 5 met, 4 gap, 0 deliberately-not, of 9.**

## Priority, not a flat list

The remaining gaps are not independent. Ranked by what unblocks what:

1. **#4 and #5, three-mode routing and upgrade data-safety rules.** Real work.
   #3 no longer blocks them (the stamp and the routing decision exist); what is
   missing now is differentiated behavior once a run is routed to Upgrade.
2. **#7 and #8, expectation-setting and verify-and-report.** Cheap prose additions
   with real operator value. Do whenever `client-onboarding`'s `SKILL.md` is next
   open for editing.
