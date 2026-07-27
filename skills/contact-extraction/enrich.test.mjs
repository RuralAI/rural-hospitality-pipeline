import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteUrlOf, domainFor, flattenMerged } from "./enrich.mjs";

test("websiteUrlOf reads the Airtable record shape", () => {
  assert.equal(
    websiteUrlOf({ id: "rec1", fields: { "website-url": "https://x.com" } }),
    "https://x.com",
  );
});

test("websiteUrlOf falls back through bare websiteUrl and website-url keys", () => {
  assert.equal(websiteUrlOf({ websiteUrl: "https://y.com" }), "https://y.com");
  assert.equal(websiteUrlOf({ "website-url": "https://z.com" }), "https://z.com");
  assert.equal(websiteUrlOf({}), "");
});

test("domainFor prefers the prior email's host over the website map", () => {
  const websiteById = new Map([["rec1", "https://other.com"]]);
  const domain = domainFor({ firm_id: "rec1", email: "hello@x.com" }, websiteById);
  assert.equal(domain, "x.com");
});

test("domainFor falls back to the website map when there is no prior email", () => {
  const websiteById = new Map([["rec1", "https://x.com"]]);
  const domain = domainFor({ firm_id: "rec1", email: null }, websiteById);
  assert.equal(domain, "x.com");
});

test("domainFor returns null when neither an email host nor a website is available", () => {
  const domain = domainFor({ firm_id: "rec1", email: null }, new Map());
  assert.equal(domain, null);
});

test("flattenMerged: a Hunter win produces status found, contact_source Hunter, names populated", () => {
  const merged = {
    contacts: [
      {
        firm_id: "rec1",
        firm_name: "Larkspur Events",
        fields: {
          "first-name": "Robin",
          "last-name": "Smith",
          title: "Owner",
          email: "robin@larkspurevents.example",
          "all-emails": "robin@larkspurevents.example\ninfo@larkspurevents.example",
          "email-verified": false,
          "contact-source": "Hunter",
          "firm-id": ["rec1"],
        },
      },
    ],
    skipped: [],
  };
  const v1 = [
    {
      firm_id: "rec1",
      firm_name: "Larkspur Events",
      status: "found",
      email: "info@larkspurevents.example",
      all_emails: ["info@larkspurevents.example"],
      scraped_at: "2026-07-14T00:00:00.000Z",
    },
  ];
  const [flat] = flattenMerged(merged, v1);
  assert.equal(flat.status, "found");
  assert.equal(flat.contact_source, "Hunter");
  assert.equal(flat.first_name, "Robin");
  assert.equal(flat.last_name, "Smith");
  assert.equal(flat.title, "Owner");
  assert.deepEqual(flat.all_emails, ["robin@larkspurevents.example", "info@larkspurevents.example"]);
  assert.equal(flat.email_verified, false);
  assert.equal(flat.scraped_at, "2026-07-14T00:00:00.000Z");
});

test("flattenMerged: a scraped-only win keeps contact_source Scraped and blank names", () => {
  const merged = {
    contacts: [
      {
        firm_id: "rec2",
        firm_name: "Solo Events",
        fields: {
          "first-name": "",
          "last-name": "",
          title: "",
          email: "jane@solo.com",
          "all-emails": "jane@solo.com",
          "email-verified": false,
          "contact-source": "Scraped",
          "firm-id": ["rec2"],
        },
      },
    ],
    skipped: [],
  };
  const v1 = [
    {
      firm_id: "rec2",
      firm_name: "Solo Events",
      status: "found",
      email: "jane@solo.com",
      all_emails: ["jane@solo.com"],
    },
  ];
  const [flat] = flattenMerged(merged, v1);
  assert.equal(flat.contact_source, "Scraped");
  assert.equal(flat.first_name, "");
  assert.deepEqual(flat.all_emails, ["jane@solo.com"]);
});

test("flattenMerged: a skipped firm becomes status needs_manual with the skip reason", () => {
  const merged = {
    contacts: [],
    skipped: [{ firm_id: "rec3", firm_name: "Summit Vows", reason: "no email in either file" }],
  };
  const v1 = [
    { firm_id: "rec3", firm_name: "Summit Vows", status: "needs_manual", email: null, all_emails: [] },
  ];
  const [flat] = flattenMerged(merged, v1);
  assert.equal(flat.status, "needs_manual");
  assert.equal(flat.email, null);
  assert.equal(flat.reason, "no email in either file");
  assert.equal(flat.contact_source, "Scraped");
});
