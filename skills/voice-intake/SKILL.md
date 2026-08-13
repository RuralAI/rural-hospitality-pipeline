---
name: voice-intake
description: >
  Captures how a client contact writes, then drafts and saves their approved
  outreach email copy. Use when setting up a voice profile, capturing how someone
  writes, drafting email templates for a new client, or preparing for email
  generation. Also trigger for "set up the voice", "capture how they write", or
  "draft the outreach emails".
compatibility: Requires the Airtable connector (reads Business Profile, writes Email Templates) and code execution with file creation (writes a downloadable draft file for review).
---

# Voice Intake Skill

**Version:** 1.0.0 · Center for Rural AI

A short interview to capture how the client contact communicates, followed by a
drafting step that turns that voice into approved outreach email copy saved to
the Email Templates table. Run `client-onboarding` first - this skill reads
Business Profile and expects the positioning notes onboarding gathered.

The captured voice is used in the moment to draft copy; it is not saved to a
file anywhere long-term. The one exception is the working draft file written
during Step 2 (see below) - a review aid, not a data store. What persists is
the approved Email Templates rows.

## Step 0: Read Business Profile

Read the Business Profile table (single row) via the connector. If it is empty,
stop and tell the operator to run `client-onboarding` first. You will use the
business name, location, capacity, highlights, and the segments the client runs
as drafting input.

## Step 1: Voice interview

Work through these conversationally - one or two at a time, following up on
interesting answers. The goal is to understand the real person, not fill a form.

These questions are the source of truth for the interview. `docs/onboarding/
voice-worksheet.md` mirrors them as an optional client prep aid, but this skill
does not read that file - if the operator has a filled-in worksheet, use its
answers, otherwise just ask. Keep the two in sync by hand if you edit these.

1. **How does this person come across?** Formal or casual? Straight to the point
   or warm up first? Do they use humor?
2. **What would feel wrong in an email written on their behalf?** Too salesy?
   Corporate jargon? Over-the-top phrases?
3. **How do they sign off?** Capture the closing wording they would actually use
   ("Warmly," "Best," "Cheers,"). This is the `sign-off` line and can differ by
   segment. (The name/address/phone under it come from Business Profile, set
   during onboarding - not asked here.)
4. **Do you have examples of how they actually write?** A real email, message, or
   text. If not, you will draft together and refine.
5. **Anything else?** Topics they care about, or their relationship to the
   business, that should color the writing.

## Step 2: Draft the email templates

For each segment the client runs (from Business Profile `segments`), draft a
complete outreach email using: the captured voice, the Business Profile facts,
and the positioning notes from onboarding (primary goal, ideal customer, what to
emphasize, what to steer away from).

**Corporate needs two drafts, not one.** The segment reaches two different
readers, and one template cannot serve both:

- **Agency** (the default): an event planning firm that places other companies'
  groups. Retreats are its business, so copy may refer to the reader's work
  planning them, and the `{{firm}}` lead-in belongs here.
- **In-house**: the HR director, Chief of Staff, or office manager who organises
  their own company's offsite, reached through the Apollo path. They do not plan
  events for a living. Copy that praises their event-planning business reads as a
  mistake and gets deleted, so this draft must **not** use `{{firm}}` and should
  speak to their team and their next offsite.

Draft both whenever Corporate is in scope. Wedding has one audience, Agency, so it
gets one draft. Present them as separate drafts for separate approval, since the
operator may be happy with one and not the other.

Each draft has: a `subject`, a `body`, and the `sign-off` closing wording from
Step 1. Write the body so the pipeline's two runtime tokens still work - the
per-region travel line and the firm lead-in are inserted by `email-generation`;
keep the body's wording compatible with a sentence about travel and a mention of
the firm. Do not paste a specific firm name or a specific travel claim into the
template.

House style: no em dashes anywhere in the copy. Avoid "world-class",
"unparalleled", or anything that reads like a hotel chain unless the contact
actually talks that way.

Show each draft to the operator. Refine until they approve it. Draft Wedding and
Corporate separately - a Corporate email must not address "couples".

**Also write the draft(s) to a downloadable file**, not just chat. A wall of
chat text is hard to review, and often the operator isn't the one approving -
they're relaying the draft to the client contact (e.g. Alex), who is
reading it without any of this conversation's context. After each draft or
revision, write (overwrite) `email-template-drafts.md` in the working
directory with the current state of every segment drafted so far:

```markdown
# Email Template Drafts

## Wedding

**Subject:** ...

**Body:**

...body text, paragraphs as they'll actually render...

**Sign-off:** Warmly,

---

## Corporate

**Subject:** ...
...
```

Tell the operator the file is ready to download and share with the client
contact for review - that's the point of it, not just an inline echo of the
chat. Keep it current: every time a draft changes, rewrite the whole file
rather than appending, so it never shows a stale version alongside a fresh one.
This file is a review aid only, not a record - Step 3 still writes the actual
approved copy to Email Templates, and nothing reads this file back.

## Step 3: Write approved copy to Email Templates

For each approved draft, write one Email Templates row: `subject`, `segment`,
`audience`, `body`, `sign-off`, and `updated-at` (today's date). Upsert per
segment **and audience**: read the table first; if a row with that same segment and
audience exists, update it; otherwise create one. Never duplicate a pair.

`audience` is "Agency" or "In-house" and is what `email-generation` matches a
contact against. A Corporate client therefore ends with two rows, both
`segment: "Corporate"`, one per audience. Leaving `audience` blank is read as
"Agency", so never leave it blank on an in-house draft: the row would overwrite the
agency template and in-house contacts would then fail to generate at all.

Writes require ids, not names: use the Email Templates table id (`tbl...`) and
field ids (`fld...`). If `list_tables_for_base` is unreliable, ask the operator
to open the Email Templates table in Airtable and paste the URL.

## What this skill does NOT do

- It does not write any repo file. The voice is consumed in the moment; only the
  approved Email Templates rows persist.
- It does not generate or send emails - that is `email-generation`, which reads
  the Email Templates rows this skill wrote.
