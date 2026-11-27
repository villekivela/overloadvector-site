import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "./dist.mjs";
import { PAGES } from "./pages.mjs";

// The site's voice: Overload Vector and "you", in plain words. The privacy policy speaks as "we",
// the party that answers for the data, and the FAQ asks its questions as the reader would.
const WE = /\b(we|us|our|ours|we'll|we're|we've)\b/i;
const I = /\b(I|my|me|I'm|I've)\b/;
const STOCK = /\b(seamless(ly)?|empower\w*|journey|effortless(ly)?|unlock\w*|elevate\w*|leverage\w*|simply|real life|game.chang\w*|safety net|quick levers|no spreadsheets)\b/i;
// A dash that joins two halves of a sentence. A range such as 6–8 has no spaces round it.
const DASH = /\s[—–]\s/;
// The format pages are copies of the app's notes, and their examples name days as the app does.
const COPIES = ["/docs/program-format/", "/docs/gym-format/"];

/** What a visitor reads on a page: its words, without code, what they are asked to say, or markup. */
function words(route, { labels = true } = {}) {
  const html = page(route);
  return html
    .slice(html.indexOf("<main"))
    .split('<footer class="site-footer')[0]
    .replace(/<(pre|code|script|style|svg)\b[\s\S]*?<\/\1>/g, " ")
    .replace(labels ? /<(pre)\b[\s\S]*?<\/\1>/g : /<(strong)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|’/g, "'")
    .replace(/&quot;|[“”]/g, '"')
    .replace(/"[^"]*"/g, " ")
    .replace(/\s+/g, " ");
}

/** The sentence a match stands in, for the failure's message. */
const around = (text, found) => text.slice(Math.max(0, found.index - 60), found.index + 60);

for (const route of ["/", ...Object.keys(PAGES)]) {
  const text = words(route);
  const headings = [...page(route).matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/g)].map(([, heading]) => heading.replace(/<[^>]+>/g, ""));

  test(`${route} has no stock phrase`, () => {
    const found = STOCK.exec(text);
    assert.equal(found, null, found && around(text, found));
  });

  if (!COPIES.includes(route)) {
    test(`${route} joins no sentence with a dash`, () => {
      const found = DASH.exec(text);
      assert.equal(found, null, found && around(text, found));
    });
  }

  if (route !== "/privacy/") {
    test(`${route} never speaks as "we"`, () => {
      const found = WE.exec(text);
      assert.equal(found, null, found && around(text, found));
    });
  }

  // The app's own labels, such as Delete my account data, are written as the app writes them.
  test(`${route} speaks as "I" only in a question the reader asks`, () => {
    let rest = words(route, { labels: false });
    for (const heading of headings.filter((heading) => heading.trim().endsWith("?"))) rest = rest.replace(heading.replace(/&#39;|’/g, "'").replace(/\s+/g, " ").trim(), " ");
    const found = I.exec(rest);
    assert.equal(found, null, found && around(rest, found));
  });
}
