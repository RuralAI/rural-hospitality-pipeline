/**
 * Stage 02 v2 — Hunter Domain Search enrichment (pure core).
 *
 * No I/O. All file reads, HTTP calls, and env access live in the CLI wrapper
 * `scripts/run-stage-02-hunter.mjs`.
 */

// Shared-inbox local-parts. Mirrors the generic classification used in the
// v1 results tally so the target set lines up with the 15 generic firms.
const GENERIC_LOCAL_PARTS = new Set([
  "info", "hello", "contact", "contactus", "events", "event",
  "weddings", "wedding", "inquiries", "inquiry", "enquiries",
  "bookings", "booking", "office", "team", "hi", "hey", "admin",
  "studio", "connect", "general", "support", "sales", "mail",
]);

/** True when an email's local-part is a known shared/generic inbox. */
export function isGenericEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return false;
  // Strip separators so "contact.us"/"contact-us" normalize onto "contactus".
  // Realistic personal locals (e.g. "jane.smith" -> "janesmith") don't collide with the set.
  const local = email.split("@")[0].toLowerCase().replace(/[._-]/g, "");
  return GENERIC_LOCAL_PARTS.has(local);
}

/** Hunter confidence (0–100) below this is treated as junk and dropped. */
export const CONFIDENCE_FLOOR = 50;

// Broad on purpose: this is only a +100 nudge among contacts of the same type;
// it never overrides the personal>generic priority. "director"/"president" may
// match non-events roles, but type + confidence still dominate.
export const RELEVANT_TITLE_RE =
  /\b(owner|founder|principal|planner|coordinator|director|events?|president|ceo|proprietor)\b/i;

function contactScore(email) {
  let score = 0;
  if (email.type === "personal") score += 1000;
  if (RELEVANT_TITLE_RE.test(email.position || "")) score += 100;
  score += Number(email.confidence) || 0;
  return score;
}

/**
 * Pick the best contact from a Hunter Domain Search response.
 * Ranking: personal > generic, then relevant-title boost, then confidence.
 * Returns null when no address clears the confidence floor.
 *
 * @param {object} response  Parsed Hunter domain-search JSON.
 * @param {{confidenceFloor?: number}} [opts]
 */
export function selectBestContact(response, { confidenceFloor = CONFIDENCE_FLOOR } = {}) {
  const emails = response?.data?.emails;
  if (!Array.isArray(emails) || emails.length === 0) return null;

  const usable = emails.filter(
    (e) => e && typeof e.value === "string" && (Number(e.confidence) || 0) >= confidenceFloor,
  );
  if (usable.length === 0) return null;

  const ranked = [...usable].sort((a, b) => contactScore(b) - contactScore(a));
  const best = ranked[0];
  return {
    email: best.value,
    type: best.type || "unknown",
    all_emails: ranked.map((e) => e.value), // ranked best-first, not Hunter's original order
    first_name: best.first_name || "",
    last_name: best.last_name || "",
    title: best.position || "",
    confidence: best.confidence != null && !Number.isNaN(Number(best.confidence))
      ? Number(best.confidence)
      : null,
  };
}

/** Bare registrable host from a website URL, or null if unparseable. */
export function extractDomain(websiteUrl) {
  if (typeof websiteUrl !== "string") return null;
  const trimmed = websiteUrl.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}
