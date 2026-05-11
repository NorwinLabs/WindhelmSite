/**
 * Windhelm Steam News Proxy — Cloudflare Worker
 *
 * Fetches news from the Steam Web API on the server side, adds CORS headers,
 * and caches responses at the edge for 30 minutes — eliminating reliance on
 * third-party CORS proxies.
 *
 * ── DEPLOYMENT ──────────────────────────────────────────────────────────────
 *  1. Install Wrangler CLI:  npm install -g wrangler
 *  2. Login to Cloudflare:   wrangler login
 *  3. Deploy:                wrangler deploy
 *
 *  Your worker URL will be printed after deploy, e.g.:
 *    https://windhelm-steam-news.<your-subdomain>.workers.dev
 *
 *  Copy that URL and paste it into the STEAM_NEWS_WORKER constant in index.html.
 * ────────────────────────────────────────────────────────────────────────────
 */

const STEAM_APP_ID = "2171040";
const MAX_COUNT = 20;
const CACHE_TTL = 1800; // 30 minutes in seconds

// Only accept requests from your own domain (add others if needed)
const ALLOWED_ORIGINS = [
  "https://windhelmthegame.ddns.net",
  "http://localhost",
  "http://127.0.0.1",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.some((o) => origin && origin.startsWith(o))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const url = new URL(request.url);
    const appid = url.searchParams.get("appid") || STEAM_APP_ID;
    const count = Math.min(
      parseInt(url.searchParams.get("count") || "5"),
      MAX_COUNT,
    );
    const maxlength = parseInt(url.searchParams.get("maxlength") || "1200");

    // Validate appid is a number (prevent injection)
    if (!/^\d+$/.test(appid)) {
      return new Response(JSON.stringify({ error: "Invalid appid" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const steamUrl = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${appid}&count=${count}&maxlength=${maxlength}&format=json`;

    // Try Cloudflare edge cache first
    const cache = caches.default;
    const cacheKey = new Request(steamUrl);
    let cachedRes = await cache.match(cacheKey);
    if (cachedRes) {
      // Return cached Steam data with fresh CORS headers
      const body = await cachedRes.text();
      return new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL}`,
          "X-Cache": "HIT",
          ...corsHeaders(origin),
        },
      });
    }

    // Fetch fresh data from Steam
    let steamRes;
    try {
      steamRes = await fetch(steamUrl, {
        headers: { "User-Agent": "WindhelmSite/1.0" },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Steam API unreachable", detail: err.message }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        },
      );
    }

    if (!steamRes.ok) {
      return new Response(
        JSON.stringify({ error: "Steam API error", status: steamRes.status }),
        {
          status: steamRes.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        },
      );
    }

    const data = await steamRes.json();
    const responseBody = JSON.stringify(data);

    const responseToCache = new Response(responseBody, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });

    // Store in edge cache (async, don't block response)
    ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

    return new Response(responseBody, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
        "X-Cache": "MISS",
        ...corsHeaders(origin),
      },
    });
  },
};
