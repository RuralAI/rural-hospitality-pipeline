import { test } from "node:test";
import assert from "node:assert/strict";
import client, { validateClientData, normalizeRegions } from "./client.js";

test("client default export preserves the expected shape and values", () => {
  assert.equal(client.businessName, "Example Inn");
  assert.equal(client.businessUrl, "https://www.example.com");
  assert.equal(client.location, "Rivertown, Colorado");
  assert.equal(client.signature.phone, "970 555 0100");
  assert.equal(client.propertyContext.capacity, "16 to 21 guests (full-property buyout)");
  assert.ok(Array.isArray(client.propertyContext.highlights) && client.propertyContext.highlights.length > 0);
  assert.deepEqual(client.segments, ["Wedding", "Corporate"]);
});

test("client retains operational config (not part of intake)", () => {
  assert.ok(Array.isArray(client.geoSeed));
  assert.equal(client.discoveryMaxPages, 3);
  assert.equal(client.discoverySearchTerms.Wedding, "wedding planner");
  assert.ok(Array.isArray(client.discoverySearchTerms.Corporate));
});

test("validateClientData returns the data when all required fields are present", () => {
  const good = {
    businessName: "X", businessUrl: "https://x.com", location: "Y",
    signingName: "Z", signature: { title: "t" }, propertyContext: { capacity: "c" },
    targetGeographies: ["A"], segments: ["Wedding"],
  };
  assert.equal(validateClientData(good), good);
});

test("validateClientData throws naming a missing required field", () => {
  const bad = { businessName: "X" };
  assert.throws(() => validateClientData(bad), /required field "businessUrl"/);
});

test("validateClientData throws on empty segments array", () => {
  const bad = {
    businessName: "X", businessUrl: "https://x.com", location: "Y",
    signingName: "Z", signature: { title: "t" }, propertyContext: { capacity: "c" },
    targetGeographies: ["A"], segments: [],
  };
  assert.throws(() => validateClientData(bad), /"segments"/);
});

test("normalizeRegions derives targetGeographies from targetRegions", () => {
  const r = normalizeRegions({ targetRegions: [{ metro: "Detroit" }, { metro: "Chicago", label: "Chicagoland" }] });
  assert.deepEqual(r.targetGeographies, ["Detroit", "Chicago"]);
  assert.equal(r.targetRegions.length, 2);
});

test("normalizeRegions synthesizes targetRegions from legacy targetGeographies", () => {
  const r = normalizeRegions({ targetGeographies: ["Detroit", "Chicago"] });
  assert.deepEqual(r.targetRegions, [{ metro: "Detroit" }, { metro: "Chicago" }]);
  assert.deepEqual(r.targetGeographies, ["Detroit", "Chicago"]);
});

test("client exposes targetRegions and a derived targetGeographies", () => {
  assert.deepEqual(client.targetGeographies, ["Northgate", "Baytown", "Southport", "Junction City"]);
  assert.equal(client.targetRegions[0].metro, "Northgate");
});

test("validateClientData requires a region source (targetRegions or legacy targetGeographies)", () => {
  const bad = {
    businessName: "X", businessUrl: "https://x.com", location: "Y",
    signingName: "Z", signature: { title: "t" }, propertyContext: { capacity: "c" },
    segments: ["Wedding"],
  };
  assert.throws(() => validateClientData(bad), /targetRegions/);
});
