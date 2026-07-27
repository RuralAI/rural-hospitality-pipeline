#!/usr/bin/env node
// contact-extraction-spike / extract.mjs
//
// Standalone runner for the Stage 02 reliability spike.
// It wraps the REAL scrapeFirm from stage-02-extraction.mjs (Amy's core, copied
// verbatim; only the file extension was changed to .mjs so the ESM import
// resolves in a bare code-execution container). This runner adds ONLY: input
// loading, a resumable holding file, progress logging, and an optional graceful
// deadline. It does not touch the scrape logic.
//
// Usage:
//   node extract.mjs [--input firms.json] [--out stage-02-results.json]
//                    [--deadline-ms N] [--limit N]
//
// Two ways to run the spike:
//   1. No deadline (default): run the whole batch, see if one session finishes it.
//      node extract.mjs
//   2. Forced graceful chunking: stop cleanly after N ms, then re-run to resume.
//      node extract.mjs --deadline-ms 45000   (run this repeatedly)
//
// Input (firms.json): a JSON array. Each item may be any of these shapes:
//   { "firmId": "...", "firmName": "...", "websiteUrl": "..." }              (scrapeFirm shape)
//   { "id": "rec...", "fields": { "firm-name": "...", "website-url": "..." } } (Airtable record)
//   { "firm-name": "...", "website-url": "..." }                             (discover.mjs output)
// A missing firmId is synthesized from the normalized URL, so resumability is
// stable across re-runs as long as the input list is stable. For a faithful
// Checkpoint B (linking Contacts to Firms), feed firms that carry real Airtable
// record IDs (the "rec..." id), not discovery output.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { scrapeFirm, normalizeUrl, buildUserAgent } from "./stage-02-extraction.mjs";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
};
const inputPath = flag("input", "firms.json");
const outPath = flag("out", "stage-02-results.json");
const deadlineMs = parseInt(flag("deadline-ms", "0"), 10); // 0 = no deadline
const limit = parseInt(flag("limit", "0"), 10); // 0 = all

const profilePath = flag("profile", "business-profile.json");
if (!existsSync(profilePath)) {
  console.error(
    `No Business Profile found at ${profilePath}. Read the Business Profile table via the ` +
      `Airtable connector and write it to this file first (see SKILL.md step 0), or run the ` +
      `client-onboarding skill if the table is empty.`
  );
  process.exit(1);
}
const profileRaw = JSON.parse(readFileSync(profilePath, "utf8"));
let userAgent;
try {
  userAgent = buildUserAgent({
    businessName: profileRaw["business-name"],
    businessUrl: profileRaw["business-url"],
  });
} catch (err) {
  console.error(`Business Profile is missing a usable business-url: ${err.message}`);
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`No input file at ${inputPath}. Provide a firms.json array.`);
  process.exit(1);
}

// ---- normalize input to scrapeFirm's FirmInput ----------------------------
function toFirmInput(item, i) {
  const fields = item.fields || {};
  const firmName =
    item.firmName ?? item["firm-name"] ?? fields["firm-name"] ?? `firm-${i}`;
  const websiteUrl =
    item.websiteUrl ?? item["website-url"] ?? fields["website-url"] ?? "";
  const stable = normalizeUrl(websiteUrl) || firmName || `spike-${i}`;
  const firmId = item.firmId ?? item.id ?? stable;
  return { firmId, firmName, websiteUrl };
}

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(raw)) {
  console.error("Input must be a JSON array of firms.");
  process.exit(1);
}
let firms = raw.map(toFirmInput);
if (limit > 0) firms = firms.slice(0, limit);

// ---- resumable holding file (the mechanism under test) --------------------
let results = [];
if (existsSync(outPath)) {
  try {
    results = JSON.parse(readFileSync(outPath, "utf8"));
  } catch {
    results = [];
  }
  if (!Array.isArray(results)) results = [];
}
const done = new Set(results.map((r) => r.firm_id));
const pending = firms.filter((f) => !done.has(f.firmId));

console.error(
  `Input: ${firms.length} firms. Already done: ${done.size}. Pending this run: ${pending.length}.` +
    (deadlineMs ? ` Deadline: ${deadlineMs}ms.` : " No deadline.")
);

// ---- run ------------------------------------------------------------------
const start = Date.now();
let processed = 0;
let stoppedAtDeadline = false;

for (let i = 0; i < pending.length; i++) {
  if (deadlineMs && Date.now() - start > deadlineMs) {
    stoppedAtDeadline = true;
    break;
  }
  const firm = pending[i];
  const t0 = Date.now();
  const result = await scrapeFirm(firm, { userAgent }); // Amy's unchanged core
  results.push(result);
  writeFileSync(outPath, JSON.stringify(results, null, 2)); // crash-safe: written after every firm
  processed++;
  const detail =
    result.status === "found" ? result.email : result.reason || "needs_manual";
  console.error(
    `[${done.size + i + 1}/${firms.length}] ${firm.firmName} -> ${result.status} (${detail}) ${Date.now() - t0}ms`
  );
}

// ---- summary --------------------------------------------------------------
const totalDone = results.length;
const foundCount = results.filter((r) => r.status === "found").length;
const remaining = firms.length - totalDone;
const wall = ((Date.now() - start) / 1000).toFixed(1);

console.error(
  `\nProcessed ${processed} firm(s) this run in ${wall}s. ` +
    `Total done: ${totalDone}/${firms.length} (${foundCount} found). Remaining: ${remaining}.`
);
if (stoppedAtDeadline || remaining > 0) {
  console.error(
    `Stopped with ${remaining} remaining. Run again to continue (resumes via ${outPath}).`
  );
}

// full holding file to stdout for the connector-write step (Checkpoint B)
process.stdout.write(JSON.stringify(results, null, 2) + "\n");
