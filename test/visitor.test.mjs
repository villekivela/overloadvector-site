import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { builtFiles, page, read } from "./dist.mjs";
import { PAGES } from "./pages.mjs";

const SUPPORT = 'href="mailto:support@overloadvector.com"';
const routes = ["/", ...Object.keys(PAGES)];

/** The part of a page from its footer on. */
function footer(route) {
  const html = page(route);
  const start = html.indexOf('<footer class="site-footer');
  return start < 0 ? "" : html.slice(start, html.indexOf("</footer>", start));
}

test("every page's footer has the support address and the privacy policy", () => {
  for (const route of routes) {
    assert.ok(footer(route).includes(SUPPORT), `${route}: no support address in the footer`);
    assert.ok(footer(route).includes('href="/privacy/"'), `${route}: no privacy link in the footer`);
  }
});

test("the contact page gives the support address in its text", () => {
  const body = page("/contact/").split('<footer class="site-footer')[0];
  assert.match(body, /<a href="mailto:support@overloadvector\.com">support@overloadvector\.com<\/a>/);
});

test("the sidebar leads to every page", () => {
  const html = page("/docs/getting-started/");
  const sidebar = html.slice(html.indexOf('id="starlight__sidebar"'), html.indexOf("</nav>", html.indexOf('id="starlight__sidebar"')));
  for (const route of Object.keys(PAGES)) {
    assert.ok(sidebar.includes(`href="${route}"`), `${route} isn't in the sidebar`);
  }
});

test("search finds every page", () => {
  const indexed = builtFiles()
    .filter((path) => path.startsWith("pagefind/fragment/"))
    .map((path) => gunzipSync(read(path)).toString("utf8"))
    .map((text) => JSON.parse(text.slice(text.indexOf("{"))).url);
  for (const route of Object.keys(PAGES)) {
    assert.ok(indexed.includes(route), `${route} isn't in the search index`);
  }
});

test("every link within the site leads somewhere", () => {
  const files = new Set(builtFiles());
  const broken = [];
  for (const path of builtFiles().filter((file) => file.endsWith(".html"))) {
    const html = read(path).toString("utf8");
    for (const [, address] of html.matchAll(/(?:href|src)="([\/#][^"]*)"/g)) {
      const [target, anchor] = address.startsWith("#") ? [path.replace(/index\.html$/, ""), address.slice(1)] : address.split("#");
      const file = decodeURI(target.split("?")[0]).replace(/^\//, "");
      const found = file === "" || file.endsWith("/") ? `${file}index.html` : file;
      if (!files.has(found)) broken.push(`${path} → ${address}`);
      else if (anchor && !read(found).toString("utf8").includes(`id="${anchor}"`)) broken.push(`${path} → ${address}`);
    }
  }
  assert.deepEqual(broken, []);
});

// The gym file's format is named "hyperlog-gym" and the app refuses any other value, so the one
// page that teaches the format writes it. The old name appears nowhere else.
test("the old name appears only as the gym file's format value", () => {
  const found = [];
  for (const path of builtFiles()) {
    let bytes = read(path);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
    const text = bytes.toString("utf8");
    // The search index holds every word of the pages, split from its punctuation.
    if (path.startsWith("pagefind/index/")) continue;
    const allowed = path === "docs/gym-format/index.html" || path.startsWith("pagefind/fragment/");
    const left = allowed ? text.replaceAll("hyperlog-gym", "") : text;
    for (const [match] of left.matchAll(/.{0,40}hyperlog.{0,20}/gi)) found.push(`${path}: ${match}`);
  }
  assert.deepEqual(found, []);
});

test("nothing published points into the app's private repository", () => {
  for (const route of routes) {
    const html = page(route);
    assert.doesNotMatch(html, /github\.com\/villekivela\/(?:overloadvector(?![-\w])|hyperlog)/, route);
    assert.doesNotMatch(html, /SPEC\.md|app\/src\//, route);
  }
});

for (const [what, words] of [
  ["what stays on the phone", /What stays on your phone/],
  ["Android's backup to Google", /Android(?:'|&#39;|’)s backup<\/strong> copies/],
  ["the calls to Anthropic with the user's key", /api\.anthropic\.com/],
  ["the server's sync and proposals", /Connecting Claude to your Overload Vector account[\s\S]*A proposal waits on our server/],
  ["the sign-in", /Amazon Cognito/],
  ["where the copy is kept", /eu-north-1/],
  ["how to delete it", /Delete my account data/],
  ["the update check", /api\.github\.com[\s\S]*says nothing about you/],
  ["the Changes and earlier answers a check-in sends", /Changes in force[\s\S]*earlier check-in/],
  ["the training days and library the copy holds", /What is copied\.[\s\S]*training\s+days[\s\S]*exercise\s+library[\s\S]*check-ins/],
  ["what each copy records about the phone", /app version[\s\S]*random device ID|random device ID[\s\S]*app version/],
  ["the answer to a proposal being kept 30 days", /your answer[\s\S]*deleted 30 days after Claude made/],
  ["no ads and no trackers", /no ads, no analytics and no\s+trackers/],
  ["the contact", /support@overloadvector\.com/],
]) {
  test(`the privacy policy covers ${what}`, () => {
    assert.match(page("/privacy/").split('<footer class="site-footer')[0], words);
  });
}
