import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { openSite } from "./browser.mjs";
import { page } from "./dist.mjs";

// The home page and the pages that explain a screen show it, in screenshots from the app: how
// many screens each shows at least.
const SHOWN = {
  "/": 4,
  "/docs/getting-started/": 2,
  "/docs/logging/": 2,
  "/docs/progression/": 1,
  "/docs/programs/": 1,
  "/docs/gyms/": 1,
  "/docs/coaching/": 2,
  "/docs/backups/": 1,
};

/** The screenshots a page holds, in order: which screen, in which theme, and its words. */
function shots(route) {
  return [...page(route).matchAll(/<img\b[^>]*>/g)]
    .map(([img]) => {
      const file = img.match(/\ssrc="\/_astro\/shot-([a-z-]+)\./)?.[1];
      if (!file) return null;
      const [, screen, theme] = file.match(/^(.*?)(?:-(light|dark))?$/);
      return { screen, theme, alt: img.match(/\salt="([^"]*)"/)?.[1] ?? "" };
    })
    .filter(Boolean);
}

for (const [route, least] of Object.entries(SHOWN)) {
  test(`${route} shows the app, each screenshot described, in both themes`, () => {
    const all = shots(route);
    assert.ok(all.length / 2 >= least, `${route}: ${all.length / 2} screens, not ${least}`);
    for (let i = 0; i < all.length; i += 2) {
      const [light, dark] = [all[i], all[i + 1]];
      assert.equal(light.theme, "light", `${route}: ${light.screen} has no light screenshot`);
      assert.deepEqual(dark, { ...light, theme: "dark" }, `${route}: ${light.screen} has no dark twin`);
      assert.ok(light.alt.length >= 12, `${route}: ${light.screen} isn't described`);
    }
  });
}

let site;
before(async () => (site = await openSite()));
after(() => site?.close());

// What the visitor picks in Starlight's menu wins over the system's setting.
for (const [system, picked, theme] of [
  ["light", "auto", "light"],
  ["dark", "auto", "dark"],
  ["dark", "light", "light"],
  ["light", "dark", "dark"],
]) {
  test(`a ${system} system with ${picked} picked shows only the ${theme} screenshots`, async () => {
    await site.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: system }],
    });
    for (const route of Object.keys(SHOWN)) {
      await site.visit(route);
      const seen = await site.run((value) => {
        const select = document.querySelector("starlight-theme-select select");
        // The home page has the menu too; a pick is kept in the browser for the next page.
        select.value = value;
        select.dispatchEvent(new Event("change"));
        return [...document.querySelectorAll('img[src*="/_astro/shot-"]')]
          .filter((img) => img.getClientRects().length > 0)
          .map((img) => img.getAttribute("src"));
      }, picked);
      assert.equal(seen.length, shots(route).length / 2, `${route}: ${seen.join(", ")}`);
      for (const src of seen) assert.match(src, new RegExp(`-${theme}\\.`), route);
    }
  });
}
