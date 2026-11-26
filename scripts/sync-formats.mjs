// Writes the site's copies of the app's file format notes. Run it when either note changes:
//
//   npm run formats -- <path to the app repo>
//
// Each rewrite replaces words that only make sense inside the app's own repository. When a note's
// words change, the copy stops and names the rewrite to update.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { convert } from "./formats.mjs";

const NOTES = {
  "program-format": {
    title: "Program file format",
    description: "Every field of the JSON file a program is imported from.",
    rewrites: [
      [
        "The validator\n(`app/src/main/java/com/hyperlog/app/program/ProgramParser.kt`) is strict.",
        "The import is strict.",
      ],
      [
        "The check-in's context and New program's review read it (`SPEC.md`, Coaching → Training style).",
        "A check-in and New program's review read it.",
      ],
      [
        "an exercise library id (`app/src/main/assets/exercises.json`).",
        "an exercise library id. An exported program shows the ids of its exercises.",
      ],
      [
        "A workout from the coach (`SPEC.md`, Coaching → Workout) is",
        "A workout from the coach is",
      ],
      [
        "above and no week overrides. `ProgramParser.workout` checks it with the same rules and paths,\nunder `workout.`",
        "above and no week overrides. It is checked with the same rules and paths,\nunder `workout.`",
      ],
      [
        "A new program from a check-in (`SPEC.md`, Coaching → New program) is",
        "A new program from a check-in is",
      ],
      [
        "skipped (SPEC, Training days and the rotation). A file",
        "skipped. A file",
      ],
      [
        "Overload Vector Full Body (`docs/programs/full-body-3-day.md`) is:",
        "Overload Vector Full Body, the app's starter program, is:",
      ],
      [" A test parses this example against the shipped library, so it stays valid.", ""],
      [
        "as Full Body does\n  (`app/src/main/assets/programs/full-body-3-day.json`).",
        "as the starter program does.",
      ],
      [
        "circuits: out of v1 (`SPEC.md`).",
        "circuits: not supported.",
      ],
    ],
  },
  "gym-format": {
    title: "Gym file format",
    description: "Every field of the JSON file a gym and its equipment are imported from.",
    rewrites: [
      [" `SPEC.md` (Gyms and equipment → Importing a gym) has the product rules.", ""],
      ["(the weekday plan is yours, not the gym's; ADR 0004)", "(the weekday plan is yours, not the gym's)"],
      ["read in (SPEC, Units).", "read in."],
    ],
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
