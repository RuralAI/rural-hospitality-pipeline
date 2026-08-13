/**
 * Single source of truth for the pipeline's Airtable table + field schema.
 * Consumed by scripts/setup-airtable.mjs (local Node provisioning) and, via
 * sync into skills/client-onboarding/table-schema.mjs, by the client-onboarding
 * skill's connector-based provisioning step.
 *
 * Link fields reference their target by table NAME (`linkTo`) rather than a
 * linkedTableId, because ids are only known after a table is created. Consumers
 * resolve linkTo -> id with toCreateTablePayload once the target exists.
 */

/**
 * @param {string[]} segments - e.g. ["Wedding", "Corporate"]
 * @param {{ includeReview?: boolean }} [opts]
 * @returns {Array<{name:string, fields:Array<object>}>} tables in creation order
 */
export function buildTableDefinitions(segments, { includeReview = false } = {}) {
  const segmentChoices = { choices: segments.map((s) => ({ name: s })) };
  const check = { icon: "check", color: "greenBright" };
  const contactSourceChoices = {
    choices: [{ name: "Scraped" }, { name: "Hunter" }, { name: "Manual" }, { name: "Apollo" }],
  };
  // Who the email is written TO, which is independent of the segment it is about.
  // "Agency" is a firm that places other people's groups (a wedding or corporate
  // planner). "In-house" is an employer booking for its own team, reached through
  // the Apollo path. The two need different copy: an agency plans events as its
  // business, so a lead-in like "your work planning retreats" is true of it and
  // insulting nonsense to an HR director who does it once a year. Travel claims do
  // not vary by audience, so this is deliberately NOT a segment.
  const audienceChoices = { choices: [{ name: "Agency" }, { name: "In-house" }] };

  const firms = {
    name: "Firms",
    fields: [
      { name: "firm-name", type: "singleLineText" },
      { name: "city-metro", type: "singleLineText" },
      { name: "website-url", type: "url" },
      { name: "segment", type: "singleSelect", options: segmentChoices },
      { name: "audience", type: "singleSelect", options: audienceChoices },
      { name: "source", type: "singleLineText" },
      { name: "zip", type: "singleLineText" },
      { name: "search-market", type: "singleLineText" },
      { name: "search-zip", type: "singleLineText" },
      { name: "firm-size-est", type: "singleLineText" },
      { name: "specialties", type: "singleLineText" },
      { name: "notes", type: "multilineText" },
    ],
  };

  const contacts = {
    name: "Contacts",
    fields: [
      { name: "first-name", type: "singleLineText" },
      { name: "last-name", type: "singleLineText" },
      { name: "title", type: "singleLineText" },
      { name: "email", type: "email" },
      { name: "all-emails", type: "multilineText" },
      { name: "contact-source", type: "singleSelect", options: contactSourceChoices },
      { name: "email-verified", type: "checkbox", options: check },
      { name: "firm-id", type: "multipleRecordLinks", linkTo: "Firms" },
      { name: "linkedin-url", type: "url" },
    ],
  };

  const outreach = {
    name: "Outreach",
    fields: [
      { name: "generated-subject", type: "singleLineText" },
      { name: "contact-id", type: "multipleRecordLinks", linkTo: "Contacts" },
      { name: "generated-body", type: "multilineText" },
      {
        name: "send-status",
        type: "singleSelect",
        options: { choices: [{ name: "Pending" }, { name: "Sent" }, { name: "Bounced" }, { name: "Error" }] },
      },
      { name: "date-sent", type: "date", options: { dateFormat: { name: "iso" } } },
      { name: "opened", type: "checkbox", options: check },
      { name: "replied", type: "checkbox", options: check },
      { name: "follow-up-sent", type: "checkbox", options: check },
    ],
  };

  const emailTemplates = {
    name: "Email Templates",
    fields: [
      { name: "subject", type: "singleLineText" },
      { name: "segment", type: "singleSelect", options: segmentChoices },
      { name: "audience", type: "singleSelect", options: audienceChoices },
      { name: "body", type: "multilineText" },
      { name: "sign-off", type: "singleLineText" },
      { name: "updated-at", type: "singleLineText" },
    ],
  };

  const regionTravel = {
    name: "Region Travel",
    fields: [
      { name: "region-id", type: "singleLineText" },
      { name: "segment", type: "singleSelect", options: segmentChoices },
      { name: "sentence", type: "multilineText" },
      { name: "updated-at", type: "singleLineText" },
    ],
  };

  // Layer 1 of the Region Profile Schema, per-client (was the shared/hardcoded
  // config/region-naming.js -- a new client's regions beyond Example Inn's
  // original four had no way to resolve and silently fell back to the generic
  // travel line). One row per region; anchor-city + aliases are what
  // resolveRegionId matches a Stage 01 search-market against.
  const regionNaming = {
    name: "Region Naming",
    fields: [
      { name: "region-id", type: "singleLineText" },
      { name: "anchor-city", type: "singleLineText" },
      { name: "aliases", type: "multilineText" },
    ],
  };

  // Corporate-segment only (provisioned when segments includes "Corporate").
  // One row per decision-maker profile -- the reusable structured output of the
  // corporate-research skill. The landscape narrative (in-house vs third-party,
  // discovery recommendation, open questions) is folded into notes/sourcing-path
  // per profile rather than a separate mixed-record-type table.
  const corporateResearch = {
    name: "Corporate Research",
    fields: [
      { name: "profile-label", type: "singleLineText" },
      {
        name: "planner-type",
        type: "singleSelect",
        options: { choices: [{ name: "In-house" }, { name: "Agency" }, { name: "Hybrid" }] },
      },
      { name: "titles", type: "multilineText" },
      { name: "company-size", type: "singleLineText" },
      { name: "industry-signals", type: "singleLineText" },
      { name: "how-they-find-venues", type: "multilineText" },
      { name: "what-matters", type: "multilineText" },
      { name: "sourcing-path", type: "multilineText" },
      { name: "notes", type: "multilineText" },
      { name: "updated-at", type: "singleLineText" },
    ],
  };

  const config = {
    name: "Config",
    fields: [
      { name: "label", type: "singleLineText" },
      { name: "serper-api-key", type: "singleLineText" },
      { name: "hunter-api-key", type: "singleLineText" },
      { name: "apollo-api-key", type: "singleLineText" },
    ],
  };

  const businessProfile = {
    name: "Business Profile",
    fields: [
      { name: "label", type: "singleLineText" },
      { name: "business-name", type: "singleLineText" },
      { name: "business-url", type: "url" },
      { name: "location", type: "singleLineText" },
      { name: "signing-name", type: "singleLineText" },
      { name: "signature-title", type: "singleLineText" },
      { name: "signature-address", type: "singleLineText" },
      { name: "signature-phone", type: "singleLineText" },
      { name: "signature-website", type: "singleLineText" },
      { name: "capacity", type: "singleLineText" },
      { name: "destination-airport-code", type: "singleLineText" },
      { name: "destination-airport-name", type: "singleLineText" },
      { name: "highlights", type: "multilineText" },
      { name: "corporate-highlights", type: "multilineText" },
      { name: "target-region-ids", type: "multilineText" },
      { name: "segments", type: "multipleSelects", options: segmentChoices },
    ],
  };

  const tables = [firms, contacts, outreach, emailTemplates, regionTravel, regionNaming, config, businessProfile];

  if (segments.some((s) => s.toLowerCase() === "corporate")) {
    tables.push(corporateResearch);
  }

  if (includeReview) {
    const overlap = new Set([
      "firm-name", "city-metro", "website-url", "segment", "source",
      "zip", "search-market", "search-zip", "specialties", "notes",
    ]);
    tables.push({
      name: "Review",
      fields: [
        ...firms.fields.filter((f) => overlap.has(f.name)),
        {
          name: "category",
          type: "singleSelect",
          options: { choices: [{ name: "Planner" }, { name: "Venue" }, { name: "Vendor" }, { name: "Unclear" }] },
        },
        {
          name: "review-status",
          type: "singleSelect",
          options: { choices: [{ name: "Keep" }, { name: "Review" }, { name: "Discard" }] },
        },
      ],
    });
  }

  return tables;
}

/**
 * Convert a table definition into the Airtable "create table" API body,
 * resolving any linkTo field to a linkedTableId via the createdIds map.
 * @param {{name:string, fields:Array<object>}} tableDef
 * @param {Record<string,string>} createdIds - table name -> table id
 * @returns {{name:string, fields:Array<object>}}
 */
export function toCreateTablePayload(tableDef, createdIds = {}) {
  return {
    name: tableDef.name,
    fields: tableDef.fields.map((f) => {
      if (f.type === "multipleRecordLinks" && f.linkTo) {
        const linkedTableId = createdIds[f.linkTo];
        if (!linkedTableId) {
          throw new Error(
            `Cannot resolve link target "${f.linkTo}" for field "${f.name}": create "${f.linkTo}" first.`,
          );
        }
        const { linkTo, ...rest } = f;
        return { ...rest, options: { linkedTableId } };
      }
      return f;
    }),
  };
}
