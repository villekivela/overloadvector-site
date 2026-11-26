// Writes the site's copies of the app's file format notes. Run it when either note changes:
//
//   npm run formats -- <path to the app repo>
//
// References into the app's repository are dropped (formats.mjs); each rewrite here rewords what
// is left. When a note's words change, the copy stops and names the rewrite to update.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { convert } from "./formats.mjs";

const NOTES = {
  "program-format": {
    title: "Program file format",
    description: "Every field of the JSON file a program is imported from.",
    rewrites: [
      ["The validator is strict.", "The import is strict."],
      ["The check-in's context and", "A check-in and"],
      ["Overload Vector Full Body is:", "Overload Vector Full Body, the app's starter program, is:"],
      ["an exercise library id.", "an exercise library id. An exported program shows the ids of its exercises."],
      [/`\w+Parser\.\w+` checks it/, "It is checked"],
      [" A test parses this example against the shipped library, so it stays valid.", ""],
      ["as Full Body does.", "as the starter program does."],
      ["circuits: out of v1.", "circuits: not supported."],
    ],
  },
  "gym-format": {
    title: "Gym file format",
    description: "Every field of the JSON file a gym and its equipment are imported from.",
    rewrites: [[/ `SPEC\.md` \([^()]*\) has the product rules\./, ""]],
  },
};

const app = process.argv[2];
if (!app) {
  console.error("Usage: npm run formats -- <path to the app repo>");
  process.exit(1);
}
const pages = fileURLToPath(new URL("../src/content/docs/docs/", import.meta.url));
for (const [name, spec] of Object.entries(NOTES)) {
  const page = convert(readFileSync(join(app, "docs", `${name}.md`), "utf8"), spec);
  writeFileSync(join(pages, `${name}.md`), page);
  console.log(`Wrote src/content/docs/docs/${name}.md`);
}
