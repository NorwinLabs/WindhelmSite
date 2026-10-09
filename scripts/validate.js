#!/usr/bin/env node
/**
 * Lints the static site for SEO and integrity regressions:
 *   - indexable pages have a title, description, canonical, and Open Graph tags
 *   - noindex pages (404) are kept out of the sitemap
 *   - every indexable page is listed in sitemap.xml
 *   - local href/src references resolve to files on disk
 *
 * Run with `npm run validate`; exits non-zero on any problem.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && !f.startsWith("google"));
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const errors = [];

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
  const fail = (msg) => errors.push(`${page}: ${msg}`);

  if (!/<title>[^<]+<\/title>/.test(html)) fail("missing <title>");
  if (!/rel="icon"/.test(html)) fail("missing favicon link");

  const inSitemap = sitemap.includes(
    page === "index.html"
      ? "<loc>https://windhelm.dev/</loc>"
      : `<loc>https://windhelm.dev/${page}</loc>`,
  );
  if (noindex) {
    if (inSitemap) fail("noindex page is listed in sitemap.xml");
  } else {
    if (!/name="description"/.test(html)) fail("missing meta description");
    if (!/rel="canonical"/.test(html)) fail("missing canonical link");
    if (!/property="og:title"/.test(html)) fail("missing og:title");
    if (!/property="og:image"/.test(html)) fail("missing og:image");
    if (!inSitemap) fail("not listed in sitemap.xml");
  }

  for (const [, ref] of html.matchAll(/(?:href|src)="([^"#?]+)(?:\?[^"]*)?"/g)) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(ref)) continue;
    if (!fs.existsSync(path.join(ROOT, ref.replace(/^\//, "")))) {
      fail(`broken local reference "${ref}"`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${pages.length} pages: OK`);
