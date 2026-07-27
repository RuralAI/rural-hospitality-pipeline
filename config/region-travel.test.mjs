import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveFallback,
  resolveTravelSentence,
  fallbackSentence,
} from "./region-travel.js";

// --- resolveFallback -------------------------------------------------------

test("resolveFallback returns the segment-specific transit-claim-free line", () => {
  assert.equal(resolveFallback("Wedding"), fallbackSentence.Wedding);
  assert.equal(resolveFallback("Corporate"), fallbackSentence.Corporate);
});

test("resolveFallback never lets Corporate inherit the Wedding wording", () => {
  // Regression: the wedding line mentions "destination wedding" and must never
  // surface in a corporate email.
  assert.notEqual(resolveFallback("Corporate"), fallbackSentence.Wedding);
  assert.match(resolveFallback("Wedding"), /destination wedding/);
  assert.doesNotMatch(resolveFallback("Corporate"), /wedding/i);
});

test("resolveFallback falls back to the generic line for unknown segments", () => {
  const generic = "Rivertown sits in the heart of the mountains.";
  assert.equal(resolveFallback("Birthday"), generic);
  assert.equal(resolveFallback(undefined), generic);
});

// --- resolveTravelSentence -------------------------------------------------

test("resolveTravelSentence returns the approved Wedding sentence for a verified region", () => {
  const s = resolveTravelSentence("north_valley", "Wedding");
  assert.match(s, /nonstop flight from Northgate/);
  assert.match(s, /couples in the North Valley/);
});

test("resolveTravelSentence returns the approved Corporate sentence for a verified region", () => {
  const s = resolveTravelSentence("north_valley", "Corporate");
  assert.match(s, /nonstop flight from Northgate/);
  assert.match(s, /North Valley team/);
  // Critically, it must not borrow the region's Wedding wording.
  assert.doesNotMatch(s, /couples/);
  assert.notEqual(s, fallbackSentence.Corporate);
});

test("resolveTravelSentence falls back for an unknown region_id", () => {
  assert.equal(resolveTravelSentence("atlantis", "Wedding"), fallbackSentence.Wedding);
  assert.equal(resolveTravelSentence(null, "Corporate"), fallbackSentence.Corporate);
});

test("resolveTravelSentence covers all four region profiles for Wedding", () => {
  for (const region of ["north_valley", "coastal", "southlands", "high_desert"]) {
    const s = resolveTravelSentence(region, "Wedding");
    assert.match(s, /Rivertown/);
    // Each region's approved Wedding copy differs from the bare fallback.
    assert.notEqual(s, fallbackSentence.Wedding);
  }
});

test("resolveTravelSentence covers all four region profiles for Corporate", () => {
  for (const region of ["north_valley", "coastal", "southlands", "high_desert"]) {
    const s = resolveTravelSentence(region, "Corporate");
    assert.match(s, /Rivertown/);
    // Each region's approved Corporate copy differs from the bare fallback...
    assert.notEqual(s, fallbackSentence.Corporate);
    // ...and never inherits the wedding-specific wording.
    assert.doesNotMatch(s, /couples|wedding/i);
  }
});
