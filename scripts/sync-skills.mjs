#!/usr/bin/env node
/**
 * sync-skills.mjs — regenerate the skill files that are copies of canonical
 * src/ or config/ sources, so the skills can never ship stale logic.
 *
 * The skills run in a sandbox that only contains the files zipped into the
 * .skill, so they can't import from src/ at runtime — they carry self-contained
 * copies. This script makes src/ the single source of truth: it copies each
 * source listed in skills/sync-manifest.json to its skill destination, stamping
 * an AUTO-GENERATED banner on .mjs files so nobody hand-edits them.
 *
 * It also stamps the release version from package.json into every
 * skills/<name>/SKILL.md, directly under the H1. That line is the only way an
 * operator can tell which build of a skill they installed, so it rides the same
 * two hops as the code (src/config → skills/ → install/) and is guarded by the same
 * two drift checks. See docs/versioning.md.
 *
 * Usage:
 *   node scripts/sync-skills.mjs           # regenerate the skill copies (write)
 *   node scripts/sync-skills.mjs --check   # verify they're in sync; exit 1 if not
 *
 * See docs/skills-bundled-copy-drift.md and the anti-drift design spec.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO_ROOT, "skills", "sync-manifest.json");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const check = process.argv.includes("--check");

function banner(from) {
  return (
    `// AUTO-GENERATED from ${from} by scripts/sync-skills.mjs — do not edit.\n` +
    `// Edit the source and re-run: npm run sync:skills\n\n`
  );
}

// Expected content for a destination: source bytes, with a banner prepended for
// .mjs and .js (JSON can't hold a comment, so it's copied verbatim).
function expectedContent(from, to) {
  const source = readFileSync(join(REPO_ROOT, from), "utf8");
  return to.endsWith(".mjs") || to.endsWith(".js") ? banner(from) + source : source;
}

// ─── Version stamp ────────────────────────────────────────────────────────────
// package.json is the single source for the pilot's release version. Every
// SKILL.md carries it on one line under the H1 so an installed skill can identify
// itself. The stamp is rewritten from scratch on each sync, so it is idempotent
// and hand-edits are reverted (and, in --check mode, reported).

const VERSION = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).version;
const STAMP = `**Version:** ${VERSION} · Center for Rural AI`;

// Matches a stamp of ANY version, so a bumped package.json shows up as drift
// rather than being appended alongside the old line. The optional second line
// retires the original two-line stamp: Claude's skill viewer renders HTML
// comments as visible text, so the maintainer note was showing up to operators.
const STAMP_RE = /^\*\*Version:\*\*[^\n]*\n(?:<!-- stamped by[^\n]*\n)?/m;

function expectedSkillMd(text, rel) {
  const lines = text.replace(STAMP_RE, "").split("\n");
  const h1 = lines.findIndex((l) => l.startsWith("# "));
  if (h1 === -1) {
    console.error(`✗ ${rel} has no H1 heading — cannot place the version stamp.`);
    process.exit(1);
  }
  const after = lines.slice(h1 + 1);
  while (after.length && after[0].trim() === "") after.shift();
  return [...lines.slice(0, h1 + 1), "", STAMP, "", ...after].join("\n");
}

function skillMarkdownFiles() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, "SKILL.md")))
    .map((e) => `skills/${e.name}/SKILL.md`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const stale = [];

for (const { from, to } of manifest) {
  const want = expectedContent(from, to);
  const dest = join(REPO_ROOT, to);

  if (check) {
    const have = existsSync(dest) ? readFileSync(dest, "utf8") : null;
    if (have !== want) stale.push({ to, reason: have === null ? "is missing" : `differs from ${from}` });
  } else {
    writeFileSync(dest, want);
    console.log(`  ✓ ${to}  ⟵  ${from}`);
  }
}

const skillDocs = skillMarkdownFiles();

for (const rel of skillDocs) {
  const dest = join(REPO_ROOT, rel);
  const have = readFileSync(dest, "utf8");
  const want = expectedSkillMd(have, rel);

  if (check) {
    if (have !== want) stale.push({ to: rel, reason: `is not stamped with version ${VERSION}` });
  } else if (have !== want) {
    writeFileSync(dest, want);
    console.log(`  ✓ ${rel}  ⟵  package.json version ${VERSION}`);
  }
}

const total = manifest.length + skillDocs.length;

if (check) {
  if (stale.length === 0) {
    console.log(`✓ all ${total} generated skill files are in sync (version ${VERSION})`);
    process.exit(0);
  }
  console.error("✗ skill files are out of sync with their sources:");
  for (const s of stale) console.error(`  - ${s.to} ${s.reason}`);
  console.error("\nFix: npm run sync:skills   (then commit the regenerated files)");
  process.exit(1);
}

console.log(`\nSynced ${manifest.length} skill file(s) from source, stamped ${skillDocs.length} SKILL.md at version ${VERSION}.`);
