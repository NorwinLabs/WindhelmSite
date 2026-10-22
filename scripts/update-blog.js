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

// Steam substitutes these placeholders client-side; we resolve them here.
const CLAN_PLACEHOLDERS = /\{STEAM_CLAN_(?:LOC_)?IMAGE\}/g;
const IMAGE_EXT = /\.(?:jpe?g|png|webp|gif)(?:\?[^\s"'\]\[<>]*)?$/i;

function resolveImageUrl(raw) {
  if (!raw) return null;
  let url = raw.trim().replace(CLAN_PLACEHOLDERS, CLAN_IMG);
  if (url.startsWith("//")) url = "https:" + url;
  if (!/^https:\/\//i.test(url)) return null;
  return url.replace(/&amp;/g, "&");
}

// Collect every candidate image in a Steam news item's BBCode/HTML content,
// in document order, deduplicated. Steam posts use several shapes:
//   [img]{STEAM_CLAN_IMAGE}/123/abc.png[/img]
//   [img src="{STEAM_CLAN_IMAGE}/123/abc.png" width=... ][/img]
//   [previewyoutube=VIDEOID;full][/previewyoutube]  (thumbnail from YouTube)
//   <img src="..."> and bare image URLs in externally-sourced posts
function extractImages(contentStr) {
  const found = [];
  const add = (raw) => {
    const url = resolveImageUrl(raw);
    if (url && !found.includes(url)) found.push(url);
  };
  const patterns = [
    [/\[img\b[^\]]*?\bsrc=["']?([^"'\s\]]+)["']?[^\]]*\]/gi, add],
    [/\[img\]\s*([^\[\s]+?)\s*\[\/img\]/gi, add],
    [/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, add],
    [
      /\[previewyoutube=([\w-]{6,})[^\]]*\]/gi,
      (id) => add(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
    ],
    [/(?:https?:)?\/\/[^\s"'\]\[<>]+/gi, (u) => IMAGE_EXT.test(u) && add(u)],
  ];
  // Walk by position so "first image" means first in the post, not first
  // in whichever pattern happens to run first.
  const hits = [];
  for (const [re, handler] of patterns) {
    for (const m of contentStr.matchAll(re)) {
      hits.push({ index: m.index, value: m[1] ?? m[0], handler });
    }
  }
  hits.sort((x, y) => x.index - y.index);
  for (const h of hits) h.handler(h.value);
  return found;
}

// Steam's news API returns post text only; the artwork shown on each
// announcement lives in the store's partner-events data as capsule/title
// images (filenames relative to the clan's image folder). Returns a map of
// announcement gid -> candidate image URLs, best first.
function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseEventImages(data) {
  const byGid = new Map();
  for (const ev of data?.events || []) {
    const body = ev.announcement_body || {};
    // The event's own id differs from the news item id; the announcement
    // body carries the gid that ISteamNews reports.
    const gids = [body.gid, ev.gid].filter(Boolean).map(String);
    if (!gids.length) continue;
    let json = {};
    try {
      json = JSON.parse(ev.jsondata || "{}");
    } catch {
      /* malformed jsondata: no images for this event */
    }
    const clan = body.clanid || ev.clan_steamid_accountid;
    const files = [
      ...(json.localized_capsule_image || []),
      ...(json.localized_title_image || []),
    ].filter(Boolean);
    const urls = [...new Set(files)].map((f) =>
      /^https?:/i.test(f) ? f : `${CLAN_IMG}/${clan}/${f}`,
    );
    if (!urls.length) continue;
    for (const gid of gids) byGid.set(gid, urls);
    // Ids can live in different spaces between the news and events APIs,
    // so also index by normalized headline.
    const title = normalizeTitle(body.headline || ev.event_name);
    if (title) byGid.set(`title:${title}`, urls);
  }
  return byGid;
}

async function fetchEventImages() {
  const url = `https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/?appid=${STEAM_APP_ID}&count_before=0&count_after=${POST_COUNT * 3}`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "WindhelmSite-BlogUpdater/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const map = parseEventImages(data);
    if (!map.size) console.log(`  events sample: ${JSON.stringify(data).slice(0, 600)}`);
    for (const ev of data?.events || []) {
      const b = ev.announcement_body || {};
      console.log(
        `  event: "${b.headline || ev.event_name}" posttime=${b.posttime} gid=${b.gid}`,
      );
    }
    console.log(
      `  events API: ${data?.events?.length ?? 0} events, ${map.size} with images`,
    );
    return map;
  } catch (err) {
    console.warn(`  events API unavailable: ${err.message}`);
    return new Map();
  }
}

// Prefer the first candidate that actually resolves to an image, so a
// dead or non-image URL never leaves a broken thumbnail on the homepage.
async function pickImage(candidates) {
  for (const url of candidates.slice(0, 5)) {
    try {
      const resp = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "WindhelmSite-BlogUpdater/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      const type = resp.headers.get("content-type") || "";
      if (resp.ok && type.startsWith("image/")) return url;
      console.log(`    rejected ${url}: HTTP ${resp.status} ${type}`);
    } catch (err) {
      console.log(`    rejected ${url}: ${err.message}`);
    }
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

// Strip BBCode/HTML down to readable text.
function plainText(s) {
  return String(s)
    .replace(/<img[^>]*>/gi, "")
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, "")
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToWord(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,;:.-]+$/, "") + "…";
}

// A short, readable teaser. Changelogs are mostly bullet lists, so list
// the lead phrase of the first few items ("Fishing, Bow Mechanics, …");
// otherwise fall back to the opening sentences of the post.
function summarizePost(contents, title) {
  const items = [];
  for (const m of String(contents).matchAll(
    /\[\*\]([\s\S]*?)(?=\[\*\]|\[\/list\]|\[\/\*\])/gi,
  )) {
    const text = plainText(m[1]);
    if (!text) continue;
    const colon = text.indexOf(":");
    const lead =
      colon > 2 && colon <= 40
        ? text.slice(0, colon)
        : text.split(" ").slice(0, 5).join(" ");
    items.push(lead.replace(/[\s,;:.]+$/, ""));
  }
  const unique = [...new Set(items)];
  if (unique.length >= 2) {
    const shown = unique.slice(0, 3);
    const more = unique.length - shown.length;
    const list =
      shown.length === 1
        ? shown[0]
        : shown.length === 2
          ? shown.join(" and ")
          : shown.slice(0, -1).join(", ") + ", and " + shown[shown.length - 1];
    return more > 0 ? `Includes ${list}, plus ${more} more.` : `Includes ${list}.`;
  }

  let text = plainText(contents);
  // Drop a leading repeat of the post title ("Windhelm — Q3 Update ...").
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const words = text.split(" ");
  for (let n = 1; n <= Math.min(words.length, 14); n++) {
    const head = words.slice(0, n).join(" ");
    if (norm(head).includes(norm(title)) && norm(title).length > 3) {
      text = words.slice(n).join(" ");
      break;
    }
  }
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  const first = sentences.slice(0, 2).join("").trim();
  return trimToWord(first.length >= 40 ? first : text, 180);
}

function renderPost(item, imgUrl) {
  const contentStr = item.contents || "";
  const thumbHtml = imgUrl
    ? `<img class="blog-thumb" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)} thumbnail" loading="lazy" decoding="async">`
    : `<div class="blog-thumb-placeholder"><img src="${FALLBACK_IMG_URL}" alt="Windhelm" width="460" height="215" loading="lazy" decoding="async"></div>`;

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
                <p class="blog-excerpt">${escapeHtml(summarizePost(contentStr, item.title))}</p>
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

// Logged only when no usable image was found, so CI output shows what the
// post actually contains (feed, content length, and any media-like markup).
function describeMedia(item) {
  const contents = item.contents || "";
  const media = [
    ...contents.matchAll(/(?:\[[^\]]*(?:img|image|youtube|video|carousel|url)[^\]]*\]|<[^>]*(?:img|source|video)[^>]*>|https?:\/\/\S+)/gi),
  ]
    .map((m) => m[0].slice(0, 160))
    .slice(0, 8);
  console.log(
    `    feed=${item.feedname} length=${contents.length} media=${JSON.stringify(media)}`,
  );
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

  const eventImages = await fetchEventImages();
  console.log(`  news gids: ${items.map((i) => i.gid).join(", ")}`);
  console.log(`  event gids: ${[...eventImages.keys()].join(", ")}`);
  const images = await Promise.all(
    items.map((item) =>
      pickImage([
        ...(eventImages.get(String(item.gid)) ||
          eventImages.get(`title:${normalizeTitle(item.title)}`) ||
          []),
        ...extractImages(item.contents || ""),
      ]),
    ),
  );
  items.forEach((item, i) => {
    console.log(`  image for "${item.title}": ${images[i] || "(fallback)"}`);
    if (!images[i]) describeMedia(item);
  });
  const newBlock = items.map((item, i) => renderPost(item, images[i])).join("\n");
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

if (require.main === module) {
  main();
} else {
  module.exports = { summarizePost, normalizeTitle, parseEventImages, extractImages, extractExcerpt, resolveImageUrl };
}
