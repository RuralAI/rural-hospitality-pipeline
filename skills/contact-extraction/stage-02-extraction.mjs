// AUTO-GENERATED from src/pipeline/stage-02-extraction.js by scripts/sync-skills.mjs — do not edit.
// Edit the source and re-run: npm run sync:skills

/**
 * Stage 02 — Contact Extraction (v1, scraper-only)
 *
 * Pure functions. No file I/O, no Airtable calls — those live in the CLI wrapper
 * `scripts/run-stage-02.mjs`. A future chunked API route can import this unchanged.
 *
 * For each firm, fetch a small set of likely contact pages and harvest emails:
 *   - mailto: links (highest confidence)
 *   - plaintext regex matches against decoded HTML body (lower confidence)
 *
 * No paid tools. No new dependencies. One attempt per firm, no retries.
 *
 * @typedef {Object} FirmInput
 * @property {string} firmId       Airtable record ID. The link key for the future Contacts row.
 * @property {string} firmName     Human-readable name (for logging + the holding file).
 * @property {string} websiteUrl   Firm website URL. May be missing a scheme.
 *
 * @typedef {Object} ScrapeResult
 * @property {string} firm_id
 * @property {string} firm_name
 * @property {"found"|"needs_manual"} status
 * @property {string|null} email
 * @property {string[]} all_emails
 * @property {boolean} email_verified   Always false in v1 (scraping != deliverability).
 * @property {string} contact_source    "Scraped"
 * @property {string} first_name        Empty in v1 — scraping yields no name.
 * @property {string} last_name         Empty in v1.
 * @property {string} title             Empty in v1.
 * @property {string} scraped_at        ISO timestamp.
 * @property {string} [reason]          Short explanation when status is needs_manual.
 */

const CANDIDATE_PATHS = ["/", "/contact", "/contact-us", "/about", "/about-us"];
const FETCH_TIMEOUT_MS = 8000;
const FIRM_BUDGET_MS = 20000;
const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; OutreachBot/1.0)";

/**
 * Build an honest bot User-Agent from the running client's business facts.
 * @param {{businessName?: string, businessUrl: string}} profile
 * @returns {string}
 */
export function buildUserAgent({ businessName, businessUrl } = {}) {
  if (!businessUrl || !businessUrl.trim()) {
    throw new Error("buildUserAgent requires businessUrl — an honest bot identity needs a real URL to point to.");
  }
  const slug = (businessName && businessName.trim() ? businessName.trim() : "Outreach").replace(/[^a-zA-Z0-9]/g, "");
  return `Mozilla/5.0 (compatible; ${slug}Bot/1.0; +${businessUrl.trim()})`;
}

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const MAILTO_RE = /href\s*=\s*["']mailto:([^"'?#]+)/gi;

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "pdf", "css", "js",
]);
const RETINA_DOMAIN_RE = /^[23]x\./;
const PLACEHOLDER_LOCALS = new Set([
  "yourname", "youremail", "your-email", "your.email",
  "firstname.lastname", "name", "email", "user", "username",
  "someone", "test", "noreply", "no-reply", "donotreply",
]);
const PLACEHOLDER_DOMAINS = new Set([
  "example.com", "example.org", "example.net",
  "domain.com", "yourdomain.com", "your-domain.com",
  "email.com", "test.com", "sentry.io", "sentry-next.wixpress.com",
  "wixpress.com", "godaddy.com",
]);

const INBOX_PREFIXES = new Set([
  "info", "hello", "contact", "events", "weddings", "wedding",
  "inquiries", "inquiry", "bookings", "booking", "office", "team",
]);

// Sitemap discovery: where to look, how many child sitemaps / contact pages to follow.
const SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml"];
const MAX_CHILD_SITEMAPS = 3;
const MAX_SITEMAP_CANDIDATES = 4;
const LOC_RE = /<loc>([\s\S]*?)<\/loc>/gi;

// Path slugs that signal a contact-bearing page, scored high → low.
const CONTACT_SLUG_SCORES = [
  [/(^|[/-])(contact|get-?in-?touch|getintouch|connect|reach-?us|say-?hello|inquire|inquiry|inquiries|book-?now|lets-?chat)([/-]|$)/i, 30],
  [/(^|[/-])(about|about-?me|about-?us|team|staff|meet|who-?we-?are|our-?story)([/-]|$)/i, 15],
];
// Slugs that are never a contact page — drop outright.
const NON_CONTACT_SLUG_RE =
  /(^|[/-])(blog|post|posts|gallery|galleries|portfolio|faq|shop|store|cart|checkout|product|privacy|terms|tag|category|author|wp-content|feed|\d{4})([/-]|$)/i;

/**
 * Normalize a website URL. Prepends `https://` if scheme is missing.
 * Returns null for inputs that don't parse as a valid URL.
 */
export function normalizeUrl(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).href;
  } catch {
    return null;
  }
}

function extractHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Extract every <loc> URL from a sitemap (urlset or sitemapindex).
 * Tolerant of whitespace and XML entities; returns [] for junk.
 */
export function parseSitemapUrls(xml) {
  if (typeof xml !== "string" || !xml.includes("<loc")) return [];
  const out = [];
  LOC_RE.lastIndex = 0;
  let m;
  while ((m = LOC_RE.exec(xml)) !== null) {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url) out.push(url);
  }
  return out;
}

/** True when the sitemap is an index pointing to other sitemaps. */
export function isSitemapIndex(xml) {
  return typeof xml === "string" && /<sitemapindex[\s>]/i.test(xml);
}

/**
 * From a flat list of sitemap URLs, keep same-host contact-bearing pages,
 * ranked best-first and capped. Drops off-host URLs, assets, and obvious
 * non-contact pages (blog, gallery, dated archives, etc.).
 */
export function rankContactCandidates(urls, { firmDomain } = {}) {
  if (!Array.isArray(urls)) return [];
  const scored = [];
  const seen = new Set();
  for (const raw of urls) {
    let path, host;
    try {
      const u = new URL(raw);
      host = u.hostname.replace(/^www\./, "").toLowerCase();
      path = u.pathname;
    } catch {
      continue;
    }
    if (firmDomain && !domainsMatch(host, firmDomain)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|ico|bmp|pdf|css|js|xml|json)$/i.test(path)) continue;
    if (NON_CONTACT_SLUG_RE.test(path)) continue;

    let score = 0;
    for (const [re, pts] of CONTACT_SLUG_SCORES) {
      if (re.test(path)) { score = Math.max(score, pts); }
    }
    if (score === 0) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    scored.push({ raw, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_SITEMAP_CANDIDATES).map((s) => s.raw);
}

/**
 * Fetch the site's sitemap and return ranked contact-page candidate URLs.
 * Follows a sitemap index one level deep. Resilient: returns [] on any
 * failure. `fetchHtmlFn(url)` returns body text or null (injected for tests).
 */
export async function discoverSitemapPaths(normalizedUrl, fetchHtmlFn) {
  const firmDomain = extractHost(normalizedUrl);
  const base = new URL(normalizedUrl);

  let xml = null;
  for (const path of SITEMAP_PATHS) {
    xml = await fetchHtmlFn(new URL(path, base).href);
    if (xml) break;
  }
  if (!xml) return [];

  let pageUrls;
  if (isSitemapIndex(xml)) {
    const childSitemaps = parseSitemapUrls(xml).slice(0, MAX_CHILD_SITEMAPS);
    pageUrls = [];
    for (const child of childSitemaps) {
      const childXml = await fetchHtmlFn(child);
      if (childXml) pageUrls.push(...parseSitemapUrls(childXml));
    }
  } else {
    pageUrls = parseSitemapUrls(xml);
  }

  return rankContactCandidates(pageUrls, { firmDomain });
}

function buildCandidates(normalizedUrl) {
  const base = new URL(normalizedUrl);
  const seen = new Set();
  const urls = [];
  for (const path of CANDIDATE_PATHS) {
    const u = new URL(path, base).href;
    if (!seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

export function decodeHtmlEntities(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * True when the candidate looks like a real, usable email address.
 * Filters image filenames, retina suffixes, and well-known placeholders.
 */
export function isPlausibleEmail(raw) {
  if (typeof raw !== "string") return false;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (RETINA_DOMAIN_RE.test(domain)) return false;
  if (local.includes("..")) return false;
  if (PLACEHOLDER_LOCALS.has(local)) return false;

  const lastDot = domain.lastIndexOf(".");
  if (lastDot < 0) return false;
  const tld = domain.slice(lastDot + 1).toLowerCase();
  if (IMAGE_EXTS.has(tld)) return false;
  if (PLACEHOLDER_DOMAINS.has(domain)) return false;

  return true;
}

export function extractMailtos(html) {
  const out = new Set();
  if (typeof html !== "string") return out;
  let m;
  MAILTO_RE.lastIndex = 0;
  while ((m = MAILTO_RE.exec(html)) !== null) {
    const decoded = decodeHtmlEntities(m[1]).trim().toLowerCase();
    if (isPlausibleEmail(decoded)) out.add(decoded);
  }
  return out;
}

export function extractTextEmails(html) {
  const text = decodeHtmlEntities(stripHtml(html));
  const out = new Set();
  let m;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(text)) !== null) {
    const candidate = m[0].toLowerCase();
    if (isPlausibleEmail(candidate)) out.add(candidate);
  }
  return out;
}

function scoreEmail(email, { isMailto, firmDomain }) {
  let score = isMailto ? 100 : 10;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (firmDomain && domainsMatch(domain, firmDomain)) score += 20;
  if (INBOX_PREFIXES.has(local)) score += 5;
  return score;
}

function domainsMatch(emailDomain, firmDomain) {
  if (!emailDomain || !firmDomain) return false;
  const e = emailDomain.toLowerCase().replace(/^www\./, "");
  const f = firmDomain.toLowerCase().replace(/^www\./, "");
  return e === f || e.endsWith(`.${f}`) || f.endsWith(`.${e}`);
}

async function fetchHtml(url, signal, userAgent = DEFAULT_USER_AGENT) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      signal,
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return null;
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Fetch a sitemap document. Like fetchHtml but accepts XML content types
 * (sitemaps are commonly served as text/xml or application/xml).
 */
async function fetchSitemap(url, signal, userAgent = DEFAULT_USER_AGENT) {
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/xml,text/xml" },
      signal,
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!/(xml|text\/plain)/.test(contentType)) return null;
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function makeResult(firm, status, email, allEmails, reason) {
  /** @type {ScrapeResult} */
  const result = {
    firm_id: firm.firmId,
    firm_name: firm.firmName,
    status,
    email,
    all_emails: allEmails,
    email_verified: false,
    contact_source: "Scraped",
    first_name: "",
    last_name: "",
    title: "",
    scraped_at: new Date().toISOString(),
  };
  if (reason) result.reason = reason;
  return result;
}

/**
 * Scrape a single firm. Sink-agnostic — does no I/O beyond outbound HTTP.
 *
 * @param {FirmInput} firm
 * @param {{userAgent?: string}} [options]
 * @returns {Promise<ScrapeResult>}
 */
export async function scrapeFirm(firm, { userAgent = DEFAULT_USER_AGENT } = {}) {
  const firmStart = Date.now();
  const elapsed = () => Date.now() - firmStart;

  const normalizedUrl = normalizeUrl(firm.websiteUrl);
  if (!normalizedUrl) {
    return makeResult(firm, "needs_manual", null, [], "invalid or missing website URL");
  }

  const firmDomain = extractHost(normalizedUrl);
  const found = new Map();

  const withTimeout = (fetcher) => async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetcher(url, controller.signal, userAgent);
    } finally {
      clearTimeout(timer);
    }
  };
  const fetchOne = withTimeout(fetchHtml);
  const fetchSitemapOne = withTimeout(fetchSitemap);

  // Scrape a list of URLs into `found`, stopping early once a mailto is seen
  // or the firm time budget is exhausted. Returns true if a mailto was found.
  const harvest = async (urls) => {
    for (const url of urls) {
      if (elapsed() > FIRM_BUDGET_MS - FETCH_TIMEOUT_MS) break;
      const html = await fetchOne(url);
      if (!html) continue;

      for (const email of extractMailtos(html)) {
        const score = scoreEmail(email, { isMailto: true, firmDomain });
        const prev = found.get(email);
        if (!prev || score > prev.score) found.set(email, { score, isMailto: true });
      }
      for (const email of extractTextEmails(html)) {
        if (found.has(email)) continue;
        const score = scoreEmail(email, { isMailto: false, firmDomain });
        found.set(email, { score, isMailto: false });
      }

      if ([...found.values()].some((v) => v.isMailto)) return true;
    }
    return [...found.values()].some((v) => v.isMailto);
  };

  // First pass: fixed candidate paths.
  let hasMailto = await harvest(buildCandidates(normalizedUrl));

  // Second pass: only if no mailto yet, follow the sitemap to contact pages
  // that live at non-standard slugs (e.g. /contact-me, /special-events-contact).
  // Budget-gated, so already-resolved firms pay nothing for this.
  if (!hasMailto && elapsed() < FIRM_BUDGET_MS - FETCH_TIMEOUT_MS) {
    const sitemapCandidates = await discoverSitemapPaths(normalizedUrl, fetchSitemapOne);
    const fixed = new Set(buildCandidates(normalizedUrl));
    const fresh = sitemapCandidates.filter((u) => !fixed.has(u));
    if (fresh.length) await harvest(fresh);
  }

  if (found.size === 0) {
    return makeResult(firm, "needs_manual", null, [], "no email addresses found");
  }

  const sorted = [...found.entries()].sort(([, a], [, b]) => b.score - a.score);
  const [bestEmail] = sorted[0];
  const allEmails = sorted.map(([e]) => e);

  return makeResult(firm, "found", bestEmail, allEmails);
}
