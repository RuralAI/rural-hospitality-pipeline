// AUTO-GENERATED from config/region-naming.js by scripts/sync-skills.mjs — do not edit.
// Edit the source and re-run: npm run sync:skills

/**
 * Layer 1 — Region Naming  (Region Profile Schema v0.1)
 *
 * How a place refers to itself — display name, the preposition that makes copy
 * sound local, and the literal anchor city/airport used for flight references.
 *
 * In the Airtable-driven flow this layer is per-client data (the Region Naming
 * table, written by client-onboarding). This file is EXAMPLE data that ships
 * with the template to show the shape and to back the local tests. Replace it
 * with your own regions, or drive it from Airtable via the skills.
 *
 * Keyed by stable region_id (decoupled from display_name).
 *
 * Field notes:
 * - display_name   includes the article when idiomatic ("the North Valley").
 *                  Bare city names do not.
 * - preposition    "in the North Valley", "on the Coast". This is the detail
 *                  that separates writing from fill-in-the-blank output.
 * - anchor_city/   feed the flight reference, which always names the literal
 *   anchor_airport hub city — never the region ("nonstop from Northgate").
 * - audience_phrase keyed by segment ("Wedding" → "couples in the North Valley",
 *                  "Corporate" → "teams in the North Valley"). Overridable so a
 *                  human can fix any awkward render. NOTE: not consumed by the
 *                  render gate — the shipped copy is the per-segment
 *                  travel_sentence in Layer 2. This is the naming source of truth
 *                  for that phrase and a convenience for future composition.
 *
 * resolveRegionId(geography) maps a free-text geography (search-market or
 * city-metro string) to a region_id by matching anchor_city; null if no match.
 */

const regionNaming = {
  north_valley: {
    region_id: "north_valley",
    display_name: "the North Valley",
    preposition: "in",
    anchor_city: "Northgate",
    anchor_airport: "NGA",
    aliases: ["Oakdale", "Pinecrest"],
    audience_phrase: {
      Wedding: "couples in the North Valley",
      Corporate: "teams in the North Valley",
    },
  },

  coastal: {
    region_id: "coastal",
    display_name: "the Coast",
    preposition: "on",
    anchor_city: "Baytown",
    anchor_airport: "BAY",
    aliases: ["Seaside", "Harbor City"],
    audience_phrase: {
      Wedding: "couples on the Coast",
      Corporate: "teams on the Coast",
    },
  },

  southlands: {
    region_id: "southlands",
    display_name: "the Southlands",
    preposition: "in",
    anchor_city: "Southport",
    anchor_airport: "SPT",
    aliases: ["Fairview"],
    audience_phrase: {
      Wedding: "couples in the Southlands",
      Corporate: "teams in the Southlands",
    },
  },

  high_desert: {
    region_id: "high_desert",
    display_name: "the High Desert",
    preposition: "in",
    anchor_city: "Junction City",
    anchor_airport: "JCT",
    aliases: ["Mesa Springs"],
    audience_phrase: {
      Wedding: "couples in the High Desert",
      Corporate: "teams in the High Desert",
    },
  },
};

/**
 * resolveRegionId — map a free-text geography string to a region_id.
 *
 * Matches `geography` against each region's anchor_city or any alias
 * (case-insensitive substring), so "Northgate", "Northgate CO",
 * "Northgate, Colorado", and "Oakdale" all resolve to `north_valley`. Callers
 * should prefer the Stage 01 search-market (the targeted geography) over the
 * firm's parsed city-metro, since only the search markets map cleanly to the
 * region profiles.
 *
 * @param {string} geography - e.g. a firm's searchMarket or cityMetro
 * @returns {string|null} a region_id key, or null if nothing matches
 */
export function resolveRegionId(geography) {
  if (!geography) return null;
  const haystack = String(geography).toLowerCase();
  for (const region of Object.values(regionNaming)) {
    const needles = [region.anchor_city, ...(region.aliases || [])];
    if (needles.some((n) => haystack.includes(String(n).toLowerCase()))) {
      return region.region_id;
    }
  }
  return null;
}

export default regionNaming;
