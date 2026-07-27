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
