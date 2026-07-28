// corporate-research / lib.mjs
//
// Pure, skill-specific helpers for Apollo Track A discovery: mapping an
// Apollo person+organization pair into the Firm-shaped/Contact-shaped
// records this skill writes to Airtable, best-effort domain extraction for
// the --reveal (People Match) call, and reveal-candidate ranking.
//
// The shared, canonical firm-name normalizer lives in normalize.mjs, which is
// AUTO-GENERATED verbatim from src/lib/normalize.js. Do NOT re-implement it
// here -- that is exactly the drift firm-discovery's own lib.mjs warns about.

export { normalizeFirmName } from "./normalize.mjs";

/**
 * Best-effort domain extraction from an Apollo organization object.
 *
 * HONESTY FLAG (2026-07-27): Apollo's exact field name for an organization's
 * primary domain in a People Search response was NOT confirmed against a
 * live call during design (see docs/superpowers/specs/
 * 2026-07-27-apollo-track-a-integration-design.md, Non-Goals). This tries
 * the field names Apollo's docs and public integrations commonly use, in
 * order, and falls back to deriving a hostname from website_url. Returns
 * null (never throws) if nothing usable is present -- callers must treat
 * null as "cannot reveal this candidate," not as an error.
 */
export function resolveOrganizationDomain(organization) {
  if (!organization || typeof organization !== "object") return null;
  if (typeof organization.primary_domain === "string" && organization.primary_domain) {
    return organization.primary_domain;
  }
  if (typeof organization.domain === "string" && organization.domain) {
    return organization.domain;
  }
  if (typeof organization.website_url === "string" && organization.website_url) {
    try {
      const withScheme = /^https?:\/\//i.test(organization.website_url)
        ? organization.website_url
        : `https://${organization.website_url}`;
      return new URL(withScheme).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Map one Apollo person + their organization into the Firm-shaped and
 * Contact-shaped records this skill writes to Airtable (dash-convention
 * field names, matching every other skill in this repo).
 *
 * `revealed`, if provided, is a People Match result -- its real first_name/
 * last_name/email override the masked Search-response fields
 * (last_name_obfuscated, no email). Pass null/omit for a masked, search-only
 * candidate.
 */
export function mapApolloCandidate(person, organization, revealed = null) {
  const firm = {
    "firm-name": organization?.name || "",
    "city-metro": organization?.city || organization?.location || "",
    "website-url": organization?.website_url || "",
    segment: "Corporate",
    source: "Apollo",
    notes: `Matched title: ${person?.title || "unknown"}`,
  };

  const contact = {
    "first-name": revealed?.first_name || person?.first_name || "",
    "last-name": revealed?.last_name || person?.last_name_obfuscated || "",
    title: person?.title || "",
    email: revealed?.email || null,
    "contact-source": "Apollo",
    "email-verified": false,
  };

  return { firm, contact };
}

/**
 * Rank candidates for a --reveal pass: best data availability first (an
 * Apollo Search-response candidate with has_email and has_direct_phone both
 * true is more likely to yield a real match than one with neither), then
 * slice to the requested count.
 */
export function rankCandidatesForReveal(candidates, n) {
  const score = (c) => (c.has_email ? 2 : 0) + (c.has_direct_phone ? 1 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a)).slice(0, n);
}
