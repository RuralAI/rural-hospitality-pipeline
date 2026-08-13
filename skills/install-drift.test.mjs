/**
 * Drift check: install/<name>.skill must match skills/<name>/.
 *
 * `sync.test.mjs` guards the FIRST hop (src/ + config/ -> skills/). This guards
 * the SECOND hop (skills/ -> install/), which nothing covered before: the packaged
 * .skill files are what people download and install, so a skill edited without
 * `npm run package:skills` ships stale logic to every new installation while the
 * repo's own tests stay green. That happened once — a schema field added in
 * skills/ never reached install/client-onboarding.skill — hence this file.
 *
 * Reads the archives with `unzip`, the same tool scripts/package-skill.sh already
 * requires, so this adds no new dependency.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const INSTALL_DIR = join(REPO_ROOT, "install");

const REPACKAGE = "npm run package:skills";

// Mirror package-skill.sh's exclusions: it zips a skill folder's contents while
// excluding dotfiles (at any depth) and any nested .skill file, so neither ever
// makes it into an archive. Keep this in step with that script.
function isPackagedFile(name) {
  return !name.startsWith(".") && !name.endsWith(".skill");
}

/** Skill folders are the ones with a SKILL.md, same rule package-skill.sh uses. */
function skillNames() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort();
}

function unzip(args) {
  // Buffer output, not utf8: these are byte-for-byte comparisons.
  return execFileSync("unzip", args, { maxBuffer: 64 * 1024 * 1024 });
}

function archiveEntries(zipPath) {
  return unzip(["-Z1", zipPath])
    .toString("utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .sort();
}

test("unzip is available (package-skill.sh needs it too)", () => {
  // Fail loudly rather than skipping: a silently-skipped drift check is the
  // exact failure mode this file exists to prevent.
  assert.doesNotThrow(
    () => execFileSync("unzip", ["-v"], { stdio: "ignore" }),
    "`unzip` not found on PATH. It is required to verify install/*.skill contents.",
  );
});

test("every skill has a packaged .skill, and every .skill has a skill folder", () => {
  const skills = skillNames();
  const archives = readdirSync(INSTALL_DIR)
    .filter((f) => f.endsWith(".skill"))
    .map((f) => basename(f, ".skill"))
    .sort();

  const unpackaged = skills.filter((s) => !archives.includes(s));
  const orphaned = archives.filter((a) => !skills.includes(a));

  assert.deepEqual(
    unpackaged,
    [],
    `skills/ folders with no install/*.skill: ${unpackaged.join(", ")}. Run: ${REPACKAGE}`,
  );
  assert.deepEqual(
    orphaned,
    [],
    `install/*.skill with no skills/ folder (renamed or deleted skill?): ${orphaned.join(", ")}`,
  );
});

for (const name of skillNames()) {
  test(`install/${name}.skill matches skills/${name}/`, () => {
    const zipPath = join(INSTALL_DIR, `${name}.skill`);
    if (!existsSync(zipPath)) {
      assert.fail(`install/${name}.skill is missing. Run: ${REPACKAGE}`);
    }

    const expected = readdirSync(join(SKILLS_DIR, name), { withFileTypes: true })
      .filter((e) => e.isFile() && isPackagedFile(e.name))
      .map((e) => e.name)
      .sort();
    const actual = archiveEntries(zipPath);

    const missing = expected.filter((f) => !actual.includes(f));
    const extra = actual.filter((f) => !expected.includes(f));

    assert.deepEqual(
      missing,
      [],
      `install/${name}.skill is missing file(s) present in skills/${name}/: ` +
        `${missing.join(", ")}. Run: ${REPACKAGE}`,
    );
    assert.deepEqual(
      extra,
      [],
      `install/${name}.skill contains file(s) no longer in skills/${name}/: ` +
        `${extra.join(", ")}. Run: ${REPACKAGE}`,
    );

    for (const file of expected) {
      const onDisk = readFileSync(join(SKILLS_DIR, name, file));
      const inArchive = unzip(["-p", zipPath, file]);
      assert.ok(
        onDisk.equals(inArchive),
        `install/${name}.skill has a stale copy of ${file} — it differs from ` +
          `skills/${name}/${file}. Run: ${REPACKAGE}`,
      );
    }
  });
}
