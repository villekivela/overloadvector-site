// Copies the app's two file format notes into the site's docs. The app keeps them; the site holds
// a copy that reads for users.
//
//   node scripts/sync-formats.mjs <path to the app repo>

/** What only the app's own readers can follow, so it must never reach the site. */
const PRIVATE = [
  /\bapp\/src\/\S*/,
  /\bSPEC\b/,
  /#\d+/,
  /\bdocs\/\S*/,
  /Hyperlog/,
  /\b[A-Za-z]+(?:Parser|Test)\b/,
];

/** A note's `markdown` as a site page. `spec` holds the page's head and the note's rewrites. */
export function convert(markdown, { title, description, rewrites }) {
  let body = markdown.replace(/^# .*\n/, "").trim();
  for (const [from, to] of rewrites) {
    if (!body.includes(from)) {
      throw new Error(`${title}: a rewrite's words are no longer in the note: "${from}"`);
    }
    body = body.replace(from, () => to);
  }
  // Ticket references: a bracket of their own, "(#402, #416)", or the end of one, ", #402)".
  body = body.replace(/ \(#\d+(?:, #\d+)*\)/g, "").replace(/(?:, #\d+)+(?=\))/g, "");
  const left = PRIVATE.map((pattern) => body.match(pattern)?.[0]).filter(Boolean);
  if (left.length > 0) {
    throw new Error(`${title}: these can't be published, so add a rewrite: ${left.join(", ")}`);
  }
  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
---

<!-- Copied from the app's own notes by scripts/formats.mjs. Change it there, then copy it again. -->

${body}
`;
}
