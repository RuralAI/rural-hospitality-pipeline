# The CRAI installer standard

**Center for Rural AI pilot standard**

> **Who this is for:** maintainers building or changing this pilot's installer
> (`client-onboarding`). **Operators can skip this.** Your equivalent is
> [getting-started.md](getting-started.md).

Every CRAI pilot installs the same way, because the people installing them are not
developers and should not have to learn a new shape each time. This document is the
required behavior. It is generalized from the `grant-assistant` pilot, which developed
most of it across two live installs, plus two lessons from the other two pilots.

A pilot may add steps. It may not skip one of these.

**This repo's current standing against this standard is tracked separately, in
[docs/installer-conformance.md](installer-conformance.md).** Read that alongside
this file: this document is the target, the conformance record is where
`client-onboarding` actually stands against it today.

---

## 1. One installer, one invocation

A pilot ships exactly one installer skill. It is the only skill that provisions
anything. Operating skills that find no base **stop and name the installer**; they
never create a table themselves.

The install is one invocation, in one sitting, from one attached document.

---

## 2. The seed document

The customer fills out a blank template before the install, offline, at their own pace.
The installer reads it as attached context.

Requirements for the template:

- Lives inside the installer skill's own folder, and nowhere else. Operators are
  linked to that same path. In this repo that file is
  `skills/client-onboarding/worksheet-template.md`; the requirement is the location
  and the bundling, not the exact filename.
- Every field carries **instructions and a real worked example**, not just a label.
- Required fields are marked **★**, and the installer **halts and asks** rather than
  guessing when one is blank.
- It opens with a warning about what must not be put in it.
- It ends with a pre-flight checklist the customer ticks themselves.

**The template lives inside the skill folder so it is bundled into the `.skill`**, and
the installer reads it at runtime. This is not optional, and it is worth stating why:
an earlier CRAI pilot's onboarding skill pointed at a repo path that was never bundled
into the `.skill`, so at runtime the file did not exist and the skill spent its opening
message explaining a missing file instead of starting the interview. A repo path is not
a runtime path.

Keep it as **one file in one place**. The obvious-looking alternative, a copy at the
repo root for operators to download plus a bundled copy for the skill, is how the
`grant-assistant` pilot ended up with two seed templates that its own CONTRIBUTING
warns can fork. Link operators to the file inside the skill folder instead.

**Interviewing live is the default fallback.** Never require the document. An operator
who arrives without one gets interviewed from the same questions.

---

## 3. The deployment stamp

The installer writes `Installer Version` into the customer's `Config` table, and
updates it on every upgrade.

The semantics matter and are easy to get wrong:

- **The absence of the field from the schema** is the signal that a base predates
  versioning. Not a blank value.
- **A blank value in a field that exists** means an install failed partway. Say so out
  loud rather than treating it as a fresh base.
- Never repurpose the field for anything else.

This is what makes a *deployment* self-describing rather than only the artifact. An
operator can reinstall a skill without re-running the installer, so the skill stamp and
the base can legitimately disagree; you need both numbers to debug anything.

---

## 4. Three modes, explicitly routed

Preconditions route the run to exactly one of three outcomes, decided before any work
begins:

| Found | Mode |
| --- | --- |
| No base | Fresh install |
| Base at the current version | Reconcile |
| Base at an older version, or with no `Installer Version` field | Upgrade |

**The hard rule: finding an existing base never triggers an upgrade on its own.** Only
a direct request from the operator does. A routine reconcile run against an older base
reports what it found and stops.

This rule exists because an upgrade can regenerate skills and change select options,
and an operator who asked for a routine check did not consent to that.

**Reconcile is additive only.** Add missing tables, fields, and options. Never delete,
never rename, never change a type. Report drift rather than correcting it.

---

## 5. Data-safety rules during upgrade

Non-negotiable, all three learned from live installs:

1. **Never delete a select option that live records still use.** Check for rows using
   it, list them, and let the operator re-file them first.
2. **Never auto-map old values onto a new option set.** If four statuses became eight,
   the mapping is not knowable from the data; every one would be a guess. Report and
   let the operator decide.
3. **A rename means regenerate every skill, not only the new ones.** Airtable preserves
   table and field IDs through a rename so no data moves, but skills resolve fields by
   **name**, so a rename silently breaks skills that were otherwise untouched.

State in the changelog when an upgrade run does more than add things. A departure from
additive-only behavior is exactly the kind of thing an operator needs warned about.

---

## 6. Degrade usefully, and never stop empty-handed

From the `rural-hospitality-seo-blog` pilot, after a user report: the installer stopped
at its first step in an environment where only `SKILL.md` had been installed.

Every installer opens with a **Step 0** that checks what it can actually reach, then
routes. Three outcomes, in decreasing order of capability:

| What is available | What to do |
| --- | --- |
| Schema file and code execution | Execute the schema file. Normal path. |
| Schema file, no code execution | **Read the schema file as text** and provision from the field definitions in it |
| No schema file | Stop, and tell the operator to re-upload the `.skill` file from the latest release and start a new conversation |

The middle row is why the schema file is written to stay readable: a plain data
structure with real field names, not generated or minified. It has to work when it
is being read rather than run.

Two rules for Step 0:

- **Never guess field names.** Operating skills resolve fields by name, so a guessed
  name produces a base that looks finished and fails silently on the first write.
  That is worse than not provisioning at all.
- **Never substitute another skill's script.** A different pilot's provisioning script
  builds an unrelated base. If the file does not match what this skill expects, treat
  it as missing.

**Stopping is permitted in the last row, and only because the operator is handed a
specific next action.** The original failure this rule was written against was an
installer that halted with nothing to do about it. "Do not stop" was the wrong lesson
drawn from it: the right one is *do not leave the operator without a next step*.

**Do not add a prose field reference to `SKILL.md` as a further fallback.** An earlier
version of this standard required one. It is a second copy of the schema that drifts
from the first, and a stale field reference is worse than none because it is trusted.
One schema file, read two ways.

---

## 7. Set expectations before doing work

Before provisioning anything, the installer states:

- roughly how long this takes
- that it uses a meaningful share of a day's Claude usage, so it is best started fresh
- what will exist when it finishes
- that the operator stays in charge: the system finds and recommends, a person decides

Then it waits for a go-ahead. Never begin on an ambiguous answer.

Say this in practical terms. Raw token counts mean nothing to a nonprofit director;
"a good portion of a day's usage on a Pro plan" does.

---

## 8. Verify, and report each check

The installer does not report success until it has confirmed, and reported
individually:

1. Every table exists with the expected fields.
2. Every linked-record field resolves in both directions.
3. `Config` has one row with `Installer Version` populated.
4. A test write succeeds, then is removed.
5. Any write gate actually gates.
6. Every operating skill is present and readable.

Then it names the specific next skill to invoke. An install that ends without telling
the operator what to do next is not finished.

---

## 9. Packaging constraints

Both hit in practice on earlier pilots:

- Frontmatter descriptions have a length ceiling (1024 characters; see
  `CONTRIBUTING.md`, "Packaging limits", which states this repo's own CI-verified
  number).
- **No angle brackets in frontmatter.** Use `your-org-slug` style placeholders, not
  bracketed ones.

CI checks both on every pull request. See `CONTRIBUTING.md`, "Packaging limits".
