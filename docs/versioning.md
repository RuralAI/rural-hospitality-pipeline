# Versioning and releases

**Center for Rural AI — Rural Hospitality Pilot**

How this pilot is versioned, what a version number promises, and what an operator
has to do when one changes. This is the standard for maintaining CRAI pilots; a
new pilot repo should copy it rather than invent its own.

---

## The problem this solves

The skills are installed by uploading a `.skill` file into Claude. Once uploaded,
the copy in someone's Claude account is disconnected from this repo forever. It
does not update, and nothing notifies them. Without a version stamp, an operator
who hits a bug cannot tell whether they are running a build that already has the
fix, and a maintainer debugging a pilot cannot tell what the operator is actually
running.

So: **every skill carries a version, and that version has a published meaning.**

---

## One version for the whole pilot

There is a single release version for the repository, held in `package.json`. All
seven skills are stamped with it, whether or not that particular skill changed in
that release.

This is deliberate. Per-skill version numbers would be more precise, but they mean
seven numbers to maintain by hand and an operator doing arithmetic across them.
One number answers the only question an operator actually asks: *is what I have
current?* The changelog answers the follow-up: *which ones do I need to re-upload?*

The stamp appears directly under the H1 of each `SKILL.md`, and therefore inside
each `.skill` archive:

```markdown
# Firm Review (Keep / Review / Discard)

**Version:** 1.0.0 · Center for Rural AI
```

One line, no HTML comment: Claude's skill viewer renders comments as visible text,
so a maintainer note placed there would show up to operators.

It is written by `npm run sync:skills` from `package.json` and must never be typed
by hand. A hand-edited stamp is reported by `npm run sync:skills:check` and
overwritten on the next sync. Because it lives in `SKILL.md`, it rides the same two
hops as the bundled code and is guarded by the same two drift checks:

```
package.json ──stamp──▶ skills/<name>/SKILL.md ──package──▶ install/<name>.skill
                        └── hop 1 check ────────┘└── hop 2 check ──┘
```

Bump `package.json` without re-syncing and `npm test` fails. Re-sync without
repackaging and `npm test` fails. A version can therefore never reach `install/`
without the files that go with it.

---

## What the levels mean

Standard SemVer shape, defined in pilot terms rather than API terms. The test is
always **what does this cost the operator?**, not how large the code change was.

### MAJOR (`2.0.0`) — existing deployments need work

Something that is already deployed stops being correct. Reinstall everything and
follow the migration notes.

- A change to the Airtable schema in `config/airtable-schema.mjs`: a new table, a
  new field, or a new choice on a select field. Bases provisioned by the older
  `client-onboarding` do not have it, and writes to it fail.
- A skill renamed or removed, or its trigger phrases changed such that an existing
  habit stops working.
- A change that invalidates data already collected, or changes the meaning of a
  field already populated.

### MINOR (`1.1.0`) — new capability, nothing breaks

Reinstall the skills named in the changelog to pick it up. Ignoring the release is
safe; you just do not get the new thing.

- A new skill.
- A new optional step in an existing skill (a new enrichment pass, a new provider).
- New guidance or a new segment in a skill's prompt.

### PATCH (`1.0.1`) — fix or clarification

Reinstall the named skill if you hit the described problem. Otherwise optional.

- A bug fix in bundled logic.
- Prompt or wording corrections, documentation, fixture changes.

**When a release mixes levels, the highest one wins.** A patch bundled with a
schema change is a MAJOR release, because the operator's obligation is set by the
most demanding change in it.

---

## Every release states its operator impact

Each version heading in `CHANGELOG.md` carries one required line, immediately
under it, before the `### Added` / `### Fixed` sections:

```markdown
## [2.0.0] — 2026-08-20

**Operator impact:** Reinstall all skills, then re-run `client-onboarding` on
existing bases to add the new `Contacts.contact-source` choice.
```

The line always begins with `Reinstall:` or `Reinstall`, and names skills
explicitly. Acceptable forms:

- `**Operator impact:** Reinstall: none. Documentation only.`
- `**Operator impact:** Reinstall: firm-review, email-generation.`
- `**Operator impact:** Reinstall all skills + schema migration (see below).`

If a release cannot be described in one such line, it is probably two releases.

---

## Cutting a release

Run in this order. Packaging comes before testing, for the reason in `CLAUDE.md`:
the hop-2 check compares `install/` against `skills/`, so testing first just reports
a stale archive that repackaging is what fixes.

```bash
# 1. Decide the level using the definitions above, then set it.
npm version <major|minor|patch> --no-git-tag-version

# 2. Move [Unreleased] into a dated version heading in CHANGELOG.md
#    and write the Operator impact line.

# 3. Restamp, repackage, verify.
npm run sync:skills
npm run package:skills
npm test

# 4. Commit the whole release as one change, then tag it.
git add -A && git commit -m "Release X.Y.Z — <one line>"
git tag -a vX.Y.Z -m "X.Y.Z"
```

The rebuilt `.skill` archives are committed alongside the source change. They are
one logical change: `install/` is what people install.

Tags are how an operator gets an exact historical build. Do not skip step 4.

---

## For operators: am I up to date?

1. **What you have.** Open the skill in Claude (**Settings → Skills**) and read
   the `**Version:**` line under the title.
2. **What is current.** The latest version heading in
   [`CHANGELOG.md`](../CHANGELOG.md).
3. **What to do about a difference.** Read every release between the two and
   follow the `Operator impact` lines, then re-upload the named `.skill` files
   from [`install/`](../install/). Uploading a skill you already have **replaces** it:
   Claude warns you that it will be replaced, and the version line updates in
   place. There is nothing to delete first.

Re-uploading a skill never touches your Airtable data. Only a documented schema
migration does, and those are always called out in the `Operator impact` line.
