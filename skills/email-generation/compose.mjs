#!/usr/bin/env node
/**
 * email-generation / compose.mjs
 *
 * Renders the approved email template for one or more contacts, reading Business
 * Profile, Email Templates, Region Travel, and Region Naming from JSON files
 * written by the connector-read step in SKILL.md (step 0) -- not from bundled
 * client config. Region Naming is per-client Airtable data (see
 * region-naming-store.mjs): a market only resolves to a region if this
 * client's own Region Naming table has a row for it, so a new client never
 * inherits another client's regions.
 * This script only substitutes the two tokens, adds the greeting, and appends the
 * signature:
 *
 *   {{travel}} -> the stored Region Travel sentence for the region+segment, or a
 *                 generic no-transit-claim fallback built from Business Profile
 *   {{firm}}   -> "<Firm> and " when the firm is known, "" otherwise
 *   greeting   -> "Hello <first>," when a first name is known, else "Hello,"
 *
 * No Claude API call. No Airtable. No Gmail. This produces subject + body only;
 * the connector steps (read Business Profile / Email Templates / Region Travel /
 * Contacts, create Gmail drafts) are done by Claude around this script, per
 * SKILL.md.
 *
 * Usage:
 *   Batch:  node compose.mjs --input contacts.json  [--segment Wedding]
 *   Single: node compose.mjs --segment Wedding --market "Denver" --firm "Larkspur Events" --to a@b.com [--name Jane] [--audience In-house]
 *
 * contacts.json is an array of:
 *   { "email": "...", "firm": "...", "market": "Denver", "segment": "Wedding",
 *     "audience": "Agency", "name": "" }
 * `market` is the search-market or city used to pick the region (search-market
 * preferred, city-metro as fallback). `segment` per item overrides --segment.
 * `audience` is "Agency" (a firm placing other people's groups, the default) or
 * "In-house" (an employer booking for its own team). It selects the template
 * variant; it does NOT affect the travel sentence, which varies by region and
 * segment only.
 *
 * Output: JSON array of { to, subject, body } to stdout.
 */

import { readFileSync, existsSync } from "node:fs";
import { loadBusinessProfile } from "./business-profile.mjs";
import { loadEmailTemplates, templateKey } from "./email-templates-store.mjs";
import { loadRegionTravel, resolveTravelSentence } from "./region-travel-store.mjs";
import { loadRegionNaming, resolveRegionId } from "./region-naming-store.mjs";
import { buildSignatureLines } from "./signature.mjs";

/**
 * @param {{profile: object, templates: object, regionTravel: object, regionNaming?: Array, defaultSegment?: string}} deps
 * @returns {(item: {email:string,firm:string,market:string,segment:string,audience?:string,name:string}) => {to:string|null,subject:string,body:string}}
 */
export function createComposer({ profile, templates, regionTravel, regionNaming = [], defaultSegment = "Wedding" }) {
  return function compose({ email, firm, market, segment, audience, name }) {
    const seg = segment || defaultSegment;
    const key = templateKey(seg, audience);
    const template = templates[key];
    if (!template) {
      // Never silently fall back to the Agency template for an In-house contact.
      // That is exactly the failure this key exists to prevent: agency copy opens
      // by praising the reader's event-planning business, which an employer does
      // not have, so the mail reads as a mistake. Stop and say what is missing.
      throw new Error(
        `No Email Templates record for "${key}". Known: ${Object.keys(templates).join(", ")}. ` +
          `Run the voice-intake skill to draft and approve copy for this segment and audience.`,
      );
    }

    const regionId = resolveRegionId(market, regionNaming);
    const travel = resolveTravelSentence(regionTravel, regionId, seg, {
      businessName: profile.businessName,
      location: profile.location,
    });
    const firmLeadIn = firm && firm.trim() ? `${firm.trim()} and ` : "";

    const expand = (p) => p.split("{{travel}}").join(travel).split("{{firm}}").join(firmLeadIn);

    const greeting = name && name.trim() ? `Hello ${name.trim()},` : "Hello,";
    const paragraphs = template.bodyParagraphs.map(expand);
    const sigLines = buildSignatureLines(profile);

    const body = [
      greeting,
      "",
      ...paragraphs.flatMap((p) => [p, ""]),
      template.signOff,
      ...sigLines,
    ].join("\n");

    return { to: email || null, subject: template.subject, body };
  };
}

// ---- CLI: load real data, build the composer, run it over the input ------
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name, dflt = null) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
  };

  const profile = loadBusinessProfile();
  const templates = loadEmailTemplates();
  const regionTravel = loadRegionTravel();
  const regionNaming = loadRegionNaming();
  const compose = createComposer({ profile, templates, regionTravel, regionNaming, defaultSegment: flag("segment", "Wedding") });

  let items;
  const inputPath = flag("input");
  if (inputPath) {
    if (!existsSync(inputPath)) {
      console.error(`No input file at ${inputPath}.`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(inputPath, "utf8"));
    if (!Array.isArray(raw)) {
      console.error("Input must be a JSON array of contacts.");
      process.exit(1);
    }
    items = raw;
  } else {
    items = [{
      email: flag("to"),
      firm: flag("firm"),
      market: flag("market"),
      segment: flag("segment"),
      audience: flag("audience"),
      name: flag("name"),
    }];
  }

  const drafts = items.map(compose);
  console.error(`Composed ${drafts.length} email(s).`);
  process.stdout.write(JSON.stringify(drafts, null, 2) + "\n");
}
