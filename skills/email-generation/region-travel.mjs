// AUTO-GENERATED from config/region-travel.js by scripts/sync-skills.mjs — do not edit.
// Edit the source and re-run: npm run sync:skills

/**
 * Layer 2 — Property Travel Facts  (Region Profile Schema v0.1)
 *
 * PER-PROPERTY. How people actually get from a region to THIS property's front
 * door. Rebuilt per client and refreshed on a cadence — airlines add and drop
 * routes, so travel facts go stale in a way the naming layer does not.
 *
 * In the Airtable-driven flow this is per-client data (the Region Travel table,
 * written by client-onboarding after human approval). This file is EXAMPLE data
 * that ships with the template to show the shape and to back the local tests.
 *
 * Two sources of truth ON PURPOSE:
 * - the structured `nonstop` / `drive` fields are the basis for accuracy and
 *   for refreshing the claim later;
 * - `travel_sentence` is the human-approved final copy that actually renders,
 *   keyed by segment ("Wedding" | "Corporate"). Each segment's sentence is
 *   independently approved — a null means that segment has no approved copy yet
 *   and falls back. Corporate copy must NOT inherit the Wedding sentence, or a
 *   corporate email would address "couples".
 *
 * RENDER GATE (see resolveTravelSentence): a transit claim is asserted to a
 * client ONLY when a human has verified it. Never compose a flight/drive claim
 * at render time from unverified structured fields.
 *
 * Property: Example Inn — destination airport RVT (Rivertown Regional).
 * All values below are illustrative example data — replace with verified facts.
 * Keyed by region_id (matches config/region-naming.js).
 */

const PROPERTY_ID = "example_inn";

const regionTravel = {
  north_valley: {
    property_id: PROPERTY_ID,
    region_id: "north_valley",
    destination_airport: "RVT",
    nonstop: {
      exists: true,
      origin: "Northgate",
      carrier: "Example Air",
      duration_text: "about an hour and a half",
      frequency: "daily, year-round",
    },
    drive: {
      realistic: true,
      time_text: "about 5 hours",
      descriptor: "a scenic day's drive",
    },
    travel_sentence: {
      Wedding:
        "Rivertown is an easy trip for couples in the North Valley and their guests: a nonstop flight from Northgate, or a scenic day's drive.",
      Corporate:
        "Rivertown is a straightforward trip for a North Valley team: a nonstop flight from Northgate, or a scenic day's drive.",
    },
    verification: {
      verified: true,
      verified_by: "Example",
      verified_date: "2026-01-01",
      source: "example data — replace with a verified source",
      confidence: "high",
      refresh_due: "2026-12-31",
    },
  },

  coastal: {
    property_id: PROPERTY_ID,
    region_id: "coastal",
    destination_airport: "RVT",
    nonstop: {
      exists: true,
      origin: "Baytown",
      carrier: "Example Air",
      duration_text: "a short flight",
      frequency: "daily, year-round",
    },
    drive: {
      realistic: true,
      time_text: "about 6 hours",
      descriptor: "a scenic drive inland",
    },
    travel_sentence: {
      Wedding:
        "Rivertown is an easy trip for couples on the Coast and their guests: a nonstop flight from Baytown, or a scenic drive inland.",
      Corporate:
        "Rivertown is a straightforward trip for a Baytown-area team: a nonstop flight from Baytown, or a scenic drive inland.",
    },
    verification: {
      verified: true,
      verified_by: "Example",
      verified_date: "2026-01-01",
      source: "example data — replace with a verified source",
      confidence: "high",
      refresh_due: "2026-12-31",
    },
  },

  // No nonstop to RVT — drive only, a genuinely easy ~3.5 hour route.
  southlands: {
    property_id: PROPERTY_ID,
    region_id: "southlands",
    destination_airport: "RVT",
    nonstop: {
      exists: false,
      origin: null,
      carrier: null,
      duration_text: null,
      frequency: null,
    },
    drive: {
      realistic: true,
      time_text: "about 3.5 hours",
      descriptor: "about a 3½-hour drive up the highway",
    },
    travel_sentence: {
      Wedding:
        "Rivertown is an easy trip for couples in the Southlands and their guests: about a 3½-hour drive up the highway.",
      Corporate:
        "Rivertown is a straightforward trip for a Southlands team: about a 3½-hour drive up the highway.",
    },
    verification: {
      verified: true,
      verified_by: "Example",
      verified_date: "2026-01-01",
      source: "example data — replace with a verified source",
      confidence: "high",
      refresh_due: "2026-12-31",
    },
  },

  // No nonstop to RVT — drive only, ~4 hours.
  high_desert: {
    property_id: PROPERTY_ID,
    region_id: "high_desert",
    destination_airport: "RVT",
    nonstop: {
      exists: false,
      origin: null,
      carrier: null,
      duration_text: null,
      frequency: null,
    },
    drive: {
      realistic: true,
      time_text: "about 4 hours",
      descriptor: "about a four-hour drive",
    },
    travel_sentence: {
      Wedding:
        "Rivertown is an easy trip for couples in the High Desert and their guests: about a four-hour drive.",
      Corporate:
        "Rivertown is a straightforward trip for a High Desert team: about a four-hour drive.",
    },
    verification: {
      verified: true,
      verified_by: "Example",
      verified_date: "2026-01-01",
      source: "example data — replace with a verified source",
      confidence: "high",
      refresh_due: "2026-12-31",
    },
  },
};

/**
 * Property-level fallback — region-independent, makes NO transit claim.
 * Segment-keyed so a Corporate email never inherits the wedding-specific wording
 * ("destination wedding"). Rendered whenever a region's travel_sentence cannot be
 * safely asserted. Neither line asserts a flight, carrier, or drive time.
 */
export const fallbackSentence = {
  Wedding:
    "Rivertown sits in the heart of the mountains, an easy addition to a destination wedding.",
  Corporate:
    "Rivertown sits in the heart of the mountains, a straightforward destination for a team offsite.",
};

// Segment-neutral last resort, used only if an unexpected segment is passed.
const GENERIC_FALLBACK = "Rivertown sits in the heart of the mountains.";

/**
 * resolveFallback — picks the safe, transit-claim-free fallback for a segment.
 * Defaults to the generic line for any segment without dedicated copy.
 *
 * @param {string} segment - "Wedding" | "Corporate"
 * @returns {string}
 */
export function resolveFallback(segment) {
  return fallbackSentence[segment] || GENERIC_FALLBACK;
}

/**
 * resolveTravelSentence — the render gate from the schema.
 *
 * Returns the human-approved travel_sentence for the given segment ONLY when the
 * profile is verified, confidence is high or medium, AND that segment has an
 * approved (non-null) sentence. Otherwise returns the segment-appropriate property
 * fallback (see resolveFallback). Never
 * composes a claim from structured fields at render time, and never substitutes
 * one segment's sentence for another (a null Corporate sentence falls back — it
 * does NOT borrow the Wedding sentence).
 *
 * @param {string} regionId - a key in regionTravel (e.g. "north_valley"); null is ok
 * @param {string} segment  - "Wedding" | "Corporate"
 * @returns {string} a sentence safe to send to a client
 */
export function resolveTravelSentence(regionId, segment) {
  const profile = regionTravel[regionId];
  if (!profile) return resolveFallback(segment);

  const { verified, confidence } = profile.verification || {};
  const confidenceOk = confidence === "high" || confidence === "medium";
  const sentence = profile.travel_sentence && profile.travel_sentence[segment];

  if (verified && confidenceOk && sentence) {
    return sentence;
  }
  return resolveFallback(segment);
}

export default regionTravel;
