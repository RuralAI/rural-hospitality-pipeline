# Voice Intake: Question Worksheet

This captures how the person signing your outreach actually writes, so the emails sound like them and not like a template. It is **platform-agnostic**: deliver it as an Airtable form, a Google Doc, or a printed worksheet, whatever suits the client. The answers feed the `voice-intake` skill, which drafts your outreach copy in this voice and saves the approved templates to the Airtable **Email Templates** table.

> **This is an optional prep aid, not a required input file.** The `voice-intake` skill asks these same questions live during its interview; filling this in first just makes that conversation faster and lets a client prepare offline. The skill does **not** read this file — it holds its own copy of the questions. So editing this worksheet will not change what the skill asks; if you want to change the interview itself, edit `skills/voice-intake/SKILL.md` Step 1.

**It's short on purpose.** The goal is to understand the real person, not fill a form. Answer conversationally; a sentence or two each is plenty. If a question doesn't fit, skip it.

**Do this when you're ready to generate emails.** If you only want a contacts list, you don't need this yet. Run it after the main onboarding worksheet (Sections 1-3), which supplies the business facts and positioning the drafts are built on.

---

## Who is signing?

The name(s) on the outreach. Emails can be signed by one person or co-signed by two. Answer the questions below for whoever's voice the emails should carry.

*(The name, title, address, and phone that appear under the sign-off come from the main onboarding worksheet, not here. This worksheet is only about how the writing sounds.)*

---

## The questions

1. **How does this person come across?** Formal or casual? Straight to the point, or do they warm up first? Do they use humor?

2. **What would feel wrong in an email written on their behalf?** Anything too salesy, corporate jargon, over-the-top phrases ("world-class", "unparalleled")? Tell us what would make you cringe to see under their name.

3. **How do they sign off?** The exact closing wording they'd actually use: "Warmly,", "Best,", "Cheers,", something else. This can differ by segment (a wedding email and a corporate email might close differently).

4. **Do you have examples of how they actually write?** A real email, message, or even a text. Paste anything you have. If not, no problem, we'll draft together and refine until it sounds right.

5. **Anything else?** Topics they care about, or their relationship to the business, that should color the writing.

---

## What happens next

We'll draft a complete outreach email for each segment you're pursuing (e.g. Wedding, Corporate), written in the voice above and grounded in the property facts and goals from your main worksheet.

You'll get the drafts as a downloadable file to review and share. We refine until you approve each one. Only then does the approved copy get saved to Airtable, ready for the email step.

**Note:** the two per-email details that change every time, the travel line for each region and the mention of the specific firm, are filled in automatically when emails are generated. The template you approve here is the surrounding voice, not those inserted specifics.

---

## Appendix: where answers go *(for the CRAI operator running voice-intake)*

| Question | Feeds |
|---|---|
| Q1 How they come across (tone) | Drafting input to `voice-intake` (used in the moment; not persisted on its own) |
| Q2 What would feel wrong | Drafting input: negative constraints on tone/phrasing |
| Q3 Sign-off wording | Email Templates row → `sign-off` (per segment) |
| Q4 Real writing samples | Style anchor for drafting (not stored) |
| Q5 Anything else | Drafting input: topics/relationship that color the copy |

**What persists:** the approved Email Templates rows (`subject`, `segment`, `body`, `sign-off`, `updated-at`), one per segment, upserted. The captured voice itself is consumed while drafting and is not written to any repo file. House style: no em dashes anywhere in client-facing copy.
