# Business Intake Worksheet

A few questions about your business so we can find the right planners to reach out to and write outreach that sounds like you. Answer what you can; a sentence or two each is plenty, and skip anything that does not apply.

**Fill in as much as you want — the more you share, the more tailored the outreach.** The sections build on each other:

- **Section 1** alone → enough to build your list of planners to contact.
- **+ Section 2** → emails grounded in real detail about your place.
- **+ Section 3** → emails that actively pursue your goal.
- **+ Section 4** → emails written in your voice.

Stop whenever you have what you need. Later sections are optional.

---

## Section 1: Business basics *(required, unlocks a contacts list)*

1. **Business name:** exactly as it should appear in outreach. *(e.g., "Example Inn")*
2. **Website:** full URL.
3. **Location:** city and state.
4. **Segments to pursue:** which kinds of planners do you want to reach? *(e.g., Wedding, Corporate; list all that apply)*
5. **Target regions:** which metro areas should we find planners in, and where do your guests travel from? List each hub metro. *(e.g., Northgate, Baytown, Southport, Junction City)*
   - *(Optional, per metro, for faster setup):* a friendlier region name if you use one *(e.g., "the North Valley" for Northgate)*; the nearest airport to that metro; and who you target there *(e.g., "tech and outdoor brands")*.
6. **Group size:** the smallest and largest group you can host. *(e.g., 16 to 21 guests, full-property buyout)*

---

## Section 2: Property facts *(optional, grounds the emails in real detail)*

7. **What makes your place distinctive?** Three to six concrete details: the building, setting, history, what guests remember. Specifics over adjectives.
8. **Certifications, awards, or memberships** worth mentioning. *(e.g., a green/sustainability certification)*
9. **Amenities that matter to groups:** meeting/gathering space, Wi-Fi, dining/breakfast, parking, accessibility.
10. **Segment-specific facts:** anything that matters for one segment but not another. *(e.g., corporate: dedicated meeting space, high-speed Wi-Fi; wedding: getting-ready space, on-site ceremony options)*
11. **Food:** breakfast and any catering/dining you offer.
12. **Location perks:** nearby attractions, transit, walkability.
13. **Nearest commercial airport to your property:** the airport guests would fly into, with its code if you know it. *(e.g., Rivertown Regional, RVT)*
14. **Who signs the emails?** The name(s) as they should appear, plus the role/title line, mailing address, and phone for the email signature. *(Website is from Q2.)*

---

## Section 3: Goals & positioning *(optional, makes emails pursue your goal)*

15. **Primary goal, in your own words.** What is this outreach for? *(e.g., "sell whole-property buyouts," "increase total bookings," "fill midweek and off-season nights," "grow the wedding segment")*
16. **Ideal customer.** Who is the planner or group you most want more of?
17. **Emphasize.** What should outreach lead with? The things you most want planners to know.
18. **Steer away from.** What should we *not* pitch or say? Off-strategy offerings or framing you dislike. *(e.g., "no room blocks, we want whole-house buyouts," "no discount or off-season framing")*
19. *(Optional)* **What does a win look like?** How will you judge whether this is working?

---

## Section 4: Voice *(optional, emails in your voice)*

Voice is captured separately, in `voice-worksheet.md` — how you come across (tone), what would feel wrong in an email written on your behalf, how you sign off, and a few real sample sentences in your voice.

→ Fill in `voice-worksheet.md` when you're ready to have emails written. Skip it if you only want a list of contacts.

---

> **Clients can stop here.** Everything below is for the CRAI operator setting up the pipeline — you do not need to read it to fill in the worksheet.

## Appendix: Field mapping *(for the CRAI operator running the client-onboarding and voice-intake skills)*

Answers are written to **Airtable**, not to repo config files. Sections 1–2 become a single-row **Business Profile** record (upserted); target regions also seed **Region Naming** and, after human approval, **Region Travel**. Section 3 positioning is captured in the interview and handed to voice-intake in-session (nothing in the pipeline reads a positioning file). Section 4 voice becomes **Email Templates** rows via voice-intake.

| Question | Writes to |
|---|---|
| Q1 Business name | Business Profile → `business-name` |
| Q2 Website | Business Profile → `business-url` (+ `signature-website`) |
| Q3 Location | Business Profile → `location` |
| Q4 Segments | Business Profile → `segments` (multi-select) |
| Q5 Target regions | Region Naming rows (`region-id`, `anchor-city`, `aliases`) + Business Profile → `target-region-ids`; travel copy becomes Region Travel rows (`region-id`, `segment`, `sentence`) after human approval, gated unverified until then |
| Q6 Group size | Business Profile → `capacity` |
| Q7–Q9, Q11–Q12 Property facts | Business Profile → `highlights` (one per line) |
| Q10 Segment-specific facts | Business Profile → `corporate-highlights` (and/or the relevant segment highlights) |
| Q13 Property airport | Business Profile → `destination-airport-code`, `destination-airport-name` |
| Q14 Signer / signature block | Business Profile → `signing-name`, `signature-title`, `signature-address`, `signature-phone`, `signature-website` |
| Q15 Primary goal | Captured in interview → handed to voice-intake; not stored |
| Q16 Ideal customer | Captured in interview → handed to voice-intake; not stored |
| Q17 Emphasize | Captured in interview → handed to voice-intake; not stored |
| Q18 Steer away from | Captured in interview → handed to voice-intake; not stored |
| Q19 Win definition | *(optional notes, not consumed by the pipeline)* |
| Section 4 Voice | Airtable Email Templates rows via the voice-intake skill (see `voice-worksheet.md`); not written to any repo file |

**Operational config is not collected here.** Pipeline tuning (geocoder seed cache, discovery pagination, the segment→search-term map, the Airtable base reference) lives in `config/client.js` and is operator-owned, not collected from the client and not touched by onboarding.
