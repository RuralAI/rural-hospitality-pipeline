import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { loadRegionTravel, resolveFallback, resolveTravelSentence } from "./region-travel-store.mjs";

const path = "/tmp/test-region-travel.json";

test("loadRegionTravel nests sentences by region then segment", () => {
  writeFileSync(path, JSON.stringify([
    { "region-id": "front_range", segment: "Wedding", sentence: "Nonstop from Denver." },
    { "region-id": "front_range", segment: "Corporate", sentence: "Straightforward for a Denver team." },
  ]));
  const travel = loadRegionTravel(path);
  assert.equal(travel.front_range.Wedding, "Nonstop from Denver.");
  assert.equal(travel.front_range.Corporate, "Straightforward for a Denver team.");
  unlinkSync(path);
});

test("loadRegionTravel returns {} when the file is missing (soft fallback, not a hard stop)", () => {
  assert.deepEqual(loadRegionTravel("/tmp/does-not-exist-region-travel.json"), {});
});

test("resolveFallback builds a no-transit-claim sentence from business name and location", () => {
  const wedding = resolveFallback("Example Inn", "Rivertown, Colorado", "Wedding");
  assert.match(wedding, /Example Inn/);
  assert.match(wedding, /Rivertown, Colorado/);
  assert.doesNotMatch(wedding, /flight|drive|nonstop/i);

  const corporate = resolveFallback("Example Inn", "Rivertown, Colorado", "Corporate");
  assert.notEqual(corporate, wedding);
  assert.doesNotMatch(corporate, /flight|drive|nonstop/i);
});

test("resolveFallback tolerates missing business name or location", () => {
  const sentence = resolveFallback(null, null, "Wedding");
  assert.equal(typeof sentence, "string");
  assert.ok(sentence.length > 0);
});

test("resolveTravelSentence returns the stored sentence when the region+segment exists", () => {
  const travel = { front_range: { Wedding: "Nonstop from Denver." } };
  const sentence = resolveTravelSentence(travel, "front_range", "Wedding", { businessName: "X", location: "Y" });
  assert.equal(sentence, "Nonstop from Denver.");
});

test("resolveTravelSentence falls back when the region is unknown", () => {
  const sentence = resolveTravelSentence({}, "unknown_region", "Wedding", { businessName: "X", location: "Y" });
  assert.match(sentence, /X/);
  assert.match(sentence, /Y/);
});

test("resolveTravelSentence falls back when regionId is null", () => {
  const sentence = resolveTravelSentence({}, null, "Wedding", { businessName: "X", location: "Y" });
  assert.match(sentence, /X/);
});
