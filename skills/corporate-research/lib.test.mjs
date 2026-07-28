// corporate-research / lib.test.mjs
//
// Run with: node --test lib.test.mjs
//
// Covers ONLY the skill-specific helpers in lib.mjs. normalizeFirmName is
// re-exported from normalize.mjs (AUTO-GENERATED from src/lib/normalize.js)
// and already covered by src/lib/normalize.test.mjs -- not re-tested here.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveOrganizationDomain, mapApolloCandidate, rankCandidatesForReveal } from "./lib.mjs";

describe("resolveOrganizationDomain — best-effort domain extraction", () => {
  test("prefers primary_domain when present", () => {
    assert.equal(
      resolveOrganizationDomain({ primary_domain: "acme.com", domain: "other.com" }),
      "acme.com",
    );
  });

  test("falls back to domain when primary_domain is absent", () => {
    assert.equal(resolveOrganizationDomain({ domain: "acme.com" }), "acme.com");
  });

  test("falls back to hostname derived from website_url", () => {
    assert.equal(
      resolveOrganizationDomain({ website_url: "https://www.acme.com/about" }),
      "acme.com",
    );
  });

  test("returns null when no usable field is present", () => {
    assert.equal(resolveOrganizationDomain({}), null);
    assert.equal(resolveOrganizationDomain(null), null);
  });

  test("returns null for an unparseable website_url instead of throwing", () => {
    assert.equal(resolveOrganizationDomain({ website_url: "not a url" }), null);
  });
});

describe("mapApolloCandidate — Apollo person+org -> Firm-shaped/Contact-shaped records", () => {
  const person = { first_name: "Jordan", last_name_obfuscated: "S.", title: "Head of People" };
  const organization = { name: "Acme Software", city: "Denver", website_url: "https://acme.com" };

  test("maps a masked (non-revealed) candidate", () => {
    const { firm, contact } = mapApolloCandidate(person, organization);
    assert.equal(firm["firm-name"], "Acme Software");
    assert.equal(firm["city-metro"], "Denver");
    assert.equal(firm.segment, "Corporate");
    assert.equal(firm.source, "Apollo");
    assert.match(firm.notes, /Head of People/);
    assert.equal(contact["first-name"], "Jordan");
    assert.equal(contact["last-name"], "S."); // obfuscated, not revealed
    assert.equal(contact.email, null);
    assert.equal(contact["contact-source"], "Apollo");
    assert.equal(contact["email-verified"], false);
  });

  test("uses revealed name/email when a People Match result is provided", () => {
    const revealed = { first_name: "Jordan", last_name: "Smith", email: "jordan@acme.com" };
    const { contact } = mapApolloCandidate(person, organization, revealed);
    assert.equal(contact["last-name"], "Smith");
    assert.equal(contact.email, "jordan@acme.com");
  });

  test("degrades gracefully when organization fields are missing", () => {
    const { firm } = mapApolloCandidate(person, {});
    assert.equal(firm["firm-name"], "");
    assert.equal(firm["city-metro"], "");
    assert.equal(firm["website-url"], "");
  });
});

describe("rankCandidatesForReveal — best data availability first", () => {
  test("ranks has_email+has_direct_phone above has_email-only above neither", () => {
    const low = { id: "1", has_email: false, has_direct_phone: false };
    const mid = { id: "2", has_email: true, has_direct_phone: false };
    const high = { id: "3", has_email: true, has_direct_phone: true };
    const ranked = rankCandidatesForReveal([low, mid, high], 3);
    assert.deepEqual(ranked.map((c) => c.id), ["3", "2", "1"]);
  });

  test("slices to the requested count", () => {
    const candidates = [{ id: "1" }, { id: "2" }, { id: "3" }];
    assert.equal(rankCandidatesForReveal(candidates, 2).length, 2);
  });
});
