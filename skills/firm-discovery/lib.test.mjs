// firm-discovery / lib.test.mjs
//
// Run with: node --test lib.test.mjs
//
// Covers ONLY the skill-specific helpers in lib.mjs (mapToFirm, loadExistingNames).
// The shared helpers now live in normalize.mjs, which is AUTO-GENERATED verbatim
// from src/lib/normalize.js and is already covered by src/lib/normalize.test.mjs —
// re-testing them here would just duplicate that suite and risk drifting from it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { mapToFirm, loadExistingNames, extractSearchMarket, resolveSearchTerms } from "./lib.mjs";
import { normalizeFirmName } from "./normalize.mjs";

describe("extractSearchMarket — city/market from a 'City ST' geography string", () => {
  test("single-word city keeps working", () => {
    assert.equal(extractSearchMarket("Denver CO"), "Denver");
  });

  test("does not truncate a two-word city to its first token (F22)", () => {
    assert.equal(extractSearchMarket("Santa Fe NM"), "Santa Fe");
  });

  test("does not truncate a two-word city with a comma before the state (F22)", () => {
    assert.equal(extractSearchMarket("Little Rock AR"), "Little Rock");
    assert.equal(extractSearchMarket("Little Rock, AR"), "Little Rock");
  });

  test("handles a three-word city", () => {
    assert.equal(extractSearchMarket("Colorado Springs CO"), "Colorado Springs");
  });

  test("falls back to the full trimmed string when there is no valid trailing state code", () => {
    assert.equal(extractSearchMarket("Denver"), "Denver");
    assert.equal(extractSearchMarket("  Rivertown  "), "Rivertown");
  });

  test("does not strip a trailing two-letter token that isn't a real state code", () => {
    assert.equal(extractSearchMarket("Washington DC"), "Washington");
    assert.equal(extractSearchMarket("Value XX"), "Value XX");
  });

  test("non-string input returns empty string", () => {
    assert.equal(extractSearchMarket(null), "");
    assert.equal(extractSearchMarket(undefined), "");
  });
});

describe("resolveSearchTerms — segment → search term list", () => {
  test("Wedding resolves to its single term", () => {
    assert.deepEqual(resolveSearchTerms("Wedding"), ["wedding planner"]);
  });

  test("Corporate resolves to three terms", () => {
    assert.deepEqual(resolveSearchTerms("Corporate"), [
      "corporate event planner",
      "corporate retreat planner",
      "destination management company",
    ]);
  });

  test("unknown segment throws", () => {
    assert.throws(() => resolveSearchTerms("Vendor"), /Unknown segment/);
  });
});

describe("mapToFirm — outsideRegion (state-level flag) + field shape", () => {
  const place = (overrides = {}) => ({
    title: "Test Firm",
    address: "1 Main St, Telluride, CO 81435",
    website: "https://example.com",
    type: "Wedding planner",
    ...overrides,
  });

  test("flags outsideRegion true when firm state differs from search state", () => {
    const firm = mapToFirm(place({ address: "1 Main St, Farmington, NM 87401" }), "Wedding", "Telluride", "CO");
    assert.equal(firm.outsideRegion, true);
  });

  test("does not flag when firm state matches search state", () => {
    const firm = mapToFirm(place(), "Wedding", "Telluride", "CO");
    assert.equal(firm.outsideRegion, false);
  });

  test("does not flag when firm state is undeterminable (per project rule: undeterminable = no flag)", () => {
    const firm = mapToFirm(place({ address: "no state info here" }), "Wedding", "Telluride", "CO");
    assert.equal(firm.outsideRegion, false);
  });

  test("does not flag when search state is undeterminable", () => {
    const firm = mapToFirm(place(), "Wedding", "Telluride", "");
    assert.equal(firm.outsideRegion, false);
  });

  test("prepends the warning to notes when flagged, per project rule (flag, never drop)", () => {
    const firm = mapToFirm(place({ address: "1 Main St, Farmington, NM 87401" }), "Wedding", "Telluride", "CO");
    assert.match(firm.notes, /^⚠ Outside CO/);
    assert.match(firm.notes, /Wedding planner/); // original note content preserved, not dropped
  });

  test("builds the correct Airtable field shape", () => {
    const firm = mapToFirm(place(), "Wedding", "Telluride", "CO");
    assert.deepEqual(Object.keys(firm).sort(), [
      "city-metro", "firm-name", "notes", "outsideRegion", "search-market",
      "segment", "source", "specialties", "website-url", "zip",
    ].sort());
  });
});

describe("loadExistingNames", () => {
  const tmpPath = "/tmp/lib-test-existing-firms.json";

  test("returns empty set when no path given", () => {
    assert.equal(loadExistingNames(null).size, 0);
  });

  test("returns empty set and logs, rather than throwing, when file doesn't exist", () => {
    assert.equal(loadExistingNames("/tmp/definitely-does-not-exist.json").size, 0);
  });

  test("returns empty set and logs, rather than throwing, on malformed JSON", () => {
    writeFileSync(tmpPath, "not valid json {{{");
    assert.equal(loadExistingNames(tmpPath).size, 0);
    unlinkSync(tmpPath);
  });

  test("returns empty set and logs, rather than throwing, when JSON isn't an array", () => {
    writeFileSync(tmpPath, JSON.stringify({ names: ["foo"] }));
    assert.equal(loadExistingNames(tmpPath).size, 0);
    unlinkSync(tmpPath);
  });

  test("loads and normalizes a valid array of names (dedup keys via the shared normalizeFirmName)", () => {
    writeFileSync(tmpPath, JSON.stringify(["The Wildflower Denver", "K2 Event Co."]));
    const result = loadExistingNames(tmpPath);
    assert.equal(result.size, 2);
    assert.ok(result.has(normalizeFirmName("The Wildflower Denver")));
    assert.ok(result.has(normalizeFirmName("K2 Event Co.")));
    unlinkSync(tmpPath);
  });

  test("cleanup left no stray tmp file", () => {
    assert.equal(existsSync(tmpPath), false);
  });
});
