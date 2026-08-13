#!/usr/bin/env node
/**
 * Refreshes the static blog posts embedded in index.html from the Steam
 * News API.
 *
 * Why this exists: the site previously fetched Steam News from the
 * browser via a Cloudflare Worker / third-party CORS proxy. Steam's API
 * has no CORS headers, so a server-side hop was always required — but
 * doing that hop from the visitor's browser means the blog section's
 * fate depends on whatever proxy is up *at that moment*, and produces no
 * content at all until the fetch resolves. Running the same fetch here,
 * server-side, in CI removes both problems: Steam's API accepts plain
 * server-to-server requests fine, and the output gets committed straight
 * into index.html, so every visitor (and every crawler) sees real post
 * content immediately, with zero runtime dependency on Cloudflare or any
 * proxy.
 *
 * Run manually with `node scripts/update-blog.js`, or on a schedule via
 * .github/workflows/update-blog.yml.
 */

const fs = require("fs");
const path = require("path");

const STEAM_APP_ID = "2171040";
const POST_COUNT = 3;
const INDEX_HTML = path.join(__dirname, "..", "index.html");
const SITEMAP_XML = path.join(__dirname, "..", "sitemap.xml");
const START_MARKER = "<!-- BLOG-POSTS:START -->";
const END_MARKER = "<!-- BLOG-POSTS:END -->";
const FALLBACK_IMG_URL = `https://cdn.akamai.steamstatic.com/steam/apps/${STEAM_APP_ID}/header.jpg`;
const CLAN_IMG = "https://clan.fastly.steamstatic.com/images";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Extract the first image from a Steam news item's HTML/BBCode content.
function extractImage(contentStr) {
  const bbSrcMatch = contentStr.match(
    /\[img\s+src=["']?\{STEAM_CLAN_IMAGE\}([^"'\]]+)["']?\]/i,
  );
  if (bbSrcMatch) return CLAN_IMG + bbSrcMatch[1].trim();

  const bbPlainMatch = contentStr.match(/\[img\]([^\[]+?)\[\/img\]/i);
  if (bbPlainMatch)
    return bbPlainMatch[1].trim().replace("{STEAM_CLAN_IMAGE}", CLAN_IMG);

  const htmlImgMatch = contentStr.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (htmlImgMatch) {
    const url = htmlImgMatch[1];
    return url.startsWith("//") ? "https:" + url : url;
  }

  return null;
}

function extractExcerpt(contentStr) {
  const plainContent = contentStr
    .replace(/<img[^>]*>/gi, "")
    .replace(/\[img\][\s\S]*?\[\/img\]/gi, "")
    .replace(/\[url=[^\]]+\]([^\[]+)\[\/url\]/gi, "$1")
    // Block-level BBCode/HTML tags become word boundaries — without this,
    // "[/h1][h2]Foo[/h2]" collapses into "...NotesFoo..." with no space.
    .replace(/<\/(p|div|li|h[1-6]|br)\s*>/gi, " ")
    .replace(/\[\/(h[1-6]|p|li|\*)\]/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[.*?\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainContent.length > 280
    ? plainContent.slice(0, 277) + "…"
    : plainContent;
}

function renderPost(item) {
  const contentStr = item.contents || "";
  const imgUrl = extractImage(contentStr);
  const thumbHtml = imgUrl
    ? `<img class="blog-thumb" src="${imgUrl}" alt="${escapeHtml(item.title)} thumbnail" loading="lazy">`
    : `<div class="blog-thumb-placeholder"><img src="${FALLBACK_IMG_URL}" alt="Windhelm logo"></div>`;

  // Steam's `author` field is whatever Steamworks account posted the news
  // item — sometimes a real name, sometimes an integration/bot account
  // with a display name Steam has partially censored (e.g. trailing
  // "*******"). Every post here is from the Windhelm team regardless, so
  // show one consistent, presentable byline rather than raw Steam account
  // names.
  const author = "Posted by Windhelm Team";

  const isoDate = new Date(item.date * 1000).toISOString();

  return `            <div class="blog-post">
              ${thumbHtml}
              <div class="blog-body">
                <a class="blog-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
                <p class="blog-excerpt">${escapeHtml(extractExcerpt(contentStr))}</p>
                <div class="blog-meta">
                  <span>${formatDate(isoDate)}</span>
                  <span>${author}</span>
                </div>
              </div>
            </div>`;
}

async function fetchSteamNews() {
  // maxlength=0 requests the full, untruncated content — Steam's own
  // truncation can cut mid-BBCode-tag, which would break our image
  // extraction below. We trim to an excerpt ourselves in extractExcerpt().
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${STEAM_APP_ID}&count=${POST_COUNT}&maxlength=0&format=json`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "WindhelmSite-BlogUpdater/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    throw new Error(`Steam News API returned HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const items = data?.appnews?.newsitems || [];
  if (items.length === 0) {
    throw new Error("Steam News API returned no items");
  }
  return items
    .slice()
    .sort((a, b) => b.date - a.date)
    .slice(0, POST_COUNT);
}

async function main() {
  let items;
  try {
    items = await fetchSteamNews();
  } catch (err) {
    console.error(`Could not fetch Steam News, leaving index.html untouched: ${err.message}`);
    process.exit(0); // Not a failure — just skip this run, keep existing static content.
  }

  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.error("Could not find BLOG-POSTS markers in index.html — aborting.");
    process.exit(1);
  }

  const newBlock = items.map(renderPost).join("\n");
  const updatedHtml =
    html.slice(0, startIdx + START_MARKER.length) +
    "\n" +
    newBlock +
    "\n            " +
    html.slice(endIdx);

  if (updatedHtml === html) {
    console.log("Blog posts unchanged — nothing to write.");
    return;
  }

  fs.writeFileSync(INDEX_HTML, updatedHtml);
  console.log(`Updated ${items.length} blog posts in index.html:`);
  items.forEach((item) => console.log(`  - ${item.title}`));

  // Keep the homepage's sitemap lastmod in sync with real content changes.
  try {
    const today = new Date().toISOString().slice(0, 10);
    let sitemap = fs.readFileSync(SITEMAP_XML, "utf8");
    sitemap = sitemap.replace(
      /(<loc>https:\/\/windhelm\.dev\/<\/loc>\s*<lastmod>)[^<]+(<\/lastmod>)/,
      `$1${today}$2`,
    );
    fs.writeFileSync(SITEMAP_XML, sitemap);
  } catch (err) {
    console.warn(`Could not update sitemap.xml lastmod: ${err.message}`);
  }
}

main();
