/**
 * Shared normalization helpers used by Stage 01 discovery and the audit
 * promote endpoint. Keeps dedup logic identical across both code paths.
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

/**
 * Extract a 5-digit US zip from a freeform address string.
 * Returns "" if no zip is found.
 */
export function extractZip(address) {
  if (typeof address !== "string") return "";
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
}

/**
 * Extract the city from a US-format address string.
 * Matches the segment immediately before the state code + zip,
 * so "123 Main St, Denver, CO 80216" → "Denver" and
 * "457 Mountain Village Blvd, Telluride, CO 81435" → "Telluride".
 * Returns "" when no match (e.g. address has no STATE ZIP suffix).
 */
export function extractCity(address) {
  if (typeof address !== "string") return "";
  const m = address.match(/,\s*([^,]+?),\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/);
  return m ? m[1].trim() : "";
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
  const m = address.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  return m ? m[1] : "";
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
