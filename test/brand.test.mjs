import assert from "node:assert/strict";
import { test } from "node:test";
import { builtFiles, page, read } from "./dist.mjs";

test("the favicon is the logo, as SVG and as ICO", () => {
  assert.match(page("/"), /<link rel="shortcut icon" href="\/favicon\.svg" type="image\/svg\+xml"\s*\/?>/);
  assert.match(page("/"), /<link rel="icon" href="\/favicon\.ico" sizes="32x32"\s*\/?>/);
  assert.match(read("favicon.svg").toString("utf8"), /overloadvector-icon\.svg/, "generated from the app's brand sources");
  // An ICO file starts 00 00 01 00, then its image count.
  assert.deepEqual([...read("favicon.ico").subarray(0, 6)], [0, 0, 1, 0, 3, 0]);
});

test("the header shows the logo for each theme, and reads as Overload Vector", () => {
  const [, title] = page("/").match(/<a href="\/" class="site-title[^>]*>(.*?)<\/a>/s);
  // Starlight hides the dark theme's logo in the light theme, and the light theme's in the dark.
  assert.match(title, /<img class="light:sl-hidden[^"]*" alt src="\/_astro\/logo-dark\.[^"]+\.svg"/);
  assert.match(title, /<img class="dark:sl-hidden[^"]*" alt src="\/_astro\/logo-light\.[^"]+\.svg"/);
  // The capitals are art: a screen reader hears the name as it is written.
  assert.match(title, /<span class="sr-only"[^>]*>Overload Vector<\/span>/);
});

test("a shared link shows the 1200 x 630 social preview", () => {
  assert.match(page("/"), /<meta property="og:image" content="https:\/\/overloadvector\.com\/social\.png"\s*\/?>/);
  assert.match(page("/"), /<meta name="twitter:card" content="summary_large_image"\s*\/?>/);
  const png = read("social.png");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.ok(builtFiles().includes("social.png"));
});
