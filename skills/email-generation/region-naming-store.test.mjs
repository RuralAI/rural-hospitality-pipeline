import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { loadRegionNaming, resolveRegionId } from "./region-naming-store.mjs";

const path = "/tmp/test-region-naming.json";

test("loadRegionNaming parses region-id, anchor-city, and newline-separated aliases", () => {
  writeFileSync(path, JSON.stringify([
    { "region-id": "front_range", "anchor-city": "Denver", aliases: "Boulder\nFort Collins" },
    { "region-id": "little_rock", "anchor-city": "Little Rock", aliases: "" },
  ]));
  const rows = loadRegionNaming(path);
  assert.deepEqual(rows, [
    { regionId: "front_range", anchorCity: "Denver", aliases: ["Boulder", "Fort Collins"] },
    { regionId: "little_rock", anchorCity: "Little Rock", aliases: [] },
  ]);
  unlinkSync(path);
});

test("loadRegionNaming returns [] when the file is missing (soft fallback, not a hard stop)", () => {
  assert.deepEqual(loadRegionNaming("/tmp/does-not-exist-region-naming.json"), []);
});

test("loadRegionNaming drops rows with no region-id", () => {
  writeFileSync(path, JSON.stringify([{ "anchor-city": "Denver" }]));
  assert.deepEqual(loadRegionNaming(path), []);
  unlinkSync(path);
});

test("resolveRegionId matches a multi-word anchor city (the F22-adjacent case: no truncation)", () => {
  const rows = [{ regionId: "northern_nm", anchorCity: "Santa Fe", aliases: ["Taos"] }];
  assert.equal(resolveRegionId("Santa Fe", rows), "northern_nm");
});

test("resolveRegionId matches on alias, not just anchor city", () => {
  const rows = [{ regionId: "front_range", anchorCity: "Denver", aliases: ["Boulder"] }];
  assert.equal(resolveRegionId("Boulder", rows), "front_range");
});

test("resolveRegionId is case-insensitive and matches as a substring", () => {
  const rows = [{ regionId: "front_range", anchorCity: "Denver", aliases: [] }];
  assert.equal(resolveRegionId("denver, colorado", rows), "front_range");
});

test("resolveRegionId returns null for a region not in this client's rows (no leftover regions from another client)", () => {
  const rows = [{ regionId: "front_range", anchorCity: "Denver", aliases: [] }];
  assert.equal(resolveRegionId("Little Rock", rows), null);
});

test("resolveRegionId returns null for empty/missing geography or rows", () => {
  assert.equal(resolveRegionId("", [{ regionId: "front_range", anchorCity: "Denver", aliases: [] }]), null);
  assert.equal(resolveRegionId("Denver", []), null);
  assert.equal(resolveRegionId("Denver", undefined), null);
});
