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

test("the site's name, the hero title and headings are in Mona Sans", async () => {
  await site.visit("/");
  onlyIn("Mona Sans", await fontsOf(".site-title"), "the site's name");
  onlyIn("Mona Sans", await fontsOf(".hero h1 span"), "the hero title");
  onlyIn("Mona Sans", await fontsOf(".home-feature h2"), "a feature's heading");
  onlyIn("Mona Sans", await fontsOf(".home-cta h2"), "the closing band's heading");
  await site.visit("/docs/logging/");
  onlyIn("Mona Sans", await fontsOf("h1#_top"), "a page's title");
  onlyIn("Mona Sans", await fontsOf(".sl-markdown-content h2"), "a heading");
});

test("text is in Inter", async () => {
  await site.visit("/docs/logging/");
  onlyIn("Inter", await fontsOf(".sl-markdown-content > p"), "a paragraph");
  onlyIn("Inter", await fontsOf(".sl-markdown-content td"), "a table cell");
  onlyIn("Inter", await fontsOf(".site-footer p"), "the footer");
  await site.visit("/docs/getting-started/");
  onlyIn("Inter", await fontsOf(".sl-markdown-content h3"), "a smaller heading");
  onlyIn("Inter", await fontsOf(".sl-markdown-content li > code"), "a word of code in a sentence");
  await site.visit("/");
  onlyIn("Inter", await fontsOf(".home-feature .lead"), "a feature's text");
});

test("a number in a heading is in Mona Sans, as its words are", async () => {
  await site.visit("/docs/logging/");
  await site.run(async () => {
    const content = document.querySelector(".sl-markdown-content");
    content.insertAdjacentHTML("afterbegin", '<h2 id="figures">Week 7: 1234567890</h2>');
    document.querySelector("#figures").getBoundingClientRect();
    await document.fonts.ready;
  });
  await site.run(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  onlyIn("Mona Sans", await fontsOf("#figures"), "a heading's number");
});

// Inter is installed on many a desk, so a missing letter in the site's own cut looks right by eye.
test("no text is drawn in a font of the visitor's own, blocks of code and keys aside", async () => {
  for (const route of ["/", ...Object.keys(PAGES)]) {
    await site.visit(route);
    // The app's ⋮ menu is named by its sign, which Inter doesn't have: that one is the visitor's.
    await site.run(async () => {
      for (const element of document.querySelectorAll("strong")) if (element.textContent === "⋮") element.dataset.sign = "";
      await document.fonts.ready;
    });
    const { root } = await site.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await site.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "body *:not(script, style, pre, pre *, kbd, svg *, [data-sign], :has(kbd, [data-sign]))" });
    // A row's fonts count those of a key or the sign within it, so only what holds neither is asked.
    const strays = new Set();
    for (const nodeId of nodeIds) {
      const { fonts } = await site.send("CSS.getPlatformFontsForNode", { nodeId });
      for (const font of fonts) if (!font.isCustomFont) strays.add(font.familyName);
    }
    assert.deepEqual([...strays], [], route);
  }
});

test("no page loads anything from another server", async () => {
  site.requests.length = 0;
  for (const route of ["/", ...Object.keys(PAGES)]) await site.visit(route);
  assert.ok(site.requests.some((url) => url.endsWith(".woff2")), "no font was loaded");
  assert.deepEqual(site.requests.filter((url) => !url.startsWith(`${site.origin}/`) && !url.startsWith("data:")), []);
});

test("the footer's credit reads as a sentence", () => {
  const words = page("/faq/").replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  assert.ok(words.includes("Fonts: Inter and Mona Sans, under the SIL Open Font License."), words.slice(-300));
});

for (const family of ["Inter", "MonaSans"]) {
  test(`the site ships ${family}'s licence and every page credits it`, () => {
    const licence = `fonts/${family}-OFL.txt`;
    assert.ok(builtFiles().includes(licence), `${licence} isn't published`);
    assert.match(read(licence).toString("utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);
    for (const route of ["/", ...Object.keys(PAGES)]) {
      assert.ok(page(route).includes(`href="/${licence}"`), `${route} doesn't link ${licence}`);
    }
  });
}
