#!/usr/bin/env node
// corporate-research / apollo-search.mjs
//
// Track A discovery: search Apollo's People Search API for in-house
// decision-makers (Head of People, Executive Assistant, Office Manager,
// etc.) at companies matching a target employee-count range and location.
// Free endpoint -- costs zero Apollo credits. No imports beyond the bundled
// ./lib.mjs and ./normalize.mjs: self-contained so it runs inside claude.ai
// code execution, same convention as firm-discovery/discover.mjs.
//
// Usage:
//   node apollo-search.mjs --titles "Head of People,Office Manager" \
//     --location "Denver, CO" --employee-range "20,150" \
//     [--per-page 25] [--existing-firms existing-firms.json] [--apollo-key KEY]
//
// Key resolution order: --apollo-key arg > APOLLO_API_KEY env > ./apollo.key file
//
// --existing-firms points to a JSON array of firm-name strings already in
// Airtable (fetch these via the Airtable connector before running this
// script) -- same cross-run dedup pattern as discover.mjs.
//
// The People Search endpoint, auth header, and parameter names below
// (person_titles[], organization_locations[], organization_num_employees_ranges[],
// page, per_page) were confirmed against Apollo's own published docs
// (docs.apollo.io) during design -- not assumed.
//
// CONFIRMED LIVE 2026-08-12: a first call with --employee-range "20,200" was
// accepted and returned 25 candidates, so the "MIN,MAX" string this script passes
// through is the format organization_num_employees_ranges[] expects. The earlier
// honesty flag warning that the format was unverified is resolved.
//
// Also observed on that run, and NOT a bug in this script: Apollo's title matching
// returned only People/HR leadership and Chief of Staff out of six titles queried.
// Executive Assistant, Office Manager, and Operations Lead came back empty. Whether
// that is Apollo's matching, its coverage of admin roles, or real scarcity at this
// company size is unresolved -- see the Known limitations note in SKILL.md.
// See docs/superpowers/specs/2026-07-27-apollo-track-a-integration-design.md.

import { readFileSync, existsSync } from "node:fs";
import { normalizeFirmName } from "./normalize.mjs";
import { mapApolloCandidate, rankCandidatesForReveal } from "./lib.mjs";

// ---- arg parsing ------------------------------------------------------------

const args = process.argv.slice(2);
const getFlag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
};

const titles = (getFlag("titles", "") || "").split(",").map((t) => t.trim()).filter(Boolean);
const location = getFlag("location", null);
const employeeRange = getFlag("employee-range", null);
const perPage = parseInt(getFlag("per-page", "25"), 10);
const existingFirmsPath = getFlag("existing-firms", null);
const revealCount = parseInt(getFlag("reveal", "0"), 10);

if (titles.length === 0 || !location || !employeeRange) {
  console.error(
    'Usage: node apollo-search.mjs --titles "Title1,Title2" --location "City, ST" --employee-range "MIN,MAX" [--per-page 25] [--existing-firms FILE] [--reveal N] [--apollo-key KEY]',
  );
  process.exit(1);
}

// ---- key resolution ---------------------------------------------------------

function resolveApolloKey() {
  const fromArg = getFlag("apollo-key", null);
  if (fromArg) return fromArg.trim();
  if (process.env.APOLLO_API_KEY) return process.env.APOLLO_API_KEY.trim();
  if (existsSync("./apollo.key")) {
    const raw = readFileSync("./apollo.key", "utf8").trim();
    const m = raw.match(/APOLLO_API_KEY\s*=\s*(.+)/);
    return (m ? m[1] : raw).trim();
  }
  return null;
}
const apolloKey = resolveApolloKey();
if (!apolloKey) {
  console.error(
    "No Apollo key found. Provide one via --apollo-key, the APOLLO_API_KEY env var, or a ./apollo.key file.",
  );
  process.exit(1);
}

// ---- existing-firms dedup ---------------------------------------------------

function loadExistingNames(path) {
  if (!path) return new Set();
  if (!existsSync(path)) {
    console.error(`--existing-firms file not found: ${path}. Proceeding without cross-run dedup.`);
    return new Set();
  }
  let names;
  try {
    names = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(`Could not parse ${path} as JSON. Proceeding without cross-run dedup.`);
    return new Set();
  }
  if (!Array.isArray(names)) {
    console.error(`${path} did not contain a JSON array of names. Proceeding without cross-run dedup.`);
    return new Set();
  }
  return new Set(names.map(normalizeFirmName).filter(Boolean));
}
const existingNormalized = loadExistingNames(existingFirmsPath);

// ---- Apollo People Search (free) --------------------------------------------

async function peopleSearch(page) {
  const params = new URLSearchParams();
  for (const t of titles) params.append("person_titles[]", t);
  params.append("organization_locations[]", location);
  params.append("organization_num_employees_ranges[]", employeeRange);
  params.append("page", String(page));
  params.append("per_page", String(perPage));

  const res = await fetch(`https://api.apollo.io/api/v1/mixed_people/api_search?${params.toString()}`, {
    method: "POST",
    headers: { "X-Api-Key": apolloKey },
  });
  if (res.status === 429) {
    throw new Error("Apollo rate limit hit (HTTP 429). Stopping -- re-run later.");
  }
  if (!res.ok) {
    throw new Error(`Apollo People Search error: HTTP ${res.status}`);
  }
  return res.json();
}

// ---- Apollo People Match (credit-consuming) ---------------------------------

async function peopleMatch(id) {
  const res = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apolloKey,
    },
    body: JSON.stringify({ id }),
  });
  // Auth, rate-limit, and any other non-OK response are not "no match" --
  // surface them the same way peopleSearch() does (thrown, uncaught, stops
  // the whole script) so a bad key, a 429, or a server error (500/502/503)
  // on the first --reveal candidate doesn't get silently relogged as "no
  // match found" for every subsequent candidate. The only falsy return is a
  // genuine 200 OK with no person on the body -- that's real information
  // (Apollo has no match), not a failure.
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Apollo rejected the key for People Match (HTTP ${res.status}). Check APOLLO_API_KEY.`);
  }
  if (res.status === 429) {
    throw new Error("Apollo rate limit hit on People Match (HTTP 429). Stopping reveal -- re-run later.");
  }
  if (!res.ok) {
    throw new Error(`Apollo People Match error: HTTP ${res.status}`);
  }
  const body = await res.json();
  return body?.person ?? null; // genuine non-match: 200 OK, no person -- real info, not a failure
}

// ---- run --------------------------------------------------------------------

console.error(
  `Searching Apollo: titles=[${titles.join(", ")}] location="${location}" employee-range="${employeeRange}" ...`,
);

const page1 = await peopleSearch(1);
const rawPeople = page1?.people ?? [];
console.error(`Apollo returned ${rawPeople.length} candidate(s) (page 1, zero credits).`);

const seen = new Set(existingNormalized);
const matchedExistingKeys = new Set();
const candidates = [];

for (const person of rawPeople) {
  const org = person.organization;
  const key = normalizeFirmName(org?.name);
  if (!key) continue;
  if (seen.has(key)) {
    if (existingNormalized.has(key)) matchedExistingKeys.add(key);
    continue;
  }
  seen.add(key);
  candidates.push({ person, organization: org });
}

const revealedByPersonId = new Map();
if (revealCount > 0) {
  const toReveal = rankCandidatesForReveal(candidates.map((c) => c.person), revealCount);

  let credits = 0;
  for (const p of toReveal) {
    const revealed = await peopleMatch(p.id);
    if (revealed?.email) {
      revealedByPersonId.set(p.id, revealed);
      const cost = revealed.phone_number ? 9 : 1;
      credits += cost;
      console.error(`  revealed ${revealed.first_name} ${revealed.last_name} <${revealed.email}> (+${cost} credit(s))`);
    } else {
      console.error(`  ${p.first_name} ${p.last_name_obfuscated} -> no match found`);
    }
  }
  console.error(`\nReveal spent ~${credits} credit(s) across ${toReveal.length} attempt(s).`);
}

const records = candidates.map(({ person, organization }) =>
  mapApolloCandidate(person, organization, revealedByPersonId.get(person.id) || null),
);

console.error(
  `\nDone. ${records.length} new candidate(s)` +
    (matchedExistingKeys.size > 0 ? ` | skipped ${matchedExistingKeys.size} already in Airtable` : "") +
    (revealCount > 0 ? ` | ${revealedByPersonId.size} revealed` : " | zero credits spent (no --reveal)"),
);

process.stdout.write(JSON.stringify(records, null, 2) + "\n");
