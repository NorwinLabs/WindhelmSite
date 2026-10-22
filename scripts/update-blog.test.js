const test = require("node:test");
const assert = require("node:assert");
const { extractImages, parseEventImages, normalizeTitle, summarizePost } = require("./update-blog.js");

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

test("partner events map gid to capsule/title image URLs", () => {
  const map = parseEventImages({
    events: [
      {
        gid: "999",
        announcement_body: { gid: "111", clanid: 42, headline: "Q3-26: The Wilds Update!" },
        jsondata: JSON.stringify({
          localized_capsule_image: ["cap.jpg", null],
          localized_title_image: ["title.png", "cap.jpg"],
        }),
      },
      { gid: "222", announcement_body: { clanid: 42 }, jsondata: "{bad" },
    ],
  });
  assert.deepStrictEqual(map.get("111"), [`${CLAN}/42/cap.jpg`, `${CLAN}/42/title.png`]);
  assert.strictEqual(map.has("222"), false);
});

test("events are also indexed by normalized headline", () => {
  const map = parseEventImages({
    events: [
      {
        gid: "999",
        announcement_body: { gid: "111", clanid: 42, headline: "Q3-26: The Wilds Update!" },
        jsondata: JSON.stringify({ localized_capsule_image: ["cap.jpg"] }),
      },
    ],
  });
  assert.deepStrictEqual(map.get("title:" + normalizeTitle("Q3-26 The Wilds Update")), [`${CLAN}/42/cap.jpg`]);
});

test("changelog bullets become a short teaser", () => {
  const body =
    "[p]Windhelm — Q3 Update Changelog[/p][h2]New Features[/h2][list]" +
    "[*]Windhelm — Q3 Update Changelog[/*]" +
    "[*]Fishing: Introduced new fishing mechanics to the game world.[/*]" +
    "[*]Bow Mechanics: Completed initial bow mechanics.[/*]" +
    "[*]Target Lock-On: Implemented a lock-on feature.[/*]" +
    "[*]Quiver: Added arrows.[/*][/list]";
  assert.strictEqual(
    summarizePost(body, "Q3-26 The Wilds Update"),
    "Includes Fishing, Bow Mechanics, and Target Lock-On, and more.",
  );
});

test("prose posts use opening sentences without repeating the title", () => {
  const body =
    "[p]Hot Fix Update (Q126HF3)[/p][p]I found and fixed a few bugs after the Spring update. Enemy AI can now navigate procedural terrain. More soon.[/p]";
  const out = summarizePost(body, "Hot Fix Update (Q126HF3)");
  assert.ok(out.startsWith("I found and fixed"), out);
  assert.ok(!out.includes("[") && out.length <= 181, out);
});
