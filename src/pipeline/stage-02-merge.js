/**
 * Stage 02 — merge the v1 scraper results with the Hunter enrichment overlay
 * into Airtable-shaped Contact objects (pure core, no I/O).
 *
 * Hunter is an enrichment overlay, never a downgrade: its email wins only when
 * it improves on v1 (v1 had none, or Hunter personal over v1 generic). In every
 * other case — including Hunter no_result with a null email — the v1 email
 * survives (the "fallback rule").
 *
 * All file reads and Airtable calls live in `scripts/promote-contacts.mjs`.
 */

import { isGenericEmail } from "./stage-02-hunter.js";

/**
 * @param {Array<object>} v1Records      stage-02-results.json entries
 * @param {Array<object>} hunterRecords  stage-02-hunter-results.json entries
 * @returns {{contacts: Array<{firm_id: string, firm_name: string, fields: object}>,
 *            skipped:  Array<{firm_id: string, firm_name: string, reason: string}>}}
 */
export function mergeContacts(v1Records, hunterRecords) {
  const hunterById = new Map((hunterRecords ?? []).map((h) => [h.firm_id, h]));
  const contacts = [];
  const skipped = [];

  for (const rec of v1Records ?? []) {
    const hunter = hunterById.get(rec.firm_id) ?? null;
    const v1Email = rec.email || null;
    const hunterEmail = hunter?.email || null;

    // Improvement test: Hunter only wins with a *different* email when v1 has
    // none, or when Hunter's is personal where v1's is generic.
    const hunterWins =
      hunterEmail !== null &&
      hunterEmail !== v1Email &&
      (v1Email === null || (isGenericEmail(v1Email) && !isGenericEmail(hunterEmail)));

    const email = hunterWins ? hunterEmail : v1Email;
    if (!email) {
      skipped.push({
        firm_id: rec.firm_id,
        firm_name: rec.firm_name,
        reason: "no email in either file",
      });
      continue;
    }

    // Winner first, then the rest of both files' addresses, deduped — a losing
    // Hunter record still contributes its addresses (captured, never lost).
    const allEmails = [email];
    for (const e of [...(rec.all_emails ?? []), ...(hunter?.all_emails ?? [])]) {
      if (e && !allEmails.includes(e)) allEmails.push(e);
    }

    contacts.push({
      firm_id: rec.firm_id,
      firm_name: rec.firm_name,
      fields: {
        "first-name": hunterWins ? hunter.first_name || "" : "",
        "last-name": hunterWins ? hunter.last_name || "" : "",
        title: hunterWins ? hunter.title || "" : "",
        email,
        "all-emails": allEmails.join("\n"),
        "email-verified": false,
        "contact-source": hunterWins ? "Hunter" : "Scraped",
        "firm-id": [rec.firm_id],
      },
    });
  }

  return { contacts, skipped };
}
