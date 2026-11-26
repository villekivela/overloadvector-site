import assert from "node:assert/strict";
import { test } from "node:test";
import { convert } from "../scripts/formats.mjs";

const spec = {
  title: "Gym file format",
  description: "One gym as a file.",
  rewrites: [["The app's parser (`app/src/Parser.kt`) is strict.", "The import is strict."]],
};

const source = `# Gym file format

The app's parser (\`app/src/Parser.kt\`) is strict.

A week added (#416) copies the last one (#402, #416).
It stays (Program writes it, #402).

\`\`\`json
{ "format": "hyperlog-gym" }
\`\`\`
`;

test("a format note becomes a site page without the app's own references", () => {
  assert.equal(
    convert(source, spec),
    `---
title: "Gym file format"
description: "One gym as a file."
---

<!-- Copied from the app's own notes by scripts/formats.mjs. Change it there, then copy it again. -->

The import is strict.

A week added copies the last one.
It stays (Program writes it).

\`\`\`json
{ "format": "hyperlog-gym" }
\`\`\`
`,
  );
});

test("a rewrite whose words are gone stops the copy", () => {
  assert.throws(
    () => convert("# Gym file format\n\nNew words.\n", spec),
    /no longer in the note: "The app's parser/,
  );
});

for (const [what, line] of [
  ["a source file", "See `app/src/main/Thing.kt`."],
  ["the spec", "See `SPEC.md`, Coaching."],
  ["a ticket", "Since #512 this changed."],
  ["another of the app's notes", "As in `docs/programs/starter.md`."],
  ["the old name", "Written for Hyperlog."],
]) {
  test(`${what} left in a note stops the copy`, () => {
    const note = `${source}\n${line}\n`;
    assert.throws(() => convert(note, spec), /can't be published/);
  });
}
