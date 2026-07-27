/**
 * Loads Region Travel: written by client-onboarding's travel-research step into
 * region-travel.json. A row's mere presence IS the human approval: onboarding only
 * writes a row after the operator approves it, so there are no verified/confidence
 * flags to check here.
 * Missing/empty for a region is an expected steady state: fall back to a generic,
 * no-transit-claim sentence built from Business Profile's location.
 */
import { readFileSync, existsSync } from "node:fs";

/** @param {string} [path] */
export function loadRegionTravel(path = "region-travel.json") {
  if (!existsSync(path)) return {};
  const rows = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(rows)) return {};

  const byRegion = {};
  for (const row of rows) {
    const fields = row.fields ?? row;
    const regionId = fields["region-id"];
    const segment = fields["segment"];
    const sentence = fields["sentence"];
    if (!regionId || !segment || !sentence) continue;
    byRegion[regionId] = byRegion[regionId] || {};
    byRegion[regionId][segment] = sentence;
  }
  return byRegion;
}

/**
 * Generic, no-transit-claim fallback sentence. Never asserts a flight, carrier,
 * or drive time -- only render() is allowed to make those claims, and only from
 * a human-approved Region Travel row.
 * @param {string|null} businessName
 * @param {string|null} location
 * @param {"Wedding"|"Corporate"} segment
 */
export function resolveFallback(businessName, location, segment) {
  const name = businessName && businessName.trim() ? businessName.trim() : "We";
  const loc = location && location.trim() ? location.trim() : "our area";
  return segment === "Corporate"
    ? `${name} sits in the heart of ${loc}, a straightforward destination for a team offsite.`
    : `${name} sits in the heart of ${loc}, an easy addition to a destination wedding.`;
}

/**
 * The render gate: the stored sentence for regionId+segment, or the generic
 * fallback. A null/unknown regionId always falls back.
 * @param {Record<string, Record<string, string>>} regionTravel
 * @param {string|null} regionId
 * @param {"Wedding"|"Corporate"} segment
 * @param {{businessName: string|null, location: string|null}} profileFacts
 */
export function resolveTravelSentence(regionTravel, regionId, segment, { businessName, location }) {
  const sentence = regionId && regionTravel[regionId] && regionTravel[regionId][segment];
  return sentence || resolveFallback(businessName, location, segment);
}

export default resolveTravelSentence;
