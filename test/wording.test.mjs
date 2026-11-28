import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "./dist.mjs";
import { PAGES } from "./pages.mjs";

// The site's voice: Overload Vector and "you", in plain words. The privacy policy speaks as "we",
// the party that answers for the data, and the FAQ asks its questions as the reader would.
const WE = /\b(we|us|our|ours)\b/i;
const FIRST_PERSON = /\b(I|[Mm]y|[Mm]e)\b/;
const STOCK_PHRASE = /\b(seamless(ly)?|empower\w*|journey|effortless(ly)?|unlock\w*|elevate\w*|leverage\w*|simply|real life|game.chang\w*|safety net)\b/i;
// Connecting Claude takes an Overload Vector account, so no page may say the app needs none.
const NO_ACCOUNT = /\b(no|without an) account\b/i;
// A dash that joins two halves of a sentence. A range such as 6–8 has no spaces round it.
const JOINING_DASH = /\s[—–]\s/;
// Copies of the app's notes, whose examples name days as the app does ("Day A — Heavy bench").
const FORMAT_PAGES = ["/docs/program-format/", "/docs/gym-format/"];

const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#39;|’/g, "'").replace(/&quot;|[“”]/g, '"').replace(/\s+/g, " ").trim();
const without = (html, tags) => html.replace(new RegExp(`<(${tags})\\b[\\s\\S]*?</\\1>`, "g"), " ");

/** A page's own part, between the header and the footer, without code. */
function main(route) {
  const html = page(route);
  const start = html.indexOf("<main");
  assert.ok(start >= 0, `${route} has no main part`);
  return without(html.slice(start).split('<footer class="site-footer')[0], "pre|code|script|style|svg");
}

/** What a visitor reads there, without what the page quotes: an app's line, or words to say to Claude. */
const words = (html) => plain(html).replace(/"[^"\n]{0,200}"/g, " ");

function assertNone(pattern, text) {
  const found = pattern.exec(text);
  assert.equal(found, null, found && `…${text.slice(Math.max(0, found.index - 60), found.index + 60)}…`);
}

for (const route of ["/", ...Object.keys(PAGES)]) {
  test(`${route} has no stock phrase`, () => assertNone(STOCK_PHRASE, words(main(route))));

  test(`${route} never says the app needs no account`, () => assertNone(NO_ACCOUNT, words(main(route))));

  if (!FORMAT_PAGES.includes(route)) {
    test(`${route} joins no sentence with a dash`, () => assertNone(JOINING_DASH, words(main(route))));
  }

  if (route !== "/privacy/") {
    test(`${route} never speaks as "we"`, () => assertNone(WE, words(main(route))));
  }

  // The app's own labels, in bold, are written as the app writes them (Delete my account data), and
  // the home page's Change opens with what its reader told Claude.
  test(`${route} speaks as "I" only in a question the reader asks`, () => {
    const html = without(main(route).replace(/<p class="said"[\s\S]*?<\/p>/g, " "), "strong|b");
    const answers = html.replace(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/g, (heading, level, text) => (plain(text).endsWith("?") ? " " : heading));
    assertNone(FIRST_PERSON, words(answers));
  });
}
