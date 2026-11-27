---
title: "Program file format"
description: "Every field of the JSON file a program is imported from."
---

<!-- A copy: change the app's note, then run scripts/sync-formats.mjs. -->

Overload Vector imports a program as one JSON file (Program → Import program). This note is the format's
reference, for writing a program by hand or with Claude. The import is strict. It reports every
problem at once with its path, such as `blocks[1].days[0].groups[2].slots[0].exercise: unknown
exercise "bb_row"`, and a file with any problem imports nothing.

## Shape

```
program  { format: 1, title, author?, description?, focus?, targets?, blocks[], newExercises? }
block    { id, name, weekStart, weekEnd, weeks?, days[] }   (a block's weeks entries may hold days[], an order)
day      { id, name, weekStart?, weekEnd?, weeks?, groups[] }   (a day's weeks entries may hold groups[])
group    { type?: "straight" | "superset", slots[] }
slot     { id, exercise, alternatives?, note?, sets[], weeks? }
set      { count?, reps, rir?, rest?, technique?, backoff?, weeks? }
```

Unknown fields are errors, so a typo can't be ignored silently.

### Program

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Always `1`. |
| `title` | yes | Shown on Today and the Program screen. |
| `author`, `description` | no | Text. |
| `focus` | no | The program focus: up to two muscle groups to bring up, by name (`["Chest", "Shoulders"]`), from `Chest`, `Back`, `Shoulders`, `Arms`, `Legs`, `Glutes` and `Core`, each once. Leave it out, or `[]`, for none. A check-in and New program's review read it. |
| `targets` | no | Training targets for this program alone, over the standing ones (Settings → Training style; below). |
| `blocks` | yes | The blocks in order. Weeks run from 1 with no gaps: the first block starts at week 1, and each block starts the week after the previous one ends. |
| `newExercises` | no | Exercises the program uses that the shipped library doesn't have, as a coach reply's `newExercises`: `id`, `name`, `equipment`, `pattern`, `grip`, `muscles`, `secondary`. Export writes them; Import program adds those the program uses, skips one the library already has by id, and rejects one that clashes by name. Only Import program reads it: inside a coach reply the program has none (the reply's own `newExercises` holds them). |

### Targets

Every field is optional, and one left out follows the standing training targets. An empty
`targets` is the same as none.

| Field | Values |
| --- | --- |
| `goal` | `"hypertrophy"`, `"strength"` or `"both"` |
| `volume` | `"14-20"`: work sets per muscle a week, a range like a set line's `reps`, each end 1–40, the low end not above the high |
| `acrossBlock` | `"steady"` or `"rising"` |
| `frequency` | `"1"`, `"2"`, `"2-3"` or `"3+"`: times a week each muscle is trained |
| `failure` | `"isolation_and_machines"`, `"never"` or `"any"` |
| `calibration` | `true` or `false` |
| `repRanges` | `{ "compound": "5-10", "isolation": "8-15" }`, each a range like `reps`, each end 1–30; either may be left out |

```json
"focus": ["Chest"],
"targets": { "volume": "14-20" }
```

### Block

A run of weeks that train the same days. `id` is lowercase letters, digits and `_`, unique in the
program. `weekStart` and `weekEnd` are program weeks, both included. `days` are trained in order,
once each per week. `weeks` holds week overrides for every set in the block (below).

Program's Edit block rewrites the blocks: weeks added or removed at a block's end, a block
added (a copy keeps the day and slot ids under a block id of its own, `build_2`), removed or moved.
Every week the file names is a program week, so each block after the change is written again with
its weeks moved: its `weekStart` and `weekEnd`, and every `weeks` key in it, its days' and slots'
and set lines' included. A week added copies the block's last week that isn't a deload, its sets and
overrides with it, but not a day's own `groups` or a block's `days` order for that week: those keep
weeks already trained as they ran, and a week added hasn't been. A block added as a copy leaves them
out too, and the days a block removed or added part-way (`weekStart`, `weekEnd`): it is the block as
its last week runs.

### Day

`id` is unique within the block, and `name` is what Today shows ("Day A — Heavy bench, squat,
pulldown"). `groups` are done in order. `weeks` holds week overrides for every set of the day.

`weekStart` and `weekEnd` are the weeks of its block it runs, when that isn't all of them: a day
added part-way through the block runs from its `weekStart`, one removed part-way through until its
`weekEnd` (Program writes them when you add or remove a day in the block you're in). Each is
within the block's weeks, and `weekEnd` isn't before `weekStart`. Every week of a block has a day
to train. Sessions, the position and Changes name a day by its `id`, never its place, so keep a
day's id when you reorder or rename it.

### Group

`"straight"` (the default) has exactly one slot. `"superset"` has exactly two, done alternately.
Today numbers groups from 1, and superset slots get `a` / `b` (`5a`, `5b`).

### Slot

A place in the day for one exercise.

| Field | Meaning |
| --- | --- |
| `id` | Unique within the block. Changes and the coach name a slot by its id, so use the same id for the same place in other blocks (`bench` in every block's Day A). An exercise added on Program gets its exercise's id (`db_lateral_raise`, then `db_lateral_raise_2`), the same in every block it's added to. |
| `exercise` | The planned exercise: an exercise library id. An exported program shows the ids of its exercises. An id the library merged into another is rejected with the id to use. The old id of a bar (`safety_bar_squat`, `trap_bar_deadlift`) is read as its lift (`barbell_squat`, `deadlift`), which starts on that bar; new files name the lift. |
| `alternatives` | Exercises the program allows instead, in order of preference. Each is an id, or `{ "exercise": id, "sets": [...] }` for an alternative with its own sets. **An alternative does the slot's sets unless it has its own.** |
| `note` | The program's cue for this slot ("use straps"). The exercise's own technique note comes from the library; the prescription sheet shows both. |
| `sets` | The set lines, in order. |
| `weeks` | The sets it trains in some weeks instead (below). Program writes them when you edit the exercise week by week, and for the weeks already trained when you edit the block you're in. |

### Set line

Every line is work sets. The app generates warm-ups from the first work set's weight, so they
aren't written. The program never prescribes a load. Weights come from progression.

| Field | Default | Meaning |
| --- | --- | --- |
| `count` | `1` | How many sets have this prescription (1–10). |
| `reps` | required | A fixed number (`8`) or a range (`"8-10"`). |
| `rir` | none | Target reps in reserve (0–10). `0` is to failure. |
| `rest` | `120` | Seconds of rest after the set (0–600). |
| `technique` | none | One intensity technique for each set of the line (below). |
| `backoff` | none | `{ "from": 0, "percent": 10 }`: these sets are back-offs from the first set of line `from` (an earlier line that isn't a back-off itself). Their weight is that set's weight minus `percent` (1–50), rounded down to a rung of the equipment. Both fields are optional; `{}` means 10% off line 0. |
| `weeks` | none | Week overrides for this line (below). |

To put a technique on the last set only, write the last set as its own line:

```json
"sets": [
  { "reps": "10-12", "rir": 0, "rest": 90 },
  { "reps": "10-12", "rir": 0, "rest": 90, "technique": { "kind": "myo_reps", "miniSetReps": 4 } }
]
```

### Techniques

| `kind` | Fields (defaults) |
| --- | --- |
| `dropset` | `drops` 1–3 (2), `percent` 5–50 (25): each drop's reduction |
| `myo_reps` | `miniSetReps` 1–10 (3); the set's `reps` are the activation reps. Mini-sets continue until one misses the target. `maxMiniSets` from older programs is accepted and ignored |
| `lengthened_partials` | none: always as many partials as you can. A `partials` count from older programs is accepted and ignored |
| `iso_hold` | `seconds` 1–300 (the app's steppers stop at 5 s and move in 5 s steps to 30 s, then 15 s steps) and `position` `"stretch"` or `"contraction"`, both required |
| `failure` | none |

### Week overrides

`weeks` maps program weeks to changes: a key is a week (`"1"`) or a range (`"7-11"`), inside the
block's weeks, and keys may not overlap.

- **On a set line**, an override replaces fields for those weeks: `count` (0 removes the line),
  `reps`, `rir`, `rest`, `technique` (`null` removes it). A line that a back-off points at can't be
  removed.
- **On a day or a block**, an override changes every set in it: `rir` (sets the target), `rirAdd`
  (adds to the target, −5 to 5), `technique: null` (no techniques), `fewerSets` (removes that
  many sets from the end of every slot; one set always stays), and `deload: true`, which marks
  those weeks as a deload: their sets can raise an exercise's estimate but never lower it, and
  progression doesn't step down after them. `halfSets: true` keeps the first half of every slot's
  sets, rounded up (3 of 5, 1 of 1), after `fewerSets`. `rir` and `rirAdd` can't both be used in one
  entry. A planned deload switched on in Program's Edit block is written as a block's entry
  `{ "rirAdd": 2, "technique": null, "halfSets": true, "deload": true }`, the Deload week Change's
  rule (half the sets, RIR + 2, no techniques).

- **On a day**, an entry can also hold the groups it trains those weeks in place of its own
  `groups`: `{ "groups": [...] }`, groups as above, with or without the changes to every set. Program
  writes them for the weeks already trained when you edit the day's exercises in the block you're in
  (swap, add, remove, reorder or their alternatives), so those weeks keep the day they trained. A
  slot there is the same place as the day's slot of the same id: it may repeat the day's own ids,
  once each, but not another day's. Only a day's entries hold `groups`.
- **On a block**, an entry can also hold the order those weeks train their days in, by id, in
  place of `days`' order: `{ "days": ["a", "b", "c"] }`. Each week of its key must train exactly
  those days (the days that run that week). Program writes it for the weeks already trained when you
  reorder a block's days in the block you're in, so those weeks keep the order they trained in.
  Only a block's entries hold `days`.
- **On a slot**, an override holds the set lines it trains those weeks in place of its own `sets`:
  `{ "sets": [...] }`, lines as above but without `weeks` of their own. A back-off's `from` points
  at a line of the override's own `sets`.

```json
"sets": [ { "count": 3, "reps": "5-7", "rir": 2, "rest": 180 } ],
"weeks": { "3-4": { "sets": [ { "reps": "4-6", "rir": 1, "rest": 180 }, { "count": 2, "reps": "6-8", "rir": 1, "rest": 180, "backoff": {} } ] } }
```

They apply in this order: the slot's override or the line's own, then the block's, then the
day's. So a day's `"rir": 3` in a deload week wins over everything.

## Workouts

A workout from the coach is one day in this format, outside any
program: `{ "workout": { "name", "summary", "groups" } }`, with the groups, slots and set lines
above and no week overrides. It is checked with the same rules and paths,
under `workout.` (`workout.groups[0].slots[0].exercise: unknown exercise "bb_row"`), and slot ids
are unique within it.

## New programs from the coach

A new program from a check-in is a program file in this format
inside `{ "program": …, "swaps": […], "newExercises": […] }`, checked with the same rules and
paths under `program.`. `newExercises` may add library exercises the program uses; the program is
checked against the library and them, and Start program saves them with it.

## Running a program

With training days set in the app, the days take turns on them, in the file's order (each week the
days that run that week, in its order): each training day takes the next day, and a missed one is
skipped. A file
written for a week names each day for its training day (`Day A — Mon · …`), but nothing in the file
ties a day to a weekday. Without training days the program runs as a sequence: Today shows the next
day, and finishing a session of it makes the day after the next one (the next day of the block,
then the first day of the next week). Importing another program replaces the one running and
starts it at week 1, day 1; past sessions are kept.

## Example

Two weeks of one day, written the way Overload Vector Full Body, the app's starter program, is:
a ramp-in week, a bench top set with back-offs, a superset with techniques on the last set, and a
deload week.

```json
{
  "format": 1,
  "title": "Example",
  "author": "Overload Vector",
  "blocks": [
    {
      "id": "ramp_in",
      "name": "Ramp-in",
      "weekStart": 1,
      "weekEnd": 1,
      "weeks": { "1": { "rirAdd": 1, "technique": null } },
      "days": [
        {
          "id": "a",
          "name": "Day A — Heavy bench, squat, pulldown",
          "groups": [
            { "slots": [ {
              "id": "bench",
              "exercise": "barbell_bench_press",
              "alternatives": ["smith_machine_bench_press"],
              "note": "Same grip, setup and pause every rep.",
              "sets": [
                { "reps": "4-6", "rir": 1, "rest": 180 },
                { "count": 2, "reps": "6-8", "rir": 1, "rest": 180, "backoff": { "from": 0, "percent": 10 } }
              ]
            } ] },
            { "type": "superset", "slots": [
              {
                "id": "lateral_raise",
                "exercise": "cable_lateral_raise",
                "alternatives": ["machine_lateral_raise", "db_lateral_raise"],
                "sets": [
                  { "reps": "10-12", "rir": 0, "rest": 90 },
                  { "reps": "10-12", "rir": 0, "rest": 90, "technique": { "kind": "myo_reps", "miniSetReps": 4 } }
                ]
              },
              {
                "id": "overhead_triceps",
                "exercise": "overhead_cable_triceps_extension",
                "alternatives": ["overhead_db_triceps_extension"],
                "sets": [ { "reps": "10-12", "rir": 0, "rest": 90, "technique": { "kind": "dropset", "drops": 2 } } ]
              }
            ] }
          ]
        }
      ]
    },
    {
      "id": "build",
      "name": "Build",
      "weekStart": 2,
      "weekEnd": 3,
      "days": [
        {
          "id": "a",
          "name": "Day A — Heavy bench, squat, pulldown",
          "weeks": { "3": { "rir": 3, "technique": null, "fewerSets": 1, "deload": true } },
          "groups": [
            { "slots": [ {
              "id": "bench",
              "exercise": "barbell_bench_press",
              "alternatives": ["smith_machine_bench_press"],
              "note": "Same grip, setup and pause every rep.",
              "sets": [
                { "reps": "4-6", "rir": 1, "rest": 180, "weeks": { "3": { "reps": "3-5" } } },
                { "count": 2, "reps": "6-8", "rir": 1, "rest": 180, "backoff": {} }
              ]
            } ] }
          ]
        }
      ]
    }
  ]
}
```

## What the format can't say yet

- A load rule such as "a single at the bench goal if the estimate is within 3% of it" (the Full Body week-12
  test). Write a plain `1` rep set and put the rule in the slot's note, as the starter program does. The app suggests the single's weight from
  the estimate, as for any new rep range.
- Percentages of a training max, AMRAP sets for progression, and circuits: not supported.
