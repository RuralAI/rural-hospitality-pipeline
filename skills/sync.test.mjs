// skills/sync.test.mjs
//
// Drift guardrail: fails `npm test` when a generated skill file is out of sync
// with its canonical src/config source (i.e. someone edited a source but didn't
// run `npm run sync:skills`). Picked up by the existing `node --test` glob.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("generated skill files are in sync with their src/config sources", () => {
  try {
    execFileSync("node", ["scripts/sync-skills.mjs", "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch (e) {
    assert.fail(
      "skill files are out of sync — run `npm run sync:skills` and commit:\n" +
        (e.stdout || "") + (e.stderr || ""),
    );
  }
});
