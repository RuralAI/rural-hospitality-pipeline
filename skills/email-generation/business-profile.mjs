/**
 * Loads and normalizes Business Profile: the single-row Airtable table (kebab-case
 * field names) written by the connector-read step in SKILL.md into
 * business-profile.json. Missing the file is a hard stop -- see the design spec's
 * Error Handling section (never proceed with nulls).
 */
import { readFileSync, existsSync } from "node:fs";

const linesOrEmpty = (v) =>
  typeof v === "string" && v.trim() !== ""
    ? v.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

/** @param {Record<string, unknown>} raw */
export function normalizeBusinessProfile(raw) {
  return {
    businessName: raw["business-name"] ?? null,
    businessUrl: raw["business-url"] ?? null,
    location: raw["location"] ?? null,
    signingName: raw["signing-name"] ?? null,
    signature: {
      title: raw["signature-title"] ?? null,
      address: raw["signature-address"] ?? null,
      phone: raw["signature-phone"] ?? null,
      website: raw["signature-website"] ?? null,
    },
    capacity: raw["capacity"] ?? null,
    destinationAirport: {
      code: raw["destination-airport-code"] ?? null,
      name: raw["destination-airport-name"] ?? null,
    },
    highlights: linesOrEmpty(raw["highlights"]),
    corporateHighlights: linesOrEmpty(raw["corporate-highlights"]),
    targetRegionIds: linesOrEmpty(raw["target-region-ids"]),
    segments: Array.isArray(raw["segments"]) ? raw["segments"] : [],
  };
}

/** @param {string} [path] */
export function loadBusinessProfile(path = "business-profile.json") {
  if (!existsSync(path)) {
    throw new Error(
      `No Business Profile found at ${path}. Run the client-onboarding skill first.`
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return normalizeBusinessProfile(raw);
}

export default loadBusinessProfile;
