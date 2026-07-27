/**
 * Tests for Stage 02 contact extraction — pure helpers.
 * Run: npm test   (node --test, no framework dependency)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseSitemapUrls,
  isSitemapIndex,
  rankContactCandidates,
  buildUserAgent,
} from "./stage-02-extraction.js";

test("parseSitemapUrls extracts loc values from a urlset", () => {
  const xml = `<?xml version="1.0"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://x.com/</loc></url>
      <url><loc>https://x.com/contact</loc></url>
    </urlset>`;
  assert.deepEqual(parseSitemapUrls(xml), [
    "https://x.com/",
    "https://x.com/contact",
  ]);
});

test("parseSitemapUrls trims whitespace and decodes &amp;", () => {
  const xml = `<urlset><url><loc>
      https://x.com/a?b=1&amp;c=2
    </loc></url></urlset>`;
  assert.deepEqual(parseSitemapUrls(xml), ["https://x.com/a?b=1&c=2"]);
});

test("parseSitemapUrls returns [] for junk or empty input", () => {
  assert.deepEqual(parseSitemapUrls(""), []);
  assert.deepEqual(parseSitemapUrls("not xml at all"), []);
  assert.deepEqual(parseSitemapUrls(null), []);
});

test("isSitemapIndex distinguishes an index from a urlset", () => {
  assert.equal(isSitemapIndex(`<sitemapindex><sitemap><loc>https://x.com/s1.xml</loc></sitemap></sitemapindex>`), true);
  assert.equal(isSitemapIndex(`<urlset><url><loc>https://x.com/</loc></url></urlset>`), false);
  assert.equal(isSitemapIndex(""), false);
});

test("rankContactCandidates ranks contact/about slugs first", () => {
  const urls = [
    "https://x.com/",
    "https://x.com/portfolio",
    "https://x.com/about-me",
    "https://x.com/blog/some-wedding",
    "https://x.com/get-in-touch",
  ];
  const ranked = rankContactCandidates(urls, { firmDomain: "x.com" });
  assert.deepEqual(ranked.slice(0, 2), [
    "https://x.com/get-in-touch",
    "https://x.com/about-me",
  ]);
});

test("rankContactCandidates drops off-host URLs", () => {
  const urls = [
    "https://x.com/contact",
    "https://facebook.com/x/contact",
    "https://other.com/contact",
  ];
  const ranked = rankContactCandidates(urls, { firmDomain: "x.com" });
  assert.deepEqual(ranked, ["https://x.com/contact"]);
});

test("rankContactCandidates drops asset and non-contact noise", () => {
  const urls = [
    "https://x.com/logo.png",
    "https://x.com/styles.css",
    "https://x.com/gallery",
    "https://x.com/blog/post-1",
    "https://x.com/privacy-policy",
  ];
  const ranked = rankContactCandidates(urls, { firmDomain: "x.com" });
  assert.deepEqual(ranked, []);
});

test("rankContactCandidates caps the number returned", () => {
  const urls = Array.from({ length: 20 }, (_, i) => `https://x.com/contact-${i}`);
  const ranked = rankContactCandidates(urls, { firmDomain: "x.com" });
  assert.ok(ranked.length <= 4, `expected <= 4, got ${ranked.length}`);
});

test("buildUserAgent builds a UA string from business name and URL", () => {
  const ua = buildUserAgent({ businessName: "Example Inn", businessUrl: "https://www.example.com" });
  assert.equal(ua, "Mozilla/5.0 (compatible; ExampleInnBot/1.0; +https://www.example.com)");
});

test("buildUserAgent strips non-alphanumeric characters from the business name", () => {
  const ua = buildUserAgent({ businessName: "Sam's B&B, LLC", businessUrl: "https://example.com" });
  assert.equal(ua, "Mozilla/5.0 (compatible; SamsBBLLCBot/1.0; +https://example.com)");
});

test("buildUserAgent falls back to a generic name when businessName is missing", () => {
  const ua = buildUserAgent({ businessUrl: "https://example.com" });
  assert.equal(ua, "Mozilla/5.0 (compatible; OutreachBot/1.0; +https://example.com)");
});

test("buildUserAgent throws when businessUrl is missing", () => {
  assert.throws(() => buildUserAgent({ businessName: "Example Inn" }), /businessUrl/);
});

test("buildUserAgent throws when businessUrl is blank", () => {
  assert.throws(() => buildUserAgent({ businessName: "Example Inn", businessUrl: "  " }), /businessUrl/);
});
