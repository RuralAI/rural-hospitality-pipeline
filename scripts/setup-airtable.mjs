/**
 * One-time setup script — creates the pipeline tables (Firms, Contacts,
 * Outreach, Email Templates, Region Travel, Region Naming, Config, and
 * Business Profile; plus Review in the with-review variant) in your Airtable
 * base with the correct field names and types.
 *
 * Usage:
 *   node --env-file=.env.local scripts/setup-airtable.mjs [--variant basic|with-review]
 *
 *   --variant basic        (default) Firms, Contacts, Outreach, Email Templates,
 *                          Region Travel, Region Naming, Config, and Business Profile.
 *   --variant with-review  the above plus a Review table for in-Airtable triage.
 *
 * Safe to re-run — tables that already exist are skipped.
 *
 * Requires a Personal Access Token with these scopes:
 *   schema.bases:read    — to check which tables already exist
 *   schema.bases:write   — to create tables and fields
 *   data.records:write   — already needed by the pipeline
 *
 * If your current AIRTABLE_API_KEY was created without schema scopes,
 * generate a new token at https://airtable.com/create/tokens and add
 * schema.bases:read + schema.bases:write to it.
 */

import client from "../config/client.js";
import { buildTableDefinitions, toCreateTablePayload } from "../config/airtable-schema.mjs";

const { AIRTABLE_API_KEY: apiKey, AIRTABLE_BASE_ID: baseId } = process.env;

if (!apiKey || !baseId) {
  console.error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID — check your .env.local");
  process.exit(1);
}

// Which template base variant to provision. `basic` is the default; `with-review`
// adds the Review triage table. Both variants include the Config table.
const VALID_VARIANTS = ["basic", "with-review"];
function parseVariant(argv) {
  const flagIndex = argv.findIndex((a) => a === "--variant" || a.startsWith("--variant="));
  if (flagIndex === -1) return "basic";
  const raw = argv[flagIndex];
  const value = raw.includes("=") ? raw.slice(raw.indexOf("=") + 1) : argv[flagIndex + 1];
  if (!VALID_VARIANTS.includes(value)) {
    console.error(
      `Unknown --variant "${value ?? ""}". Valid values are: ${VALID_VARIANTS.join(", ")}.`,
    );
    process.exit(1);
  }
  return value;
}

const variant = parseVariant(process.argv.slice(2));

const META_URL = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function getExistingTables() {
  const res = await fetch(META_URL, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not list tables: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.tables || [];
}

async function createTable(definition) {
  const res = await fetch(META_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(definition),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not create "${definition.name}": ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

async function addField(tableId, fieldDef) {
  const res = await fetch(`${META_URL}/${tableId}/fields`, {
    method: "POST",
    headers,
    body: JSON.stringify(fieldDef),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not add field "${fieldDef.name}": ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

async function ensureFields(tableId, tableName, existingFields, desiredFields) {
  const existingNames = new Set(existingFields.map((f) => f.name));
  const missing = desiredFields.filter((f) => !existingNames.has(f.name));
  if (missing.length === 0) {
    console.log(`  ✓ All fields present`);
    return;
  }
  for (const field of missing) {
    await addField(tableId, field);
    console.log(`  + Added field: ${field.name}`);
  }
}

async function run() {
  console.log(`Setting up Airtable base ${baseId}...\n`);

  const existing = await getExistingTables();
  const existingByName = Object.fromEntries(existing.map((t) => [t.name, t]));

  const includeReview = variant === "with-review";
  const definitions = buildTableDefinitions(client.segments, { includeReview });

  // table name -> id, seeded with tables that already exist so links resolve
  const tableIds = Object.fromEntries(existing.map((t) => [t.name, t.id]));

  for (const def of definitions) {
    const existingTable = existingByName[def.name];
    if (existingTable) {
      tableIds[def.name] = existingTable.id;
    }
  }

  for (const def of definitions) {
    const payload = toCreateTablePayload(def, tableIds); // resolves link ids
    const existingTable = existingByName[def.name];
    if (existingTable) {
      console.log(`✓ ${def.name} — already exists (${existingTable.id}), checking fields...`);
      await ensureFields(existingTable.id, def.name, existingTable.fields, payload.fields);
    } else {
      const table = await createTable(payload);
      tableIds[def.name] = table.id;
      console.log(`✓ ${def.name} — created (${table.id})`);
    }
  }

  console.log(`\nDone. Your Airtable base is ready for the pipeline (${variant} variant).`);
  if (variant === "with-review") {
    console.log("The Review table is present — its presence is what switches the operator into the in-Airtable triage flow (categorize + Keep/Review/Discard; Keep records promote to Firms).");
  } else {
    console.log("Basic variant: no Review table. Re-run with --variant with-review to add the in-Airtable triage flow.");
  }
  console.log("");
  console.log("One manual step remains (Airtable's API doesn't support creating Created-time fields):");
  console.log("  → Open the Firms table → click '+' to add a field → pick 'Created time' → name it 'discovered-date'");
}

run().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
});
