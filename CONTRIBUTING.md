# Contributing

> **Who this is for:** the CRAI team maintaining this pilot.

## Before you change anything

Read [docs/versioning.md](docs/versioning.md) and
[docs/skills-bundled-copy-drift.md](docs/skills-bundled-copy-drift.md). Most
questions about how to make a change, and why the build works the way it does, are
answered there.

## Repo layout and source of truth

Unlike a typical CRAI pilot, this repo has a real build step: code travels through
**three tiers**, and two of them are generated. Knowing which tier you are editing is
the single thing a new contributor gets wrong.

```
src/        canonical pipeline logic          -- hand-edited
config/     canonical per-client config       -- hand-edited
skills/     each skill's runtime files         -- MIXED, see below
install/    packaged .skill files              -- 100% generated, never hand-edited
docs/       setup guides, reference, standards -- hand-edited
```

`skills/` is not uniformly one or the other. Inside every `skills/<name>/` folder:

- **`SKILL.md` is always hand-authored directly in `skills/`.** It is never
  generated; there is no canonical source for it anywhere else.
- **Files listed as a `to:` target in [`skills/sync-manifest.json`](skills/sync-manifest.json)
  are generated.** `npm run sync:skills` regenerates them verbatim from their `from:`
  source in `src/` or `config/`. Hand-editing one of these directly is invisible
  until `npm test` catches the drift, and the fix is always "edit the source, then
  re-sync," never "edit the copy."
- **Everything else under `skills/<name>/` is skill-only glue, hand-edited directly
  in `skills/`.** CLI runners like `discover.mjs`, `extract.mjs`, `compose.mjs`,
  Airtable-facing stores like `business-profile.mjs`, and their `*.test.mjs` files
  have no canonical counterpart elsewhere. That is legitimate, not an oversight:
  they exist only because the skill needs them, not because someone forgot to
  extract them into `src/`.
- **One file is neither:** `firm-discovery/lib.mjs` and `corporate-research/lib.mjs`
  are a hand-flattened *subset* of `src/lib/normalize.js` plus skill-specific geo
  helpers, maintained by hand in both places at once. It has already drifted once.
  See [docs/skills-bundled-copy-drift.md](docs/skills-bundled-copy-drift.md) for why
  this one is harder to keep in sync than a clean generated copy.

`install/*.skill` has no exceptions: every archive is 100% generated from its
`skills/<name>/` folder by `npm run package:skills`, and is never hand-edited. It is
a zip file, not a text file to patch.

```bash
npm run sync:skills        # regenerate bundled copies from src/ + config/  (hop 1)
npm run sync:skills:check  # fail on drift, no write                        (hop 1)
npm run package:skills     # rebuild install/*.skill from skills/           (hop 2)
npm test                   # unit tests + both drift checks (Node built-in runner)
```

**Package before you test.** The hop-2 drift check compares `install/` against
`skills/`, so testing first just reports a stale-archive failure that repackaging is
what actually fixes.

`config/airtable-schema.mjs` is the single source for the Airtable table/field
schema. It has two consumers: `scripts/setup-airtable.mjs` (local provisioning) and,
via sync, `client-onboarding`'s connector-based provisioning. A schema change needs
both paths considered, not just the one you happened to test.

## Cutting a release

See [docs/versioning.md](docs/versioning.md), "Cutting a release", for the full
procedure: bump `package.json`, move `[Unreleased]` into a dated heading, sync,
package, `npm test`, one commit, tag.

## What counts as a breaking change

See the MAJOR / MINOR / PATCH definitions in [docs/versioning.md](docs/versioning.md).
The short version: any change to `config/airtable-schema.mjs` is MAJOR, because a
base provisioned by the older `client-onboarding` does not have the new table,
field, or select choice.

## What CI checks

[`.github/workflows/checks.yml`](.github/workflows/checks.yml) runs on every push
and pull request. It is plain shell (`grep`, `diff`, `unzip`), no package manager,
no dependencies:

- every `skills/*/SKILL.md` carries exactly one version stamp, and they all agree
  with each other and with the newest dated heading in `CHANGELOG.md`
- `README.md`'s own version stamp, if it has one, agrees with the skills and the
  changelog
- every `install/*.skill` archive matches its `skills/<name>/` source folder byte
  for byte, and no archive is left behind by a renamed or removed skill. This check
  is **layout-agnostic**: it accepts an archive that wraps its files in a `<name>/`
  folder or zips them flat at the root, because this repo's own
  `scripts/package-skill.sh` deliberately zips flat and that is not a defect to flag
- frontmatter: `name` matches the folder, a description exists and is within the
  1024-character ceiling, and no unreplaced `<placeholder>` token survives (the scan
  matches the shape `<word>`, not a bare `<` or `>`, so it does not false-positive on
  a `description: >` YAML folded scalar or on prose like `<=`/`>=`)
- no em dashes in **lines added by the change** (see House style below; this checks
  added lines, not whole touched files or a repo-wide scan)
- `CHANGELOG.md` keeps an `[Unreleased]` section, uses hyphen-dated headings
  (`## [X.Y.Z] - YYYY-MM-DD`), and gives the newest release an `**Operator impact:**`
  line starting with "Reinstall"

A red check names the file and the reason. If you're reading an older
description of these checks (a linked template, a memory of an earlier draft) that
disagrees with the list above, this file is the one that's current: it was written
directly from this repo's own `checks.yml`.

## House style

No em dashes in anything new. Use a colon, a semicolon, or parentheses.

This is **enforced as a ratchet on added lines, not a repo-wide ban and not a
whole-file check**: `CHANGELOG.md`, most of `docs/`, and comments inside several
existing skill files predate this rule and carry historical em dashes that are
grandfathered, including elsewhere in a file a change happens to land in. CI diffs
each changed file and checks only the `+` lines. This is a deliberate choice, not
laxness: a new line must be clean, so the debt can only shrink over time, and a
two-word fix to one heading never has to justify rewriting the rest of the file's
history to ship. Do not "fix" the check back to a whole-file or repo-wide grep;
either one fails immediately on content this rule was never applied to; a rule that
turns a small fix into a rewrite of history is the kind that gets disabled instead
of followed.

The reason it matters beyond taste: a skill's prose is a prompt, and the model
reads its punctuation as a style signal. This repo's `CLAUDE.md` already restricts
em dashes in client-facing values and generated copy for the same reason; this file
extends that to the maintainer-facing prose CI can actually check. **CI cannot see
what a skill drafts into a live Gmail message**: that protection comes only from
the skill's own instructions (see the open follow-up on `voice-intake` /
`email-generation` in `CHANGELOG.md`'s `[Unreleased]` section, if present).

## Packaging limits

- Frontmatter `description` has a 1024-character ceiling. CI checks it exactly.
- No unreplaced `<placeholder>`-shaped token in frontmatter.

Both have been hit in practice. If a description is near the limit, that's usually
a sign it should be two skills, not a reason to look for a workaround.

## Getting a change in

If `git push` is friction on your machine (deprecated HTTPS password auth, or
`gh auth login` browser handoff failing), GitHub's web upload UI is an accepted
path. Say which you used in the PR so a reviewer knows what to expect.
