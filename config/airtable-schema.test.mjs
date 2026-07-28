import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTableDefinitions, toCreateTablePayload } from "./airtable-schema.mjs";

const SEGMENTS = ["Wedding", "Corporate"];

test("returns the 8 core tables in dependency order (no Corporate segment)", () => {
  const names = buildTableDefinitions(["Wedding"]).map((t) => t.name);
  assert.deepEqual(names, [
    "Firms", "Contacts", "Outreach", "Email Templates",
    "Region Travel", "Region Naming", "Config", "Business Profile",
  ]);
});

test("Corporate segment appends a Corporate Research table after Business Profile", () => {
  const names = buildTableDefinitions(SEGMENTS).map((t) => t.name);
  assert.deepEqual(names, [
    "Firms", "Contacts", "Outreach", "Email Templates",
    "Region Travel", "Region Naming", "Config", "Business Profile",
    "Corporate Research",
  ]);
});

test("Corporate Research is omitted when Corporate is not a segment", () => {
  const names = buildTableDefinitions(["Wedding"]).map((t) => t.name);
  assert.ok(!names.includes("Corporate Research"));
});

test("Corporate Research carries the decision-maker profile fields", () => {
  const cr = buildTableDefinitions(SEGMENTS).find((t) => t.name === "Corporate Research");
  assert.deepEqual(cr.fields.map((f) => f.name), [
    "profile-label", "planner-type", "titles", "company-size",
    "industry-signals", "how-they-find-venues", "what-matters",
    "sourcing-path", "notes", "updated-at",
  ]);
});

test("Region Naming carries region-id, anchor-city, and aliases", () => {
  const rn = buildTableDefinitions(SEGMENTS).find((t) => t.name === "Region Naming");
  assert.deepEqual(rn.fields.map((f) => f.name), ["region-id", "anchor-city", "aliases"]);
});

test("every table's primary (first) field is a text field", () => {
  for (const t of buildTableDefinitions(SEGMENTS, { includeReview: true })) {
    assert.equal(t.fields[0].type, "singleLineText", `${t.name} primary must be text`);
  }
});

test("segment choices reflect the passed segments", () => {
  const tables = buildTableDefinitions(["Wedding"]);
  const firms = tables.find((t) => t.name === "Firms");
  const seg = firms.fields.find((f) => f.name === "segment");
  assert.deepEqual(seg.options.choices, [{ name: "Wedding" }]);
  const bp = tables.find((t) => t.name === "Business Profile");
  const bpSeg = bp.fields.find((f) => f.name === "segments");
  assert.equal(bpSeg.type, "multipleSelects");
  assert.deepEqual(bpSeg.options.choices, [{ name: "Wedding" }]);
});

test("link fields reference their target by table name", () => {
  const tables = buildTableDefinitions(SEGMENTS);
  const firmId = tables.find((t) => t.name === "Contacts").fields.find((f) => f.name === "firm-id");
  assert.equal(firmId.type, "multipleRecordLinks");
  assert.equal(firmId.linkTo, "Firms");
  const contactId = tables.find((t) => t.name === "Outreach").fields.find((f) => f.name === "contact-id");
  assert.equal(contactId.linkTo, "Contacts");
});

test("Business Profile carries the full signature + identity field set", () => {
  const bp = buildTableDefinitions(SEGMENTS).find((t) => t.name === "Business Profile");
  const names = bp.fields.map((f) => f.name);
  for (const expected of [
    "label", "business-name", "business-url", "location", "signing-name",
    "signature-title", "signature-address", "signature-phone", "signature-website",
    "capacity", "destination-airport-code", "destination-airport-name",
    "highlights", "corporate-highlights", "target-region-ids", "segments",
  ]) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
});

test("includeReview appends a Review table last", () => {
  const tables = buildTableDefinitions(SEGMENTS, { includeReview: true });
  // 8 core + Corporate Research + Review
  assert.equal(tables.length, 10);
  assert.equal(tables[tables.length - 1].name, "Review");
});

test("toCreateTablePayload resolves linkTo to linkedTableId", () => {
  const contacts = buildTableDefinitions(SEGMENTS).find((t) => t.name === "Contacts");
  const payload = toCreateTablePayload(contacts, { Firms: "tblFIRMS" });
  const firmId = payload.fields.find((f) => f.name === "firm-id");
  assert.equal(firmId.options.linkedTableId, "tblFIRMS");
  assert.ok(!("linkTo" in firmId));
});

test("toCreateTablePayload throws when a link target is unresolved", () => {
  const contacts = buildTableDefinitions(SEGMENTS).find((t) => t.name === "Contacts");
  assert.throws(() => toCreateTablePayload(contacts, {}), /Firms/);
});

test("Contacts.contact-source includes Apollo as a valid choice", () => {
  const contacts = buildTableDefinitions(SEGMENTS).find((t) => t.name === "Contacts");
  const contactSource = contacts.fields.find((f) => f.name === "contact-source");
  const names = contactSource.options.choices.map((c) => c.name);
  assert.deepEqual(names, ["Scraped", "Hunter", "Manual", "Apollo"]);
});
