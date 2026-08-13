import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { loadEmailTemplates } from "./email-templates-store.mjs";

const path = "/tmp/test-email-templates.json";

test("loadEmailTemplates keys records by segment and splits body into paragraphs", () => {
  writeFileSync(path, JSON.stringify([
    { subject: "Subj W", segment: "Wedding", body: "Para one {{travel}}\n\nPara two", "sign-off": "Warm regards," },
    { subject: "Subj C", segment: "Corporate", body: "Corp para {{firm}}", "sign-off": "Best," },
  ]));
  const templates = loadEmailTemplates(path);
  assert.deepEqual(templates.Wedding, {
    subject: "Subj W",
    segment: "Wedding",
    audience: "Agency",
    bodyParagraphs: ["Para one {{travel}}", "Para two"],
    signOff: "Warm regards,",
  });
  assert.equal(templates.Corporate.subject, "Subj C");
  unlinkSync(path);
});

test("loadEmailTemplates keys an In-house row separately from its segment's Agency row", () => {
  writeFileSync(path, JSON.stringify([
    { subject: "Agency copy", segment: "Corporate", audience: "Agency", body: "We came across {{firm}}your work.", "sign-off": "Best," },
    { subject: "In-house copy", segment: "Corporate", audience: "In-house", body: "A private option for your team.", "sign-off": "Best," },
  ]));
  const templates = loadEmailTemplates(path);
  // Both rows survive: an In-house row must never overwrite the Agency one.
  assert.equal(templates.Corporate.subject, "Agency copy");
  assert.equal(templates["Corporate In-house"].subject, "In-house copy");
  unlinkSync(path);
});

test("loadEmailTemplates treats a blank audience as Agency", () => {
  writeFileSync(path, JSON.stringify([
    { subject: "Subj C", segment: "Corporate", body: "Corp para", "sign-off": "Best," },
  ]));
  const templates = loadEmailTemplates(path);
  assert.equal(templates.Corporate.audience, "Agency");
  assert.equal(templates["Corporate In-house"], undefined);
  unlinkSync(path);
});

test("loadEmailTemplates also accepts raw Airtable record shape ({fields: {...}})", () => {
  writeFileSync(path, JSON.stringify([
    { id: "rec1", fields: { subject: "Subj W", segment: "Wedding", body: "One paragraph", "sign-off": "Best," } },
  ]));
  const templates = loadEmailTemplates(path);
  assert.equal(templates.Wedding.subject, "Subj W");
  unlinkSync(path);
});

test("loadEmailTemplates throws when the file is missing", () => {
  assert.throws(() => loadEmailTemplates("/tmp/does-not-exist-email-templates.json"), /voice-intake/);
});

test("loadEmailTemplates throws when the table is empty", () => {
  writeFileSync(path, JSON.stringify([]));
  assert.throws(() => loadEmailTemplates(path), /voice-intake/);
  unlinkSync(path);
});
