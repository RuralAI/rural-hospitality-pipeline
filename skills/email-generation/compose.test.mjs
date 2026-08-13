import { test } from "node:test";
import assert from "node:assert/strict";
import { createComposer } from "./compose.mjs";

const profile = {
  businessName: "Example Inn",
  location: "Rivertown, Colorado",
  signingName: "Alex Rivera",
  signature: { title: "Innkeeper", address: null, phone: null, website: null },
};

const templates = {
  Wedding: {
    subject: "Subj W",
    segment: "Wedding",
    bodyParagraphs: ["Hello. {{travel}}"],
    signOff: "Warm regards,",
  },
  Corporate: {
    subject: "Subj C",
    segment: "Corporate",
    bodyParagraphs: ["We came across {{firm}}your work."],
    signOff: "Best,",
  },
  "Corporate In-house": {
    subject: "Subj C in-house",
    segment: "Corporate",
    audience: "In-house",
    bodyParagraphs: ["A private option for your team. {{travel}}"],
    signOff: "Best,",
  },
};

const regionNaming = [{ regionId: "north_valley", anchorCity: "Northgate", aliases: [] }];

test("createComposer uses the stored Region Travel sentence when present", () => {
  const regionTravel = { north_valley: { Wedding: "Nonstop from Northgate." } };
  const compose = createComposer({ profile, templates, regionTravel, regionNaming });
  const draft = compose({ email: "a@b.com", firm: "", market: "Northgate", segment: "Wedding", name: "" });
  assert.match(draft.body, /Nonstop from Northgate\./);
});

test("createComposer falls back to the generic sentence when Region Travel has no row", () => {
  const compose = createComposer({ profile, templates, regionTravel: {}, regionNaming });
  const draft = compose({ email: "a@b.com", firm: "", market: "Northgate", segment: "Wedding", name: "" });
  assert.match(draft.body, /Example Inn sits in the heart of Rivertown, Colorado/);
});

test("createComposer falls back to the generic sentence when the market matches no Region Naming row (no leftover regions from another client)", () => {
  const regionTravel = { north_valley: { Wedding: "Nonstop from Northgate." } };
  const compose = createComposer({ profile, templates, regionTravel, regionNaming: [] });
  const draft = compose({ email: "a@b.com", firm: "", market: "Northgate", segment: "Wedding", name: "" });
  assert.match(draft.body, /Example Inn sits in the heart of Rivertown, Colorado/);
  assert.doesNotMatch(draft.body, /Nonstop from Northgate\./);
});

test("createComposer expands {{firm}} when a firm is known", () => {
  const compose = createComposer({ profile, templates, regionTravel: {} });
  const draft = compose({ email: "a@b.com", firm: "Acme Events", market: "Northgate", segment: "Corporate", name: "" });
  assert.match(draft.body, /We came across Acme Events and your work\./);
});

test("createComposer greets by first name when known, else 'Hello,'", () => {
  const compose = createComposer({ profile, templates, regionTravel: {} });
  const named = compose({ email: "a@b.com", firm: "", market: "Northgate", segment: "Wedding", name: "Sam" });
  assert.match(named.body, /^Hello Sam,/);
  const anon = compose({ email: "a@b.com", firm: "", market: "Northgate", segment: "Wedding", name: "" });
  assert.match(anon.body, /^Hello,/);
});

test("createComposer appends signature lines after the sign-off", () => {
  const compose = createComposer({ profile, templates, regionTravel: {} });
  const draft = compose({ email: "a@b.com", firm: "", market: "Northgate", segment: "Wedding", name: "" });
  const lines = draft.body.split("\n");
  assert.equal(lines.at(-2), "Alex Rivera");
  assert.equal(lines.at(-1), "Innkeeper");
});

test("createComposer throws when no template exists for the segment", () => {
  const compose = createComposer({ profile, templates: {}, regionTravel: {} });
  assert.throws(() => compose({ email: "a@b.com", segment: "Wedding" }), /No Email Templates record/);
});

test("createComposer defaults to the Wedding segment when none is given", () => {
  const compose = createComposer({ profile, templates, regionTravel: {}, defaultSegment: "Wedding" });
  const draft = compose({ email: "a@b.com", firm: "", market: "Northgate", name: "" });
  assert.equal(draft.subject, "Subj W");
});

// Audience selects the template variant. Regression: an Apollo-sourced contact
// (an HR director at an employer) was rendered with the Agency template, whose
// lead-in praises the reader's event-planning business. They do not have one, so
// the mail read as a mistake.
test("createComposer picks the In-house variant when audience is In-house", () => {
  const compose = createComposer({ profile, templates, regionTravel: {} });
  const out = compose({
    email: "hr@newcharter.example",
    firm: "New Charter",
    segment: "Corporate",
    audience: "In-house",
    name: "Sarah",
  });
  assert.equal(out.subject, "Subj C in-house");
  assert.ok(out.body.includes("A private option for your team."));
  // The agency lead-in must not appear: an employer does not plan events for others.
  assert.ok(!out.body.includes("We came across"));
});

test("createComposer treats a missing or Agency audience as the plain segment", () => {
  const compose = createComposer({ profile, templates, regionTravel: {} });
  const noAudience = compose({ email: "a@b.example", firm: "Larkspur", segment: "Corporate" });
  const agency = compose({ email: "a@b.example", firm: "Larkspur", segment: "Corporate", audience: "Agency" });
  assert.equal(noAudience.subject, "Subj C");
  assert.equal(agency.subject, "Subj C");
  assert.equal(noAudience.body, agency.body);
});

test("createComposer throws rather than sending Agency copy to an In-house contact", () => {
  const onlyAgency = { Corporate: templates.Corporate };
  const compose = createComposer({ profile, templates: onlyAgency, regionTravel: {} });
  assert.throws(
    () => compose({ email: "hr@x.example", segment: "Corporate", audience: "In-house" }),
    /Corporate In-house/,
  );
});

test("audience does not change the travel sentence, which is per region and segment", () => {
  const regionTravel = { north_valley: { Corporate: "Six nonstops a day from Northgate." } };
  const compose = createComposer({ profile, templates, regionTravel, regionNaming });
  const out = compose({
    email: "hr@x.example",
    market: "Northgate",
    segment: "Corporate",
    audience: "In-house",
  });
  assert.ok(out.body.includes("Six nonstops a day from Northgate."));
});
