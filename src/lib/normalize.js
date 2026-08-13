/**
 * Shared normalization helpers for firm discovery. Canonical source: synced
 * verbatim into skills/firm-discovery/normalize.mjs (see skills/sync-manifest.json),
 * so dedup logic stays identical between this source and the bundled skill copy.
 */

// Only legal-entity boilerplate goes here — words that are interchangeable and
// never distinguish two real firms ("Larkspur Events LLC" == "Larkspur Events"; "Acme
// Co" == "Acme Company"). DO NOT add descriptive words like "events" or
// "weddings": they can be the distinguishing part of a name, so stripping them
// risks FALSE MERGES ("Bloom Events" and "Bloom Weddings" → "bloom"), which
// silently drops a real prospect. A missed dedup is a visible duplicate row the
// firm-review step catches; a false merge is invisible. Decision 2026-07-13 (A).
const SUFFIX_PATTERN = /\b(llc|inc|incorporated|co|company|corp|corporation|ltd|limited)\b/g;
const LEADING_THE = /^the\s+/;

/**
 * Normalize a firm name for dedup comparison. Five steps:
 *   1. lowercase
 *   2. trim
 *   3. collapse internal whitespace
 *   4. strip punctuation (anything that isn't a letter, digit, or whitespace)
 *   5. drop common business suffixes (LLC, Inc, Co, Ltd, ...) and leading "The"
 *
 * Returns "" for null/undefined/non-string input.
 */
export function normalizeFirmName(name) {
  if (typeof name !== "string") return "";
  let n = name.toLowerCase().trim();
  n = n.replace(/[^a-z0-9\s]/g, " ");
  n = n.replace(LEADING_THE, "");
  n = n.replace(SUFFIX_PATTERN, "");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

// Address parsing is anchored on the STATE segment, not on a zip.
//
// These once required the full ", CITY, ST 12345" shape, which a Google Maps
// listing frequently does not have: plenty carry no zip, no street line (the
// address begins with the city), or a spelled-out state. Any of those returned ""
// and the record arrived in review missing `city-metro` for no good reason.
//
// Splitting on commas and finding the state segment handles all three, and is
// easier to reason about than one regex trying to cover every shape.

const COUNTRY_SEGMENTS = new Set(["united states", "united states of america", "usa", "us"]);

// Built on first use: STATE_NAME_TO_CODE is declared further down the file, so
// reading it at module-evaluation time here would hit the temporal dead zone.
let stateCodes;
function isStateCode(s) {
  stateCodes ??= new Set(Object.values(STATE_NAME_TO_CODE));
  return stateCodes.has(s);
}

const ZIP_SUFFIX_RE = /\s*\b(\d{5})(?:-\d{4})?$/;

/**
 * The 2-letter code when a segment is *only* a state, optionally followed by a
 * zip: "CO", "CO 80202", "Colorado 80202". "" for anything else, so a street
 * line that happens to contain a state-like word is never mistaken for one.
 */
function stateFromSegment(segment) {
  const withoutZip = segment.replace(ZIP_SUFFIX_RE, "").trim();
  if (isStateCode(withoutZip)) return withoutZip;
  return stateNameToCode(withoutZip);
}

/**
 * Locate the state segment, searching from the end so a city named after a state
 * ("Kansas City, MO") cannot win over the real one. Returns the state code, the
 * zip that rode along with it, and the segment before it (the city).
 */
function parseAddress(address) {
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !COUNTRY_SEGMENTS.has(s.toLowerCase()));

  for (let i = parts.length - 1; i >= 0; i--) {
    const state = stateFromSegment(parts[i]);
    if (!state) continue;
    return {
      state,
      zip: parts[i].match(ZIP_SUFFIX_RE)?.[1] ?? "",
      city: i > 0 ? parts[i - 1] : "",
    };
  }
  return { state: "", zip: "", city: "" };
}

/**
 * Extract a 5-digit US zip from a freeform address string.
 * Prefers the zip attached to the state segment, so a 5-digit street number
 * ("12345 Main St, Denver, CO 80202") cannot be mistaken for one.
 * Returns "" if no zip is found.
 */
export function extractZip(address) {
  if (typeof address !== "string") return "";
  const { zip } = parseAddress(address);
  if (zip) return zip;
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
}

/**
 * Extract the city from a US-format address string: the segment before the state.
 * "123 Main St, Denver, CO 80216" → "Denver", "Aurora, CO 80011" → "Aurora",
 * "123 Main St, Denver, CO" → "Denver".
 * Returns "" when there is no state segment to anchor on, or nothing before it.
 */
export function extractCity(address) {
  if (typeof address !== "string") return "";
  return parseAddress(address).city;
}

/**
 * True when the given string is exactly a 5-digit US zip code.
 * Used by Stage 01 to classify whether a search query is zip-based
 * (populates `searchZip`) or city-based (populates `searchMarket`).
 */
export function isZipQuery(s) {
  return typeof s === "string" && /^\d{5}$/.test(s.trim());
}

/**
 * Extract the 2-letter US state code from a US-format address.
 * "..., Bayfield, CO 81122" → "CO". Returns "" when no STATE ZIP suffix.
 */
export function extractState(address) {
  if (typeof address !== "string") return "";
  return parseAddress(address).state;
}

const STATE_NAME_TO_CODE = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** Full US state name → 2-letter code (case-insensitive). "" when unknown. */
export function stateNameToCode(name) {
  if (typeof name !== "string") return "";
  return STATE_NAME_TO_CODE[name.trim().toLowerCase()] || "";
}

// Connector words kept lowercase in title-case unless they lead the name
// (so "district of columbia" → "District of Columbia", not "District Of Columbia").
const TITLE_MINOR_WORDS = new Set(["of", "and", "the"]);

function titleCaseStateName(name) {
  return name
    .split(" ")
    .map((w, i) =>
      i > 0 && TITLE_MINOR_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

// Reverse of STATE_NAME_TO_CODE: 2-letter code → canonical full name.
const STATE_CODE_TO_NAME = Object.fromEntries(
  Object.entries(STATE_NAME_TO_CODE).map(([name, code]) => [code, titleCaseStateName(name)]),
);

/** 2-letter US state code → full state name (case-insensitive). "" when unknown. */
export function stateCodeToName(code) {
  if (typeof code !== "string") return "";
  return STATE_CODE_TO_NAME[code.trim().toUpperCase()] || "";
}

/**
 * Expand a trailing 2-letter US state code in a free-text location to its full
 * name, so Nominatim disambiguates correctly ("Bayfield CO" → "Bayfield
 * Colorado"; Nominatim ignores the bare code). Preserves a comma separator if
 * present. Leaves inputs unchanged when the last token is not a US state code.
 */
export function expandStateCode(query) {
  if (typeof query !== "string") return "";
  const m = query.match(/^(.*?)(,?)\s+([A-Za-z]{2})\s*$/);
  if (!m) return query;
  const full = stateCodeToName(m[3]);
  if (!full) return query;
  return `${m[1]}${m[2]} ${full}`;
}
