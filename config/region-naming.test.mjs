import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRegionId } from "./region-naming.js";

test("resolveRegionId matches each anchor city to its region_id", () => {
  assert.equal(resolveRegionId("Northgate"), "north_valley");
  assert.equal(resolveRegionId("Baytown"), "coastal");
  assert.equal(resolveRegionId("Southport"), "southlands");
  assert.equal(resolveRegionId("Junction City"), "high_desert");
});

test("resolveRegionId is case-insensitive and matches as a substring", () => {
  assert.equal(resolveRegionId("northgate co"), "north_valley");
  assert.equal(resolveRegionId("Northgate, Colorado"), "north_valley");
  assert.equal(resolveRegionId("BAYTOWN"), "coastal");
});

test("resolveRegionId returns null for unknown or empty geography", () => {
  assert.equal(resolveRegionId("Rivertown"), null);
  assert.equal(resolveRegionId("Lakeside CO"), null);
  assert.equal(resolveRegionId(""), null);
  assert.equal(resolveRegionId(null), null);
  assert.equal(resolveRegionId(undefined), null);
});

test("resolveRegionId tolerates non-string input without throwing", () => {
  assert.equal(resolveRegionId(42), null);
});

test("resolveRegionId matches a region alias, not just the anchor city", () => {
  assert.equal(resolveRegionId("Oakdale"), "north_valley");
  assert.equal(resolveRegionId("Pinecrest, CO"), "north_valley");
  assert.equal(resolveRegionId("Seaside"), "coastal");
  assert.equal(resolveRegionId("Fairview"), "southlands");
});

test("resolveRegionId still returns null for places that are neither anchor nor alias", () => {
  assert.equal(resolveRegionId("Rivertown"), null);
  assert.equal(resolveRegionId("Lakeside CO"), null);
});
