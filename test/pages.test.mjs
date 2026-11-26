import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "./dist.mjs";
import { PAGES } from "./pages.mjs";

for (const [route, heading] of Object.entries(PAGES)) {
  test(`${route} is the ${heading} page`, () => {
    assert.match(page(route), new RegExp(`<h1[^>]*>\\s*${heading}\\s*</h1>`));
  });
}
