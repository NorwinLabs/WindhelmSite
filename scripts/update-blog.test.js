const test = require("node:test");
const assert = require("node:assert");
const { extractImages } = require("./update-blog.js");

const CLAN = "https://clan.fastly.steamstatic.com/images";

test("plain [img] with clan placeholder", () => {
  assert.deepStrictEqual(
    extractImages("Hi [img]{STEAM_CLAN_IMAGE}/1/a.png[/img]"),
    [`${CLAN}/1/a.png`],
  );
});

test("[img src=...] attribute form and LOC placeholder", () => {
  assert.deepStrictEqual(
    extractImages('[img src="{STEAM_CLAN_LOC_IMAGE}/2/b.jpg" width="600"][/img]'),
    [`${CLAN}/2/b.jpg`],
  );
});

test("YouTube preview becomes a thumbnail", () => {
  assert.deepStrictEqual(
    extractImages("[previewyoutube=dQw4w9WgXcQ;full][/previewyoutube]"),
    ["https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"],
  );
});

test("html img, protocol-relative, ordered and deduplicated", () => {
  assert.deepStrictEqual(
    extractImages(
      '<img src="//cdn.example.com/x.webp"> text [img]https://cdn.example.com/y.png[/img] <img src="//cdn.example.com/x.webp">',
    ),
    ["https://cdn.example.com/x.webp", "https://cdn.example.com/y.png"],
  );
});

test("no images yields empty list; non-https rejected", () => {
  assert.deepStrictEqual(extractImages("just text"), []);
  assert.deepStrictEqual(extractImages("[img]http://a.com/a.png[/img]"), []);
});
