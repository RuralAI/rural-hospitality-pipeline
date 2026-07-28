// firm-discovery / lib.mjs
//
// Skill-specific helpers for discovery. The shared, canonical helpers
// (normalizeFirmName, extractCity/Zip/State, the state-code maps, and
// expandStateCode) live in normalize.mjs, which is AUTO-GENERATED verbatim from
// src/lib/normalize.js by scripts/sync-skills.mjs. Do NOT re-implement them
// here — that is exactly the drift that let "Bayfield CO" resolve to Wisconsin.
// This file holds only what is specific to firm discovery: shaping a Serper
// place into an Airtable Firms record, and loading the cross-run dedup set.

import { readFileSync, existsSync } from "node:fs";
import { normalizeFirmName, extractCity, extractZip, extractState, stateCodeToName } from "./normalize.mjs";

// ---- segment → search terms ------------------------------------------------

const SEGMENT_TERMS = {
  Wedding: ["wedding planner"],
  Corporate: [
    "corporate event planner",
    "corporate retreat planner",
    "destination management company",
  ],
};

/**
 * Resolve a segment to the list of Serper search terms it runs per city.
 * Wedding is a single term; Corporate runs three (a thin market that surfaces
 * under several phrasings) — discover.mjs merges and dedupes results across
 * all terms for a segment by normalized firm name.
 */
export function resolveSearchTerms(segment) {
  const terms = SEGMENT_TERMS[segment];
  if (!terms) {
    throw new Error(`Unknown segment: "${segment}". Must be one of: ${Object.keys(SEGMENT_TERMS).join(", ")}`);
  }
  return terms;
}

// ---- firm record shaping -----------------------------------------------------

/**
 * Extract the city/market name from a geography argument like "Denver CO" or
 * "Santa Fe NM" -- everything before a trailing 2-letter US state code, so
 * multi-word cities aren't truncated to their first token (the bug: naive
 * `geography.split(" ")[0]` turned "Santa Fe NM" into "Santa" and "Little Rock
 * AR" into "Little", which then failed to match any region's anchor_city/alias
 * in region-naming.js and silently fell back to the generic travel sentence).
 * Falls back to the full trimmed string when no valid trailing state code is found.
 */
export function extractSearchMarket(geography) {
  if (typeof geography !== "string") return "";
  const trimmed = geography.trim();
  const m = trimmed.match(/^(.*?),?\s+([A-Za-z]{2})$/);
  if (m && stateCodeToName(m[2])) return m[1].trim();
  return trimmed;
}

export function mapToFirm(place, segment, searchMarket, searchStateCode) {
  const address = place.address ?? "";
  const firmStateCode = extractState(address);
  // Flag, never drop, per project rule. Undeterminable (either side empty) => no
  // flag — extractState/stateNameToCode return "" when the address or resolved
  // state can't be determined, and "" is falsy, so the comparison won't fire.
  const outsideRegion = Boolean(
    firmStateCode && searchStateCode && firmStateCode !== searchStateCode
  );
  let notes = place.type ? `Type: ${place.type}` : "";
  if (outsideRegion) {
    notes = `⚠ Outside ${searchStateCode}${notes ? " · " + notes : ""}`;
  }
  return {
    "firm-name": place.title ?? "",
    "city-metro": extractCity(address),
    "website-url": place.website ?? "",
    segment,
    source: "GoogleMaps (Serper)",
    zip: extractZip(address),
    "search-market": searchMarket,
    specialties: "",
    notes,
    outsideRegion,
  };
}

// ---- cross-run dedup (the thing #1 fixed on 2026-07-13) ---------------------
//
// The script has no Airtable access itself (by design — the connector owns
// that auth). Cross-run dedup works by having the caller (the skill, running
// in chat) fetch existing Firms names via the Airtable connector, write them
// to a plain JSON array file, and pass that file's path here. Names are
// normalized the same way as new results, so a firm already in Airtable is
// skipped instead of being written again as a duplicate.
export function loadExistingNames(path) {
  if (!path) return new Set();
  if (!existsSync(path)) {
    console.error(`--existing-firms file not found: ${path}. Proceeding without cross-run dedup.`);
    return new Set();
  }
  let names;
  try {
    names = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(`Could not parse ${path} as JSON. Proceeding without cross-run dedup.`);
    return new Set();
  }
  if (!Array.isArray(names)) {
    console.error(`${path} did not contain a JSON array of names. Proceeding without cross-run dedup.`);
    return new Set();
  }
  return new Set(names.map(normalizeFirmName).filter(Boolean));
}
