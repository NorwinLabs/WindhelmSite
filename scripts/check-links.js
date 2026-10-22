#!/usr/bin/env node
/**
 * Reports broken external links across the site's pages. Network-dependent,
 * so it runs weekly (.github/workflows/links.yml) rather than on every push.
 * Some sites block bots (403/429); those are reported as warnings only.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !f.startsWith("google"));
const urls = new Map();
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  for (const [, u] of html.matchAll(/(?:href|src)="(https?:\/\/[^"#]+)/g)) {
    if (/windhelm\.dev\/?$|fonts\.g|clarity\.ms|steamstatic|googleapis/.test(u)) continue;
    if (!urls.has(u)) urls.set(u, page);
  }
}

(async () => {
  let broken = 0;
  for (const [url, page] of urls) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "WindhelmSite-LinkCheck/1.0" } });
      if (res.status === 404 || res.status === 410 || res.status >= 500) {
        console.error(`BROKEN ${res.status} ${url} (${page})`);
        broken++;
      } else if (res.status >= 400) {
        console.warn(`warn ${res.status} ${url} (${page})`);
      }
    } catch (err) {
      console.error(`BROKEN ${err.message} ${url} (${page})`);
      broken++;
    }
  }
  console.log(`Checked ${urls.size} links, ${broken} broken.`);
  process.exit(broken ? 1 : 0);
})();
