import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "./dist.mjs";

// The home page and the pages that explain a screen show it, in screenshots from the app.
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

for (const [route, least] of Object.entries(SHOWN)) {
  test(`${route} shows the app, each screenshot described`, () => {
    const shots = [...page(route).matchAll(/<img\b[^>]*>/g)]
      .map(([img]) => img)
      .filter((img) => /\ssrc="\/_astro\/shot-/.test(img));
    assert.ok(shots.length >= least, `${route}: ${shots.length} screenshots, not ${least}`);
    for (const img of shots) assert.match(img, /\salt="[^"]{12,}"/, `${route}: ${img}`);
  });
}
