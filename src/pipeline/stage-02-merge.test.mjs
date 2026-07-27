import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeContacts } from "./stage-02-merge.js";

// Minimal builders mirroring the real holding-file shapes.
function v1(firm_id, email, status = email ? "found" : "needs_manual") {
  return { firm_id, firm_name: `Firm ${firm_id}`, status, email, all_emails: email ? [email] : [] };
}
function hunter(firm_id, email, extra = {}) {
  return {
    firm_id,
    firm_name: `Firm ${firm_id}`,
    hunter_status: email ? "recovered" : "no_result",
    email,
    all_emails: email ? [email] : [],
    first_name: "",
    last_name: "",
    title: "",
    ...extra,
  };
}

test("fallback rule: Hunter no_result with null email falls back to v1 email, source Scraped", () => {
  const { contacts } = mergeContacts(
    [v1("recJunction", "hello@junctioneventsco.example")],
    [hunter("recJunction", null)],
  );
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].fields.email, "hello@junctioneventsco.example");
  assert.equal(contacts[0].fields["contact-source"], "Scraped");
});

test("Stonebridge rule: Hunter returned the same generic v1 had — v1 wins, source Scraped", () => {
  const { contacts } = mergeContacts(
    [v1("recStonebridge", "hello@stonebridgeweddingdesign.example")],
    [hunter("recStonebridge", "hello@stonebridgeweddingdesign.example")],
  );
  assert.equal(contacts[0].fields.email, "hello@stonebridgeweddingdesign.example");
  assert.equal(contacts[0].fields["contact-source"], "Scraped");
});

test("Meridian rule: v1 needs_manual (no email), Hunter generic — Hunter wins, source Hunter", () => {
  const { contacts } = mergeContacts(
    [v1("recMeridian", null)],
    [hunter("recMeridian", "info@meridianevents.example")],
  );
  assert.equal(contacts[0].fields.email, "info@meridianevents.example");
  assert.equal(contacts[0].fields["contact-source"], "Hunter");
});

test("Upgrade rule: v1 generic, Hunter personal — Hunter wins, names carried, generic kept in all-emails", () => {
  const { contacts } = mergeContacts(
    [v1("recRTC", "info@rivertowneventco.example")],
    [
      hunter("recRTC", "dana@rivertowneventco.example", {
        hunter_status: "upgraded",
        all_emails: ["dana@rivertowneventco.example", "info@rivertowneventco.example"],
        first_name: "Dana",
        last_name: "Smith",
        title: "Owner",
      }),
    ],
  );
  const f = contacts[0].fields;
  assert.equal(f.email, "dana@rivertowneventco.example");
  assert.equal(f["contact-source"], "Hunter");
  assert.equal(f["first-name"], "Dana");
  assert.equal(f["last-name"], "Smith");
  assert.equal(f.title, "Owner");
  assert.match(f["all-emails"], /info@rivertowneventco\.example/);
});

test("Hunter generic does NOT replace a different v1 generic (no improvement)", () => {
  const { contacts } = mergeContacts(
    [v1("recX", "hello@x.com")],
    [hunter("recX", "info@x.com")],
  );
  const f = contacts[0].fields;
  assert.equal(f.email, "hello@x.com");
  assert.equal(f["contact-source"], "Scraped");
  assert.match(f["all-emails"], /info@x\.com/); // still captured, not lost
});

test("Scraper-only firm (no Hunter record) passes through, source Scraped", () => {
  const { contacts } = mergeContacts([v1("recSolo", "jane@solo.com")], []);
  const f = contacts[0].fields;
  assert.equal(f.email, "jane@solo.com");
  assert.equal(f["contact-source"], "Scraped");
  assert.equal(f["first-name"], "");
});

test("contact fields carry the Airtable shape: link array, verified unchecked", () => {
  const { contacts } = mergeContacts([v1("recShape", "jane@shape.com")], []);
  const c = contacts[0];
  assert.equal(c.firm_id, "recShape");
  assert.equal(c.firm_name, "Firm recShape");
  assert.deepEqual(c.fields["firm-id"], ["recShape"]);
  assert.equal(c.fields["email-verified"], false);
});

test("Summit Vows rule: no email in either file — skipped, no contact", () => {
  const { contacts, skipped } = mergeContacts(
    [v1("recVows", null)],
    [hunter("recVows", null)],
  );
  assert.equal(contacts.length, 0);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].firm_id, "recVows");
  assert.equal(skipped[0].reason, "no email in either file");
});

test("all-emails union dedupes and puts the winner first", () => {
  const { contacts } = mergeContacts(
    [
      {
        firm_id: "recU",
        firm_name: "Firm recU",
        status: "found",
        email: "info@u.com",
        all_emails: ["info@u.com", "hello@u.com"],
      },
    ],
    [
      hunter("recU", "robin@u.com", {
        hunter_status: "upgraded",
        all_emails: ["robin@u.com", "info@u.com"],
      }),
    ],
  );
  assert.equal(
    contacts[0].fields["all-emails"],
    "robin@u.com\ninfo@u.com\nhello@u.com",
  );
});

test("v1 'found' record with falsy email is skipped, not crashed", () => {
  const { contacts, skipped } = mergeContacts(
    [{ firm_id: "recBad", firm_name: "Firm recBad", status: "found", email: "", all_emails: [] }],
    [],
  );
  assert.equal(contacts.length, 0);
  assert.equal(skipped.length, 1);
});
