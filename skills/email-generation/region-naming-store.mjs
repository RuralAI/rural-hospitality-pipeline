/**
 * Loads Region Naming: written by client-onboarding's region-setup step into
 * region-naming.json. Layer 1 of the Region Profile Schema, now per-client
 * (Airtable) instead of a shared, hardcoded module -- a region the client had
 * not defined had no way to resolve under the old approach and silently fell
 * back to the generic no-transit-claim sentence. Missing/empty is an expected
 * steady state for a client that hasn't set up a given region yet: any market
 * that doesn't match a row falls back the same way.
 */
import { readFileSync, existsSync } from "node:fs";

/** @param {string} [path] */
export function loadRegionNaming(path = "region-naming.json") {
  if (!existsSync(path)) return [];
  const rows = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const fields = row.fields ?? row;
      const regionId = fields["region-id"];
      const anchorCity = fields["anchor-city"] || "";
      const aliases = String(fields["aliases"] || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return { regionId, anchorCity, aliases };
    })
    .filter((r) => r.regionId);
}

/**
 * resolveRegionId -- map a free-text geography string (Stage 01 search-market,
 * ideally -- see the callers) to a region_id by matching this client's own
 * Region Naming rows against their anchor-city or any alias (case-insensitive
 * substring). Same matching algorithm the old shared module used, just backed
 * by per-client data instead of a template-wide hardcoded list.
 *
 * @param {string} geography
 * @param {Array<{regionId:string, anchorCity:string, aliases:string[]}>} regionNaming
 * @returns {string|null}
 */
export function resolveRegionId(geography, regionNaming) {
  if (!geography) return null;
  const haystack = String(geography).toLowerCase();
  for (const region of regionNaming || []) {
    const needles = [region.anchorCity, ...(region.aliases || [])];
    if (needles.some((n) => n && haystack.includes(String(n).toLowerCase()))) {
      return region.regionId;
    }
  }
  return null;
}

export default resolveRegionId;
