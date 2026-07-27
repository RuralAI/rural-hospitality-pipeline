import { test } from "node:test";
import assert from "node:assert/strict";

import { extractDomain } from "./stage-02-hunter.js";

test("extractDomain strips scheme and www, lowercases", () => {
  assert.equal(extractDomain("https://www.X.com/"), "x.com");
  assert.equal(extractDomain("x.com"), "x.com");
  assert.equal(extractDomain("http://sub.x.com/path"), "sub.x.com");
});

test("extractDomain returns null for junk", () => {
  assert.equal(extractDomain(""), null);
  assert.equal(extractDomain(null), null);
  assert.equal(extractDomain("not a url with spaces"), null);
});

import { isGenericEmail } from "./stage-02-hunter.js";

test("isGenericEmail flags shared-inbox prefixes", () => {
  assert.equal(isGenericEmail("info@x.com"), true);
  assert.equal(isGenericEmail("hello@x.com"), true);
  assert.equal(isGenericEmail("events@x.com"), true);
});

test("isGenericEmail treats named and business-gmail inboxes as non-generic", () => {
  assert.equal(isGenericEmail("jane@x.com"), false);
  assert.equal(isGenericEmail("summitvowsco@gmail.com"), false);
});

test("isGenericEmail is safe on junk input", () => {
  assert.equal(isGenericEmail(""), false);
  assert.equal(isGenericEmail(null), false);
  assert.equal(isGenericEmail("nope"), false);
});

import { selectBestContact } from "./stage-02-hunter.js";

test("selectBestContact ranks personal above generic", () => {
  const resp = { data: { emails: [
    { value: "info@x.com", type: "generic", confidence: 95, position: "" },
    { value: "jane@x.com", type: "personal", confidence: 80, first_name: "Jane", last_name: "Doe", position: "Owner" },
  ] } };
  const r = selectBestContact(resp);
  assert.equal(r.email, "jane@x.com");
  assert.equal(r.type, "personal");
  assert.equal(r.first_name, "Jane");
  assert.equal(r.title, "Owner");
  assert.deepEqual(r.all_emails, ["jane@x.com", "info@x.com"]);
});

test("selectBestContact boosts relevant titles over higher confidence", () => {
  const resp = { data: { emails: [
    { value: "amy@x.com", type: "personal", confidence: 90, position: "Accountant" },
    { value: "bob@x.com", type: "personal", confidence: 85, position: "Lead Wedding Planner" },
  ] } };
  assert.equal(selectBestContact(resp).email, "bob@x.com");
});

test("selectBestContact breaks ties by confidence", () => {
  const resp = { data: { emails: [
    { value: "a@x.com", type: "personal", confidence: 70, position: "" },
    { value: "b@x.com", type: "personal", confidence: 88, position: "" },
  ] } };
  assert.equal(selectBestContact(resp).email, "b@x.com");
});

test("selectBestContact returns the generic when that is all Hunter has", () => {
  const resp = { data: { emails: [
    { value: "info@x.com", type: "generic", confidence: 90 },
  ] } };
  const r = selectBestContact(resp);
  assert.equal(r.email, "info@x.com");
  assert.equal(r.type, "generic");
});

test("selectBestContact drops sub-floor addresses", () => {
  const resp = { data: { emails: [
    { value: "low@x.com", type: "personal", confidence: 30, position: "Owner" },
    { value: "info@x.com", type: "generic", confidence: 60 },
  ] } };
  assert.equal(selectBestContact(resp).email, "info@x.com");
});

test("selectBestContact returns null when nothing is usable", () => {
  assert.equal(selectBestContact({ data: { emails: [] } }), null);
  assert.equal(selectBestContact({}), null);
  assert.equal(selectBestContact({ data: { emails: [
    { value: "low@x.com", type: "personal", confidence: 10 },
  ] } }), null);
});

test("selectBestContact handles undefined/null input", () => {
  assert.equal(selectBestContact(undefined), null);
  assert.equal(selectBestContact(null), null);
});

test("selectBestContact respects a custom confidenceFloor", () => {
  const resp = { data: { emails: [
    { value: "x@x.com", type: "personal", confidence: 40, position: "Owner" },
  ] } };
  assert.equal(selectBestContact(resp), null); // default floor 50 drops it
  assert.equal(selectBestContact(resp, { confidenceFloor: 40 }).email, "x@x.com");
});

import { RELEVANT_TITLE_RE } from "./stage-02-hunter.js";

test("RELEVANT_TITLE_RE is exported and matches planner titles", () => {
  assert.equal(RELEVANT_TITLE_RE.test("Lead Wedding Planner"), true);
  assert.equal(RELEVANT_TITLE_RE.test("Owner"), true);
  assert.equal(RELEVANT_TITLE_RE.test("Accountant"), false);
});
