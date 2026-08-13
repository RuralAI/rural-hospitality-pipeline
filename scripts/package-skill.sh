#!/usr/bin/env bash
#
# package-skill.sh — zip a skill folder into an installable .skill file.
#
# A .skill is just a zip of the skill's files with SKILL.md inside. This script
# builds one from skills/<name>/, placing every file at the ROOT of the archive
# (the layout Claude Desktop installs cleanly) and skipping junk like .DS_Store.
#
# Usage:
#   scripts/package-skill.sh <skill-name>       # one skill
#   scripts/package-skill.sh --all              # every skill under skills/
#
# Output: install/<name>.skill  (committed to the repo — this is what people download)
#
# Example:
#   scripts/package-skill.sh firm-discovery
#   → install/firm-discovery.skill  (upload this in Claude Desktop → Settings → Skills)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
INSTALL_DIR="$REPO_ROOT/install"

usage() {
  echo "Usage: scripts/package-skill.sh <skill-name> | --all" >&2
  echo "Available skills:" >&2
  for d in "$SKILLS_DIR"/*/; do
    [ -f "${d}SKILL.md" ] && echo "  - $(basename "$d")" >&2
  done
  exit 1
}

package_one() {
  local name="$1"
  local src="$SKILLS_DIR/$name"

  if [ ! -d "$src" ]; then
    echo "✗ No skill folder at skills/$name" >&2
    return 1
  fi
  if [ ! -f "$src/SKILL.md" ]; then
    echo "✗ skills/$name has no SKILL.md — every skill needs one" >&2
    return 1
  fi

  mkdir -p "$INSTALL_DIR"
  local out="$INSTALL_DIR/$name.skill"
  rm -f "$out"

  # Zip the folder CONTENTS at the archive root (not the folder itself), so the
  # archive holds SKILL.md/... directly. Exclude macOS/editor junk.
  ( cd "$src" && zip -q -r -X "$out" . -x '.*' -x '*/.*' -x '*.skill' )

  # Verify without a pipe: `unzip -l | grep -q` lets grep close the pipe on the
  # first match, which sends SIGPIPE to unzip; under `set -o pipefail` that makes
  # the pipeline "fail" even though SKILL.md was found (a race, worst on small
  # archives). Capture the listing first, then match it in memory.
  local listing
  listing="$(unzip -l "$out")"
  if ! grep -q 'SKILL.md' <<<"$listing"; then
    echo "✗ Built $out but SKILL.md is missing from it" >&2
    return 1
  fi

  echo "✓ install/$name.skill"
  grep -E '^\s+[0-9]' <<<"$listing" | awk '{print "    " $4}' || true
}

[ $# -eq 1 ] || usage

# Refuse to package from stale copies: generated skill files must match their
# canonical src/config sources (see scripts/sync-skills.mjs).
if ! node "$REPO_ROOT/scripts/sync-skills.mjs" --check >/dev/null 2>&1; then
  echo "✗ Generated skill files are out of sync with their sources." >&2
  echo "  Run: npm run sync:skills   (then commit), and package again." >&2
  exit 1
fi

if [ "$1" = "--all" ]; then
  for d in "$SKILLS_DIR"/*/; do
    [ -f "${d}SKILL.md" ] && package_one "$(basename "$d")"
  done
else
  package_one "$1"
fi
