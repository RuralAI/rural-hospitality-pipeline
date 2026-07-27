// Authored skill glue (not synced). Prints the ordered Airtable provisioning
// plan for the given segments, sourced from the synced table-schema.mjs, so the
// client-onboarding provisioning step creates tables from an authoritative list.
//
// Usage: node plan-tables.mjs --segments Wedding,Corporate
import { buildTableDefinitions } from "./table-schema.mjs";

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const segments = flag("segments", "Wedding").split(",").map((s) => s.trim()).filter(Boolean);
const tables = buildTableDefinitions(segments);

const plan = {
  order: tables.map((t) => t.name),
  tables: tables.map((t) => ({
    name: t.name,
    fields: t.fields.map((f) => {
      const out = { name: f.name, type: f.type };
      if (f.linkTo) out.linkTo = f.linkTo;
      if (f.options) out.options = f.options;
      return out;
    }),
  })),
};

console.log(JSON.stringify(plan, null, 2));
