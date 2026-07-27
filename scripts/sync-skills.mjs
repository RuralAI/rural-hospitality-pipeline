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
 * Usage:
 *   node scripts/sync-skills.mjs           # regenerate the skill copies (write)
 *   node scripts/sync-skills.mjs --check   # verify they're in sync; exit 1 if not
 *
 * See docs/skills-bundled-copy-drift.md and the anti-drift design spec.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO_ROOT, "skills", "sync-manifest.json");
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

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const stale = [];

for (const { from, to } of manifest) {
  const want = expectedContent(from, to);
  const dest = join(REPO_ROOT, to);

  if (check) {
    const have = existsSync(dest) ? readFileSync(dest, "utf8") : null;
    if (have !== want) stale.push({ from, to, missing: have === null });
  } else {
    writeFileSync(dest, want);
    console.log(`  ✓ ${to}  ⟵  ${from}`);
  }
}

if (check) {
  if (stale.length === 0) {
    console.log(`✓ all ${manifest.length} generated skill files are in sync with their sources`);
    process.exit(0);
  }
  console.error("✗ skill files are out of sync with their sources:");
  for (const s of stale) {
    console.error(`  - ${s.to} ${s.missing ? "is missing" : "differs from"} ${s.from}`);
  }
  console.error("\nFix: npm run sync:skills   (then commit the regenerated files)");
  process.exit(1);
}

console.log(`\nSynced ${manifest.length} skill file(s) from their canonical sources.`);
