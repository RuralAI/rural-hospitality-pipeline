/**
 * Loads Email Templates: written by voice-intake's template-drafting step into
 * email-templates.json. Empty/missing is a hard stop -- no bundled default ships
 * anymore (the old default was itself Example Inn's approved copy). Never send
 * copy nobody approved.
 */
import { readFileSync, existsSync } from "node:fs";

const HARD_STOP_MESSAGE =
  "No approved Email Templates found at %PATH%. Run the voice-intake skill's template-drafting step first.";

/** The default audience: a firm that places other people's groups. */
export const DEFAULT_AUDIENCE = "Agency";

/**
 * templateKey -- the lookup key for a segment + audience pair.
 *
 * "Agency" is the default and keys on the bare segment, so every template written
 * before `audience` existed keeps working untouched. Anything else gets a suffixed
 * key ("Corporate In-house"). Shared by the loader and the composer so the two can
 * never disagree about how a template is addressed.
 *
 * @param {string} segment
 * @param {string} [audience]
 * @returns {string}
 */
export function templateKey(segment, audience) {
  const a = (audience || "").trim();
  return !a || a === DEFAULT_AUDIENCE ? segment : `${segment} ${a}`;
}

/** @param {string} [path] */
export function loadEmailTemplates(path = "email-templates.json") {
  if (!existsSync(path)) {
    throw new Error(HARD_STOP_MESSAGE.replace("%PATH%", path));
  }
  const rows = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(HARD_STOP_MESSAGE.replace("%PATH%", path));
  }

  const byKey = {};
  for (const row of rows) {
    const fields = row.fields ?? row;
    const segment = fields.segment;
    if (!segment) continue;
    const audience = fields.audience || DEFAULT_AUDIENCE;
    byKey[templateKey(segment, audience)] = {
      subject: fields.subject,
      segment,
      audience,
      bodyParagraphs: String(fields.body || "")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      signOff: fields["sign-off"] || "",
    };
  }
  return byKey;
}

export default loadEmailTemplates;
