#!/usr/bin/env node
/**
 * Refreshes the open-source project grid embedded in opensource.html from
 * the GitHub API.
 *
 * Same idea as scripts/update-blog.js: the fetch happens server-side in CI
 * and the result is committed as static HTML, so visitors and crawlers see
 * real content immediately with no runtime dependency on api.github.com
 * (and no CSP changes).
 *
 * Run manually with `node scripts/update-repos.js`, or on a schedule via
 * .github/workflows/update-repos.yml.
 */

const fs = require("fs");
const path = require("path");

const GITHUB_USER = "NorwinLabs";
const PAGE = path.join(__dirname, "..", "opensource.html");
const START_MARKER = "<!-- REPOS:START -->";
const END_MARKER = "<!-- REPOS:END -->";

// Public repos that are experiments / scratch work and shouldn't be showcased.
const EXCLUDE = new Set(["TestPhonePipeline", "ModrinthApp", "DiscordDupe"]);

// Used when a repo has no GitHub description of its own.
const DESCRIPTION_FALLBACK = {
  WorldGuardBatch: "Plugin to execute batch commands in WorldGuard.",
};

const LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572a5",
  Kotlin: "#a97bff",
  Java: "#b07219",
  HTML: "#e34c26",
  Shell: "#89e051",
  "C#": "#178600",
  Assembly: "#6e4c13",
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

async function fetchRepos() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "windhelm-site-repo-refresh",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=pushed`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function renderCard(repo, index) {
  const desc =
    repo.description || DESCRIPTION_FALLBACK[repo.name] || "No description yet.";
  const node = String(index + 1).padStart(2, "0");
  const lang = repo.language
    ? `<span class="meta-item"><span class="lang-dot" style="background:${
        LANG_COLORS[repo.language] || "#8b949e"
      }"></span>${escapeHtml(repo.language)}</span>`
    : "";
  const license = repo.license && repo.license.spdx_id && repo.license.spdx_id !== "NOASSERTION"
    ? `<span class="meta-item">${escapeHtml(repo.license.spdx_id)}</span>`
    : "";
  const stars = `<span class="meta-item">&#9733; ${repo.stargazers_count}</span>`;
  const fork = repo.fork ? `<span class="tag tag-fork">fork</span>` : "";
  const home =
    repo.homepage && /^https?:\/\//.test(repo.homepage)
      ? `<a class="repo-link" href="${escapeHtml(
          repo.homepage
        )}" target="_blank" rel="noopener">website</a>`
      : "";

  return `          <article class="repo-card">
            <header class="repo-head">
              <span class="node-id">NODE-${node}</span>
              <span class="status"><i></i>online</span>
            </header>
            <h3><a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">${escapeHtml(
    repo.name
  )}</a> ${fork}</h3>
            <p>${escapeHtml(desc)}</p>
            <footer class="repo-meta">
              ${lang}${license}${stars}
              <span class="meta-item">pushed ${formatDate(repo.pushed_at)}</span>
            </footer>
            <div class="repo-actions">
              <a class="repo-link" href="${escapeHtml(
                repo.html_url
              )}" target="_blank" rel="noopener">view source &rarr;</a>
              ${home}
            </div>
          </article>`;
}

async function main() {
  const all = await fetchRepos();
  const repos = all
    .filter((r) => !r.private && !r.archived && !r.disabled)
    .filter((r) => !EXCLUDE.has(r.name))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  if (repos.length === 0) {
    throw new Error("No repositories returned; refusing to overwrite the page.");
  }

  const html = fs.readFileSync(PAGE, "utf8");
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("REPOS markers not found in opensource.html");
  }

  const cards = repos.map(renderCard).join("\n");
  let updated =
    html.slice(0, start + START_MARKER.length) +
    "\n" +
    cards +
    "\n          " +
    html.slice(end);

  updated = updated.replace(
    /(<span id="repo-count">)\d*(<\/span>)/,
    `$1${repos.length}$2`
  );

  if (updated !== html) {
    fs.writeFileSync(PAGE, updated);
    console.log(`Updated opensource.html with ${repos.length} repositories.`);
  } else {
    console.log("opensource.html already up to date.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
