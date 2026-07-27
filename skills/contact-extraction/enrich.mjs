#!/usr/bin/env node
// contact-extraction / enrich.mjs
//
// Optional Stage 02 pass 2: Hunter Domain Search enrichment over the firms
// extract.mjs's scrape left weak (needs_manual, or a "found" generic
// shared-inbox address). Reads extract.mjs's holding file, queries Hunter
// for each weak firm, merges via the fallback rule (Hunter wins only if it
// improves on the scrape; a losing Hunter result still contributes its
// addresses, never lost — see merge.mjs), and writes a final holding file
// in the same flat shape extract.mjs already produces, so the skill's
// existing "write Contacts via the connector" step needs no change.
//
// A Hunter key is required to call the API (use --dry-run to preview
// targets without spending calls). Free tier (25/month) isn't meaningful at
// real volume; a paid plan (24K credits at the first tier) is what makes
// this pass useful in practice.
//
// Usage:
//   node enrich.mjs [--input firms.json] [--v1 stage-02-results.json]
//                   [--hunter-out stage-02-hunter-results.json]
//                   [--out stage-02-final.json] [--hunter-key KEY]
//                   [--max-calls 40] [--dry-run]
//
// Key resolution order: --hunter-key arg > HUNTER_API_KEY env > ./hunter.key file
//
// firms.json is the same file extract.mjs consumed (Airtable record shape).
// It's read here only to look up a needs_manual firm's website-url — the v1
// holding file carries no website for firms the scrape found nothing on.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extractDomain, isGenericEmail, selectBestContact } from "./stage-02-hunter.js";
import { mergeContacts } from "./merge.mjs";

// ---- pure helpers (exported for tests; no I/O) -----------------------------

export function websiteUrlOf(item) {
  const fields = item.fields || {};
  return item.websiteUrl ?? item["website-url"] ?? fields["website-url"] ?? "";
}

export function domainFor(target, websiteById) {
  if (target.email && target.email.includes("@")) {
    return extractDomain(`https://${target.email.split("@")[1]}`);
  }
  return extractDomain(websiteById.get(target.firm_id) || "");
}

/**
 * Convert mergeContacts's { contacts, skipped } (Airtable-fields-shaped)
 * back onto extract.mjs's flat ScrapeResult shape, so the write step reads
 * one consistent format whether or not this enrichment pass ran.
 */
export function flattenMerged(mergeResult, v1Records) {
  const v1ById = new Map(v1Records.map((r) => [r.firm_id, r]));
  const flat = [];

  for (const c of mergeResult.contacts) {
    const v1rec = v1ById.get(c.firm_id);
    flat.push({
      firm_id: c.firm_id,
      firm_name: c.firm_name,
      status: "found",
      email: c.fields.email,
      all_emails: c.fields["all-emails"] ? c.fields["all-emails"].split("\n") : [],
      email_verified: c.fields["email-verified"],
      contact_source: c.fields["contact-source"],
      first_name: c.fields["first-name"],
      last_name: c.fields["last-name"],
      title: c.fields.title,
      scraped_at: v1rec?.scraped_at ?? null,
    });
  }

  for (const s of mergeResult.skipped) {
    const v1rec = v1ById.get(s.firm_id);
    flat.push({
      firm_id: s.firm_id,
      firm_name: s.firm_name,
      status: "needs_manual",
      email: null,
      all_emails: [],
      email_verified: false,
      contact_source: "Scraped",
      first_name: "",
      last_name: "",
      title: "",
      scraped_at: v1rec?.scraped_at ?? null,
      reason: s.reason,
    });
  }

  return flat;
}

// ---- CLI --------------------------------------------------------------------

function loadJsonArray(path) {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

function resolveHunterKey(flag) {
  const fromArg = flag("hunter-key", null);
  if (fromArg) return fromArg.trim();
  if (process.env.HUNTER_API_KEY) return process.env.HUNTER_API_KEY.trim();
  if (existsSync("./hunter.key")) {
    const raw = readFileSync("./hunter.key", "utf8").trim();
    const m = raw.match(/HUNTER_API_KEY\s*=\s*(.+)/);
    return (m ? m[1] : raw).trim();
  }
  return null;
}

async function hunterDomainSearch(domain, apiKey) {
  const url =
    `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}` +
    `&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* leave body null */
  }
  return { status: res.status, body };
}

async function logRemainingCredits(apiKey) {
  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(apiKey)}`);
    const body = await res.json();
    console.error("Hunter account requests:", JSON.stringify(body?.data?.requests ?? body?.data ?? {}));
  } catch {
    console.error("(could not read Hunter account credits)");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
  };
  const inputPath = flag("input", "firms.json");
  const v1Path = flag("v1", "stage-02-results.json");
  const hunterOutPath = flag("hunter-out", "stage-02-hunter-results.json");
  const finalOutPath = flag("out", "stage-02-final.json");
  const maxCalls = parseInt(flag("max-calls", "40"), 10);
  const dryRun = args.includes("--dry-run");

  const v1 = loadJsonArray(v1Path);
  if (v1.length === 0) {
    console.error(`No v1 results at ${v1Path}. Run extract.mjs first.`);
    process.exit(1);
  }

  const rawFirms = loadJsonArray(inputPath);
  const websiteById = new Map(rawFirms.map((f) => [f.id ?? f.firmId, websiteUrlOf(f)]));

  const targets = v1.filter(
    (r) => r.status === "needs_manual" || (r.status === "found" && isGenericEmail(r.email)),
  );
  console.error(`Targets: ${targets.length} of ${v1.length} firm(s) (needs_manual + generic).`);

  if (dryRun) {
    for (const t of targets) {
      console.error(`  [dry-run] ${t.firm_name} -> domain ${domainFor(t, websiteById) || "(no domain)"}`);
    }
    console.error("\nDry run — no Hunter calls made.");
    return;
  }

  const apiKey = resolveHunterKey(flag);
  if (!apiKey) {
    console.error(
      "No Hunter key found. Provide one via --hunter-key, the HUNTER_API_KEY env var, or a ./hunter.key file.",
    );
    process.exit(1);
  }

  let hunterResults = loadJsonArray(hunterOutPath);
  const done = new Set(hunterResults.map((r) => r.firm_id));
  const todo = targets.filter((t) => !done.has(t.firm_id));
  console.error(`Already queried: ${done.size}. To query this run: ${todo.length}.`);

  let calls = 0;
  for (const t of todo) {
    if (calls >= maxCalls) {
      console.error(`\nReached --max-calls (${maxCalls}). Stopping; re-run to continue.`);
      break;
    }

    const domain = domainFor(t, websiteById);
    const base = { firm_id: t.firm_id, firm_name: t.firm_name };

    if (!domain) {
      hunterResults.push({ ...base, email: null, all_emails: [], reason: "no domain" });
      writeFileSync(hunterOutPath, JSON.stringify(hunterResults, null, 2));
      console.error(`  ${t.firm_name} -> no domain`);
      continue;
    }

    calls++;
    const { status, body } = await hunterDomainSearch(domain, apiKey);

    if (status === 429 || body?.errors?.some((e) => e.code === 429)) {
      console.error(`\nHunter usage limit / rate limit hit (HTTP ${status}). Saving progress and stopping.`);
      break;
    }
    if (status !== 200) {
      const reason = body?.errors?.[0]?.details || `HTTP ${status}`;
      hunterResults.push({ ...base, email: null, all_emails: [], reason });
      writeFileSync(hunterOutPath, JSON.stringify(hunterResults, null, 2));
      console.error(`  ${t.firm_name} -> error (${reason})`);
      continue;
    }

    const contact = selectBestContact(body);
    hunterResults.push({
      ...base,
      email: contact?.email ?? null,
      all_emails: contact?.all_emails ?? [],
      first_name: contact?.first_name ?? "",
      last_name: contact?.last_name ?? "",
      title: contact?.title ?? "",
      confidence: contact?.confidence ?? null,
      ...(contact ? {} : { reason: "no usable email from Hunter" }),
    });
    writeFileSync(hunterOutPath, JSON.stringify(hunterResults, null, 2));
    console.error(`  ${t.firm_name} -> ${contact ? contact.email : "no result"}`);
  }

  console.error(`\nHunter calls made this run: ${calls}.`);
  await logRemainingCredits(apiKey);

  const merged = mergeContacts(v1, hunterResults);
  const final = flattenMerged(merged, v1);
  writeFileSync(finalOutPath, JSON.stringify(final, null, 2));

  const foundCount = final.filter((r) => r.status === "found").length;
  const hunterWinCount = final.filter((r) => r.contact_source === "Hunter").length;
  console.error(
    `\nWrote ${finalOutPath}: ${final.length} firm(s), ${foundCount} found (${hunterWinCount} via Hunter).`,
  );

  process.stdout.write(JSON.stringify(final, null, 2) + "\n");
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("\nFATAL:", err);
    process.exit(1);
  });
}
