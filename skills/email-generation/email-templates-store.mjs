/**
 * Loads Email Templates: written by voice-intake's template-drafting step into
 * email-templates.json. Empty/missing is a hard stop -- no bundled default ships
 * anymore (the old default was itself Example Inn's approved copy). Never send
 * copy nobody approved.
 */
import { readFileSync, existsSync } from "node:fs";

const HARD_STOP_MESSAGE =
  "No approved Email Templates found at %PATH%. Run the voice-intake skill's template-drafting step first.";

/** @param {string} [path] */
export function loadEmailTemplates(path = "email-templates.json") {
  if (!existsSync(path)) {
    throw new Error(HARD_STOP_MESSAGE.replace("%PATH%", path));
  }
  const rows = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(HARD_STOP_MESSAGE.replace("%PATH%", path));
  }

  const bySegment = {};
  for (const row of rows) {
    const fields = row.fields ?? row;
    const segment = fields.segment;
    if (!segment) continue;
    bySegment[segment] = {
      subject: fields.subject,
      segment,
      bodyParagraphs: String(fields.body || "")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      signOff: fields["sign-off"] || "",
    };
  }
  return bySegment;
}

export default loadEmailTemplates;
