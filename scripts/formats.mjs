// Turns one of the app's file format notes into a page of the site. The app keeps the notes; the
// site holds copies that read for users. sync-formats.mjs writes them.

/** What only the app's own readers can follow, so it must never reach the site. */
const PRIVATE = [
  /\bapp\/src\/\S*/,
  /\bSPEC\b/,
  /#\d+/,
  /\bdocs\/\S*/,
  /\bADR\b/,
  /\bGLOSSARY\b/,
  /\b(?:CLAUDE|AGENTS)\.md\b/,
  /Hyperlog/,
  /\b[A-Za-z]+(?:Parser|Test)\b/,
];

/** References a reader can do without, dropped wherever they are. */
const DROPPED = [
  // A bracket that opens on the spec or on a file of the app's.
  /\s*\((?:`SPEC\.md`|SPEC\b|`(?:app|docs)\/)[^()]*\)/g,
  // Ticket numbers in a bracket of their own, "(#402, #416)", or at the end of one, ", #402)".
  / \(#\d+(?:, #\d+)*\)/g,
  /(?:, #\d+)+(?=\))/g,
  // A decision record at the end of a bracket.
  /; ADR \d+(?=\))/g,
];

/**
 * A note's `markdown` as a site page, headed by `title` and `description`. Each of the `rewrites`,
 * [words or a pattern, their replacement], rewords what is left once the references are dropped.
 */
export function convert(markdown, { title, description, rewrites }) {
  let body = markdown.replace(/^# .*\n/, "").trim();
  for (const reference of DROPPED) body = body.replace(reference, "");
  for (const [from, to] of rewrites) {
    const found = typeof from === "string" ? body.includes(from) : from.test(body);
    if (!found) {
      throw new Error(`${title}: a rewrite's words are no longer in the note: "${from}"`);
    }
    body = body.replace(from, () => to);
  }
  const left = PRIVATE.map((pattern) => body.match(pattern)?.[0]).filter(Boolean);
  if (left.length > 0) {
    throw new Error(`${title}: these can't be published, so add a rewrite: ${left.join(", ")}`);
  }
  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
---

<!-- A copy: change the app's note, then run scripts/sync-formats.mjs. -->

${body}
`;
}
