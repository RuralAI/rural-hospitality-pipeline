# New User Airtable Setup Guide

This script creates the **Firms**, **Contacts**, and **Outreach** tables in a new Airtable base with the correct field names and types. It is safe to re-run — tables that already exist are updated with any missing fields, nothing is overwritten.

---

## Prerequisites

- Node.js installed
- An Airtable account
- A new, empty Airtable base created
- A Personal Access Token with these scopes:
  - `schema.bases:read`
  - `schema.bases:write`
  - `data.records:read`
  - `data.records:write`

Create a token at [airtable.com/create/tokens](https://airtable.com/create/tokens). When creating the token, you must also explicitly add your base under **Access** — the scopes alone are not enough. If you are setting up a second base later, edit the existing token and add the new base to its access list.

---

## Steps

**1. Clone the repo and install dependencies**
```
npm install
```

**2. Create your environment file**

Copy the example file:
```
cp .env.local.example .env.local
```

Then fill in these two values in `.env.local`:
```
AIRTABLE_API_KEY=your_personal_access_token
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

The base ID is in your Airtable URL: `airtable.com/appXXXXXXXXXXXXXX/...` — copy just the `app...` part.

**3. Run the setup script**
```
npm run setup:airtable
```

**4. Confirm the results**

You should see output like:
```
✓ Firms — created (tblXXXXXXXXXXXXXX)
✓ Contacts — created (tblXXXXXXXXXXXXXX)
✓ Outreach — created (tblXXXXXXXXXXXXXX)

Done. Your Airtable base is ready for the pipeline.

One manual step remains (Airtable's API doesn't support creating Created-time fields):
  → Open the Firms table → click '+' to add a field → pick 'Created time' → name it 'discovered-date'
```

Open your Airtable base and confirm all three tables appear with their fields. You can delete the default **Table 1** that Airtable creates automatically — it is not used by the pipeline.

**5. Add the `discovered-date` field manually**

Airtable's Meta API does not allow programmatic creation of Created-time fields, so this one field has to be added by hand. It takes about 30 seconds:

1. Open the **Firms** table
2. Click the **`+`** at the right end of the column headers to add a field
3. Pick **Created time** as the field type
4. Name it **`discovered-date`** (with a dash, matching the project's field-naming convention)
5. Save

Once that's done, your base matches the schema in [`docs/airtable-schema.md`](airtable-schema.md) and the pipeline is ready.

---

## Troubleshooting

**"Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID"**
Your `.env.local` file is missing or the variable names are incorrect. Check spelling and make sure the file is in the project root.

**"Could not list tables: Invalid permissions"**
Two possible causes:
- Your token is missing one or more required scopes — verify all four scopes are enabled at [airtable.com/create/tokens](https://airtable.com/create/tokens).
- Your token does not have access to this specific base — edit the token and add the base under **Access**. This is a separate step from scopes and is easy to miss.

**"Could not list tables: Not Found"**
Your `AIRTABLE_BASE_ID` is incorrect. Use only the `app...` segment from the URL, not the full URL path.
