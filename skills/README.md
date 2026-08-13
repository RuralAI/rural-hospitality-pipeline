# Claude Skills

> **Who this is for:** maintainers working on the skill sources in this folder.
> **Operators want [`../install/`](../install/) instead** — that holds the packaged
> `.skill` files you upload to Claude. Nothing in here is installable as-is.

This folder contains [Claude Skills](https://support.claude.ai/hc/en-us/articles/27900216893325) — reusable AI instructions that extend Claude's behavior for specific tasks in this project.

Skills are installed into Claude once and then available in any conversation. They are the primary way this project captures repeatable workflows so that team members and future CRAI deployments don't have to reinvent the process each time.

---

## Skills in This Repo

### `voice-intake`

Guides a conversational interview to capture how the client contact writes and communicates, then drafts per-segment outreach copy in that voice (informed by the Business Profile and positioning notes from `client-onboarding`). After inline approval, writes the approved copy to the Airtable Email Templates table. Runs in Claude Desktop, writing via the Airtable connector, not a repo file.

**When to use:** At the start of a new client deployment, or any time you need to update the email voice for an existing client.

---

### `client-onboarding`

Provisions the Airtable base for a new deployment (creates the pipeline's tables via the connector if they don't already exist) and runs the intake worksheet or a live interview to write a single-row Business Profile record and any approved Region Travel rows. Positioning notes are captured here and handed to `voice-intake` for its template drafting. Runs in Claude Desktop, writing via the Airtable connector.

**When to use:** At the start of a new client deployment, before `voice-intake` and the four pipeline skills.

---

### `corporate-research`

Structured research guide for working through the corporate retreat planning landscape — specifically whether planning is handled in-house or by a third-party agency, and who the right decision-maker is. Runs in Claude Desktop: reads the client's Business Profile and Region Naming from Airtable to frame the research, then writes the resulting decision-maker profiles to the Airtable Corporate Research table (provisioned by `client-onboarding` when the Corporate segment is in scope). Also presents a landscape summary in chat. No longer writes a `docs/` file.

**When to use:** Before building the corporate planner discovery pipeline, for a client running the Corporate segment. This research must be completed before Stage 01 sourcing for the corporate segment can begin.

---

## How to Install a Skill

1. Open [Claude.ai](https://claude.ai)
2. Go to **Settings → Skills**
3. Click **Add Skill**
4. Upload the `.skill` file from this folder

Each skill only needs to be installed once. After installation it is available in all your Claude conversations.

> **Note:** `.skill` files are the packaged, installable version of each `SKILL.md`. If you want to read or edit a skill, open the `SKILL.md` directly. To regenerate a `.skill` file after editing, see the packaging instructions below.

---

## How to Edit a Skill

Skills are plain markdown files. Open the `SKILL.md` in any text editor, make your changes, and commit. The skill will need to be repackaged and reinstalled in Claude for the changes to take effect.

As the project evolves — real outreach goes out, responses come in, the client's voice gets clearer — these skills should be updated to reflect what's actually working.

---

## How to Package a Skill

A `.skill` file is simply a **zip of the skill's folder contents**, with
`SKILL.md` inside alongside whatever scripts and config that skill needs. Use
the repo's packaging script — no Python, no external tooling:

```bash
# From the repo root
scripts/package-skill.sh firm-discovery   # one skill  → install/firm-discovery.skill
scripts/package-skill.sh --all            # every skill that has a SKILL.md
```

The script zips every file in `skills/<name>/` at the archive root (the layout
Claude Desktop installs cleanly), skips junk like `.DS_Store`, and verifies
`SKILL.md` made it in. Output lands in `install/`, which **is** committed — it is
what people download. Regenerate it any time; never hand-edit a `.skill`.

To build one by hand instead, it's just:

```bash
cd skills/firm-discovery && zip -X ../../install/firm-discovery.skill SKILL.md discover.mjs lib.mjs lib.test.mjs
```

---

## Adding a New Skill

1. Create a new folder under `skills/` with a short, hyphenated name
2. Add a `SKILL.md` following the structure of the existing skills
3. Package it into a `.skill` file
4. Add an entry to this README
5. Commit both the `SKILL.md` and the `.skill` file

---

## For CRAI Deployments

When deploying this pipeline for a new client:

1. Run the **client-onboarding** skill to provision the Airtable base and write the new client's Business Profile and Region Travel rows
2. Run the **voice-intake** skill to capture the new client contact's voice, draft per-segment outreach copy, and save it to the Airtable Email Templates table
3. Run the **corporate-research** skill if the corporate segment is in scope — it writes decision-maker profiles to the Airtable Corporate Research table
4. The **firm-review** action skill (in `skills/firm-review/`) works as-is across deployments — the evaluation criteria are segment-based, not client-specific

_All skills are released under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0) as part of the Center for Rural AI Rural Hospitality Pilot._
