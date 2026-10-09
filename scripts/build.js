#!/usr/bin/env node
/**
 * Minifies the site's hand-edited sources into the files the pages load:
 *
 *   src/script.js  -> script.min.js
 *   src/styles.css -> styles.min.css
 *   src/consent.js -> consent.min.js
 *
 * It then rewrites the ?v=<hash> cache-busting query on those files in
 * every page and sw.js, so returning visitors only re-download an asset when
 * its contents actually changed.
 *
 * The service worker's CACHE_NAME is also derived from the asset hashes, so
 * any asset change retires the old cache without a manual version bump.
 *
 * Edit the files in src/, never the .min outputs. Run locally with
 * `npm install && npm run build`; CI does the same on every push
 * (.github/workflows/build-assets.yml).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");

// Shared bundles keep their historic names; everything else is discovered:
//   src/css/<page>.css -> <page>.min.css
//   src/js/<page>.js   -> <page>.min.js
const ASSETS = [
  { src: "src/script.js", out: "script.min.js", loader: "js" },
  { src: "src/styles.css", out: "styles.min.css", loader: "css" },
  { src: "src/consent.js", out: "consent.min.js", loader: "js" },
];
for (const [dir, ext, loader] of [
  ["src/css", ".css", "css"],
  ["src/js", ".js", "js"],
]) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of fs.readdirSync(abs).sort()) {
    if (!file.endsWith(ext)) continue;
    ASSETS.push({
      src: `${dir}/${file}`,
      out: file.replace(new RegExp(`\\${ext}$`), `.min${ext}`),
      loader,
    });
  }
}

// Every top-level page plus the service worker carry ?v= references.
const REFERENCES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") || f === "sw.js")
  .sort();

const versions = {};

for (const asset of ASSETS) {
  const source = fs.readFileSync(path.join(ROOT, asset.src), "utf8");
  const { code } = esbuild.transformSync(source, {
    loader: asset.loader,
    minify: true,
    legalComments: "none",
    target: "es2019",
  });
  fs.writeFileSync(path.join(ROOT, asset.out), code);
  versions[asset.out] = crypto
    .createHash("sha256")
    .update(code)
    .digest("hex")
    .slice(0, 8);
  console.log(
    `${asset.src}: ${source.length} -> ${code.length} bytes (v=${versions[asset.out]})`,
  );
}

for (const file of REFERENCES) {
  const target = path.join(ROOT, file);
  let text = fs.readFileSync(target, "utf8");
  const before = text;
  for (const [out, hash] of Object.entries(versions)) {
    const escaped = out.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped + "\\?v=[\\w.-]+", "g");
    text = text.replace(pattern, `${out}?v=${hash}`);
  }
  if (text !== before) {
    fs.writeFileSync(target, text);
    console.log(`Updated cache-busting versions in ${file}`);
  }
}

// Retire stale service-worker caches whenever any asset changes.
const swPath = path.join(ROOT, "sw.js");
const swText = fs.readFileSync(swPath, "utf8");
const buildId = crypto
  .createHash("sha256")
  .update(Object.keys(versions).sort().map((k) => k + versions[k]).join())
  .digest("hex")
  .slice(0, 8);
const swNext = swText.replace(
  /const CACHE_NAME = "[^"]*";/,
  `const CACHE_NAME = "windhelm-${buildId}";`,
);
if (swNext !== swText) {
  fs.writeFileSync(swPath, swNext);
  console.log(`Updated service worker cache name (windhelm-${buildId})`);
}
