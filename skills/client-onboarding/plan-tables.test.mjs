import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "plan-tables.mjs");

function run(args) {
  return JSON.parse(execFileSync("node", [script, ...args], { encoding: "utf8" }));
}

test("prints the plan in creation order for the given segments (Corporate adds Corporate Research)", () => {
  const plan = run(["--segments", "Wedding,Corporate"]);
  assert.deepEqual(plan.order, [
    "Firms", "Contacts", "Outreach", "Email Templates",
    "Region Travel", "Region Naming", "Config", "Business Profile",
    "Corporate Research",
  ]);
  const contacts = plan.tables.find((t) => t.name === "Contacts");
  assert.equal(contacts.fields.find((f) => f.name === "firm-id").linkTo, "Firms");
});

test("omits Corporate Research when Corporate is not a segment", () => {
  const plan = run(["--segments", "Wedding"]);
  assert.deepEqual(plan.order, [
    "Firms", "Contacts", "Outreach", "Email Templates",
    "Region Travel", "Region Naming", "Config", "Business Profile",
  ]);
});

test("defaults to Wedding when no --segments passed", () => {
  const plan = run([]);
  const firms = plan.tables.find((t) => t.name === "Firms");
  assert.deepEqual(firms.fields.find((f) => f.name === "segment").options.choices, [{ name: "Wedding" }]);
});
