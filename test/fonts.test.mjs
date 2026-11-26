import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { openSite } from "./browser.mjs";
import { builtFiles, page, read } from "./dist.mjs";
import { PAGES } from "./pages.mjs";

let site;
before(async () => {
  site = await openSite();
  await site.send("DOM.enable");
  await site.send("CSS.enable");
});
after(() => site?.close());

/** The fonts that drew the text of the first element matching `selector`, as Chrome names them. */
async function fontsOf(selector) {
  const { root } = await site.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await site.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  assert.ok(nodeId, `nothing matches ${selector}`);
  const { fonts } = await site.send("CSS.getPlatformFontsForNode", { nodeId });
  return fonts.map((font) => `${font.familyName}${font.isCustomFont ? "" : " (the system's)"}`).sort();
}

function onlyIn(family, fonts, what) {
  assert.ok(fonts.length > 0, `${what}: no text`);
  for (const font of fonts) {
    assert.match(font, new RegExp(`^${family}(?!.*system)`), `${what} is drawn in ${fonts.join(", ")}`);
  }
}

test("the site's title, the hero title and headings are in Space Grotesk", async () => {
  await site.visit("/");
  onlyIn("Space Grotesk", await fontsOf(".site-title span"), "the site's title");
  onlyIn("Space Grotesk", await fontsOf(".hero h1"), "the hero title");
  onlyIn("Space Grotesk", await fontsOf(".sl-markdown-content h2"), "a home page heading");
  onlyIn("Space Grotesk", await fontsOf(".card .title > span:last-child"), "a card's title");
  await site.visit("/docs/logging/");
  onlyIn("Space Grotesk", await fontsOf("h1#_top"), "a page's title");
  onlyIn("Space Grotesk", await fontsOf(".sl-markdown-content h2"), "a heading");
});

test("text is in Inter", async () => {
  await site.visit("/docs/logging/");
  onlyIn("Inter", await fontsOf(".sl-markdown-content > p"), "a paragraph");
  onlyIn("Inter", await fontsOf(".sl-markdown-content td"), "a table cell");
  onlyIn("Inter", await fontsOf(".site-footer p"), "the footer");
});

test("a number in a heading is in Inter, its words in Space Grotesk", async () => {
  await site.visit("/docs/logging/");
  await site.run(async () => {
    const content = document.querySelector(".sl-markdown-content");
    content.insertAdjacentHTML("afterbegin", '<h2 id="figures">1234567890</h2><h3 id="mixed">Week 7</h3>');
    document.querySelector("#figures").getBoundingClientRect();
    await document.fonts.ready;
  });
  await site.run(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  onlyIn("Inter", await fontsOf("#figures"), "a heading's number");
  const mixed = await fontsOf("#mixed");
  assert.ok(mixed.some((f) => f.startsWith("Inter")) && mixed.some((f) => f.startsWith("Space Grotesk")), mixed.join(", "));
});

test("no page loads anything from another server", async () => {
  site.requests.length = 0;
  for (const route of ["/", ...Object.keys(PAGES)]) await site.visit(route);
  assert.ok(site.requests.some((url) => url.endsWith(".woff2")), "no font was loaded");
  assert.deepEqual(site.requests.filter((url) => !url.startsWith(`${site.origin}/`) && !url.startsWith("data:")), []);
});

for (const family of ["Inter", "SpaceGrotesk"]) {
  test(`the site ships ${family}'s licence and every page credits it`, () => {
    const licence = `fonts/${family}-OFL.txt`;
    assert.ok(builtFiles().includes(licence), `${licence} isn't published`);
    assert.match(read(licence).toString("utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);
    for (const route of ["/", ...Object.keys(PAGES)]) {
      assert.ok(page(route).includes(`href="/${licence}"`), `${route} doesn't link ${licence}`);
    }
  });
}
