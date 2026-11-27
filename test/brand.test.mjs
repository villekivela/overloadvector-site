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

test("every page's header shows the mark beside the name, and leads to the docs and the FAQ", () => {
  for (const route of ["/", "/docs/logging/", "/faq/"]) {
    const html = page(route);
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    // The mark is drawn in the text's colour, so it follows the theme. The name is text beside it.
    assert.match(header, /<a href="\/" class="site-title[^>]*>\s*<svg[^>]*aria-hidden="true"[^>]*>\s*<path fill="currentColor"[^>]*><\/path>\s*<\/svg>\s*Overload Vector\s*<\/a>/, route);
    assert.match(header, /href="\/docs\/getting-started\/"[^>]*>Docs<[\s\S]*href="\/faq\/"[^>]*>FAQ</, route);
    assert.match(header, /starlight-theme-select/, route);
  }
});

test("the header marks the part of the site the reader is in", () => {
  const current = (route) => {
    const html = page(route);
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    return [...header.matchAll(/<a href="([^"]*)" aria-current="page"/g)].map(([, href]) => href);
  };
  assert.deepEqual(current("/"), []);
  assert.deepEqual(current("/docs/logging/"), ["/docs/getting-started/"]);
  assert.deepEqual(current("/faq/"), ["/faq/"]);
  assert.deepEqual(current("/privacy/"), []);
});

test("a shared link shows the 1200 x 630 social preview", () => {
  assert.match(page("/"), /<meta property="og:image" content="https:\/\/overloadvector\.com\/social\.png"\s*\/?>/);
  assert.match(page("/"), /<meta name="twitter:card" content="summary_large_image"\s*\/?>/);
  const png = read("social.png");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.ok(builtFiles().includes("social.png"));
});
