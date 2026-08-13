# Documentation

Nine documents, written for two different readers. Find your row and ignore the rest.

- **Setting up or running outreach for a business?** You need four files, listed first. Start with the getting-started guide.
- **Changing the pipeline's code or skills?** Skip to [For maintainers](#for-maintainers).

---

## For operators

You are the business owner, or someone from CRAI helping one. You never touch code.

| Read | What it is |
|------|------------|
| **[The visual walkthrough](https://ruralai.github.io/rural-hospitality-pipeline/)** | The friendliest starting point: every step as a card, with prompts you copy and paste. Source is [`index.html`](index.html). |
| **[getting-started.md](getting-started.md)** | The written run-through, start to finish. What you need, how to grant access, how to store keys, and every skill in order with the exact line to say to Claude. |
| **[pre-flight-checklist.md](pre-flight-checklist.md)** | A tick-as-you-go list to confirm you are ready before you begin. **Section 1 covers securing the computer you'll run this on — do that one first.** |
| **[onboarding/worksheet-template.md](onboarding/worksheet-template.md)** | The business facts the pipeline asks for. Filling it in beforehand makes onboarding quick. |
| **[onboarding/voice-worksheet.md](onboarding/voice-worksheet.md)** | Optional. Questions about how the owner writes, so the emails sound like a person. |

Two files outside this folder are worth knowing:

- **[../README.md](../README.md)** — what the pipeline is, and where to download the skills.
- **[../CHANGELOG.md](../CHANGELOG.md)** — what changed in each release. Every release has an **Operator impact** line telling you whether you need to reinstall anything. It is the one place that answers "do I need to come back to this repo?"

---

## For maintainers

You are changing the pipeline's code, skills, or schema. None of these are things an operator needs to read.

| Read | What it is |
|------|------------|
| **[../CLAUDE.md](../CLAUDE.md)** | Start here. The contributor contract: what the project is, the two-hop sync rule, house style, and the checklist for adding or changing a skill. |
| **[airtable-schema.md](airtable-schema.md)** | Every table and field, with the exact canonical names the code and prompts depend on. Read before touching `config/airtable-schema.mjs`. |
| **[versioning.md](versioning.md)** | The release standard. Version levels are defined by operator cost, not code size, which is why a one-field schema change is a MAJOR. |
| **[skills-bundled-copy-drift.md](skills-bundled-copy-drift.md)** | Why some skill files are generated rather than hand-edited, and what the two drift checks in `npm test` are protecting. |
| **[key-handling-standard.md](key-handling-standard.md)** | The decision record for where API keys may and may not live. |
| **[../skills/README.md](../skills/README.md)** | How the skills folder is laid out and how packaging works. |
