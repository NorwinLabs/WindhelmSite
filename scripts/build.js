#!/usr/bin/env node
/**
 * Minifies the site's hand-edited sources into the files the pages load:
 *
 *   src/script.js  -> script.min.js
 *   src/styles.css -> styles.min.css
 *
 * It then rewrites the ?v=<hash> cache-busting query on those two files in
 * index.html and sw.js, so returning visitors only re-download an asset when
 * its contents actually changed.
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
const ASSETS = [
  { src: "src/script.js", out: "script.min.js", loader: "js" },
  { src: "src/styles.css", out: "styles.min.css", loader: "css" },
];
const REFERENCES = ["index.html", "sw.js"];

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
