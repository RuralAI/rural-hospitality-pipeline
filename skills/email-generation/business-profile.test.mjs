import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { normalizeBusinessProfile, loadBusinessProfile } from "./business-profile.mjs";

test("normalizeBusinessProfile maps kebab-case Airtable fields to camelCase", () => {
  const raw = {
    "business-name": "Example Inn",
    "business-url": "https://www.example.com",
    "location": "Rivertown, Colorado",
    "signing-name": "Alex Rivera and Sam Rivera",
    "signature-title": "Innkeepers, Example Inn",
    "signature-address": "100 Main Street, Rivertown, CO 80000",
    "signature-phone": "970 555 0100",
    "signature-website": "www.example.com",
    "capacity": "16 to 21 guests",
    "destination-airport-code": "RVT",
    "destination-airport-name": "Rivertown Regional",
    "highlights": "Line one\nLine two",
    "corporate-highlights": "Corp line one",
    "target-region-ids": "north_valley\ncoastal",
    "segments": ["Wedding", "Corporate"],
  };
  const profile = normalizeBusinessProfile(raw);
  assert.equal(profile.businessName, "Example Inn");
  assert.equal(profile.businessUrl, "https://www.example.com");
  assert.equal(profile.location, "Rivertown, Colorado");
  assert.equal(profile.signingName, "Alex Rivera and Sam Rivera");
  assert.deepEqual(profile.signature, {
    title: "Innkeepers, Example Inn",
    address: "100 Main Street, Rivertown, CO 80000",
    phone: "970 555 0100",
    website: "www.example.com",
  });
  assert.equal(profile.capacity, "16 to 21 guests");
  assert.deepEqual(profile.destinationAirport, { code: "RVT", name: "Rivertown Regional" });
  assert.deepEqual(profile.highlights, ["Line one", "Line two"]);
  assert.deepEqual(profile.corporateHighlights, ["Corp line one"]);
  assert.deepEqual(profile.targetRegionIds, ["north_valley", "coastal"]);
  assert.deepEqual(profile.segments, ["Wedding", "Corporate"]);
});

test("normalizeBusinessProfile defaults missing fields to null/empty, never throws", () => {
  const profile = normalizeBusinessProfile({});
  assert.equal(profile.businessName, null);
  assert.equal(profile.businessUrl, null);
  assert.deepEqual(profile.highlights, []);
  assert.deepEqual(profile.segments, []);
});

test("loadBusinessProfile reads and normalizes a real file", () => {
  const path = "/tmp/test-business-profile-load.json";
  writeFileSync(path, JSON.stringify({ "business-name": "Test Co", "business-url": "https://example.com" }));
  const profile = loadBusinessProfile(path);
  assert.equal(profile.businessName, "Test Co");
  unlinkSync(path);
});

test("loadBusinessProfile throws a client-onboarding hard-stop message when the file is missing", () => {
  const path = "/tmp/test-business-profile-does-not-exist.json";
  assert.equal(existsSync(path), false);
  assert.throws(() => loadBusinessProfile(path), /client-onboarding/);
});
