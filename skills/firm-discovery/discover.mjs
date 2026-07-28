#!/usr/bin/env node
// firm-discovery / discover.mjs
//
// Stage 01 discovery pass, running as a claude.ai skill (no Vercel app
// required). Originated 2026-07-13 as a validation spike; hardened same day.
// No imports beyond the bundled ./lib.mjs and ./normalize.mjs (both ship with
// the skill): self-contained so it runs inside claude.ai code execution.
//
// Usage:
//   node discover.mjs "Denver CO" [--segment Wedding] [--max-pages 3] [--serper-key KEY] [--existing-firms existing-firms.json]
//
// Key resolution order: --serper-key arg > SERPER_API_KEY env > ./serper.key file
//
// --existing-firms points to a JSON array of firm-name strings already in Airtable
// (fetch these via the Airtable connector before running this script). Matches are
// skipped and reported separately, so re-running discovery on a city you've already
// searched won't create duplicate Firms rows. Without this flag, dedup is
// within-run only.
//
// IMPORTANT (honesty flag, updated 2026-07-13): the Serper Maps and Nominatim
// request/response shapes below were originally written from CRAI's documented
// behavior, NOT copied from the live src/lib/geo-search source. As of 2026-07-13
// the endpoint, request shape, and response field names for both APIs have been
// checked against first-party sources (a live example on serper.dev's own
// playground; Nominatim's official docs at nominatim.org) and they match. One
// item remains genuinely unreconciled: normalizeFirmName()'s exact business-
// suffix list is an approximation, not a diff against the real
// src/lib/normalize.js source (see the comment in lib.mjs).

import { readFileSync, existsSync } from "node:fs";
// Shared, canonical helpers live in normalize.mjs (AUTO-GENERATED from
// src/lib/normalize.js). Skill-specific shaping/dedup helpers live in lib.mjs.
import { normalizeFirmName, stateNameToCode, expandStateCode } from "./normalize.mjs";
import { mapToFirm, loadExistingNames, extractSearchMarket, resolveSearchTerms } from "./lib.mjs";

// ---- config ---------------------------------------------------------------

const PAGE_SIZE = 20; // Serper Maps returns ~20 results/page
const NOMINATIM_UA = "CRAI-firm-discovery/1.0 (ruralai.org)";

// ---- arg parsing ------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith("--")) {
  console.error('Usage: node discover.mjs "<City ST>" [--segment Wedding] [--max-pages 3] [--serper-key KEY] [--existing-firms FILE]');
  process.exit(1);
}
const geography = args[0];
const getFlag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
};
const segment = getFlag("segment", "Wedding");
const maxPages = parseInt(getFlag("max-pages", "3"), 10);
const existingFirmsPath = getFlag("existing-firms", null);
let terms;
try {
  terms = resolveSearchTerms(segment);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// ---- key resolution ---------------------------------------------------------

function resolveSerperKey() {
  const fromArg = getFlag("serper-key", null);
  if (fromArg) return fromArg.trim();
  if (process.env.SERPER_API_KEY) return process.env.SERPER_API_KEY.trim();
  if (existsSync("./serper.key")) {
    // supports a bare key file, or a KEY=VALUE line
    const raw = readFileSync("./serper.key", "utf8").trim();
    const m = raw.match(/SERPER_API_KEY\s*=\s*(.+)/);
    return (m ? m[1] : raw).trim();
  }
  return null;
}
const serperKey = resolveSerperKey();
if (!serperKey) {
  console.error(
    "No Serper key found. Provide one via --serper-key, the SERPER_API_KEY env var, or a ./serper.key file."
  );
  process.exit(1);
}

// ---- geocode (Nominatim, keyless) -----------------------------------------

async function geocode(query) {
  // Confirmed 2026-07-13 against Nominatim's official /search docs (nominatim.org):
  // q, format, addressdetails, and limit are real, current parameters, and the
  // response is an array of objects with lat/lon/address exactly as used below.
  // Nominatim usage policy requires an honest User-Agent and <=1 req/sec.
  // Expand a trailing bare state code ("Bayfield CO" → "Bayfield Colorado")
  // before geocoding — Nominatim ignores the bare code and would mis-resolve.
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q: expandStateCode(query), format: "json", limit: "1", addressdetails: "1" });
  const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
  if (!res.ok) throw new Error(`Geocode failed for "${query}": HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows.length) throw new Error(`No geocode match for "${query}".`);
  const { lat, lon, address } = rows[0];
  const stateName = address?.state ?? null;
  return {
    lat,
    lon,
    state: stateName,
    stateCode: stateNameToCode(stateName), // used for outsideRegion comparison
    // Serper ll format is @lat,lon,zoom (documented in serper-maps-pagination-research.md)
    ll: `@${lat},${lon},11z`,
  };
}

// ---- Serper Maps (paid, per-page) -----------------------------------------

async function serperMaps(q, ll, page) {
  // Confirmed 2026-07-13: the google.serper.dev/<endpoint> pattern, the
  // X-API-KEY auth header, and the POST-with-JSON-body shape all match
  // Serper's own site plus independent integration write-ups (n8n, Clay
  // community threads hit the same 401/403 on a missing/wrong X-API-KEY).
  const res = await fetch("https://google.serper.dev/maps", {
    method: "POST",
    headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
    // ll sent on EVERY page (per CHANGELOG: fixes the latent pagination cap); gl biases to US.
    // gl is hardcoded "us" here (deliberate simplification for this US-only,
    // single-client deployment; the real app derives it from resolved location).
    body: JSON.stringify({ q, ll, page, gl: "us" }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Serper rejected the key (HTTP " + res.status + "). Check the SERPER_API_KEY.");
  }
  if (res.status === 429) {
    throw new Error("Serper rate limit or out of credits (HTTP 429). Log in to serper.dev to check.");
  }
  if (!res.ok) throw new Error(`Serper Maps error: HTTP ${res.status}`);
  const data = await res.json();
  return data.places ?? []; // Confirmed 2026-07-13 against a live example on serper.dev's own playground: Maps responses are shaped { ll, places: [...] }.
}

// ---- run --------------------------------------------------------------------

console.error(`Geocoding "${geography}" ...`);
const loc = await geocode(geography);
console.error(`Resolved ll=${loc.ll} (state: ${loc.state ?? "unknown"}${loc.stateCode ? `, ${loc.stateCode}` : ""})`);

const existingNormalized = loadExistingNames(existingFirmsPath);
if (existingNormalized.size > 0) {
  console.error(`Loaded ${existingNormalized.size} existing firm name(s) for cross-run dedup.`);
}

const seen = new Set(existingNormalized);
const matchedExistingKeys = new Set();
const firms = [];
const pageLog = []; // each entry now carries a `term` field
let outsideRegionCount = 0;

for (const term of terms) {
  const query = `${term} ${geography}`;
  for (let page = 1; page <= maxPages; page++) {
    console.error(`Serper page ${page} for "${term}" ...`);
    const places = await serperMaps(query, loc.ll, page);
    let newUnique = 0;
    for (const p of places) {
      const key = normalizeFirmName(p.title);
      if (!key) continue;
      if (seen.has(key)) {
        if (existingNormalized.has(key)) matchedExistingKeys.add(key);
        continue;
      }
      seen.add(key);
      const firm = mapToFirm(p, segment, extractSearchMarket(geography), loc.stateCode);
      if (firm.outsideRegion) outsideRegionCount++;
      firms.push(firm);
      newUnique++;
    }
    pageLog.push({ term, page, returned: places.length, newUnique });
    if (places.length < PAGE_SIZE || newUnique === 0) break; // natural ceiling reached for this term
  }
}

const termSummary = terms
  .map((t) => {
    const rows = pageLog.filter((l) => l.term === t);
    const pages = rows.length;
    const newCount = rows.reduce((sum, r) => sum + r.newUnique, 0);
    return `"${t}" (${pages}p, ${newCount}new)`;
  })
  .join(" · ");

console.error(
  `Done. ${firms.length} new unique firm(s) across ${terms.length} term(s): ${termSummary}` +
    (matchedExistingKeys.size > 0 ? ` | skipped ${matchedExistingKeys.size} already in Airtable` : "") +
    (outsideRegionCount > 0 ? ` | ${outsideRegionCount} flagged outsideRegion` : "")
);

// JSON to stdout for the connector-write step
process.stdout.write(JSON.stringify(firms, null, 2) + "\n");
