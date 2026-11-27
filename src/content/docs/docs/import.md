---
title: Coming from Hevy or Strong
description: Import your training history from Hevy's or Strong's CSV export.
---

You can bring the sessions you logged in Hevy or Strong with you, so your history doesn't start
empty. Programs don't come across.

## Export from the other app

- **Hevy:** open its settings and export your data. The workouts file holds your sessions. The
  measurements file holds your bodyweight; import it as well if you want that.
- **Strong:** open its settings and export your data.

Each app gives you a CSV file. Save it somewhere your phone can open it, such as Downloads.

## Import

- **Settings → Import from another app**, then pick the file.
- On a new phone, Setup's first screen has **Coming from Hevy or Strong? Import your history** under
  its Start button.

Nothing is written until you have looked at what the file holds and tapped **Import**. The app asks:

- **kg or lb**, if the file doesn't say. Check it: a Strong file may not name its unit.
- **Which gym** the history is from. Machine and cable sets join that gym's matching machines.
- **Exercises it doesn't recognise.** Tap a name to match it to an exercise in the library, which
  offers similar names first, or leave it skipped. Skipped names are listed at the end.

It also names the machines in the file that your gym doesn't have.

## What comes in

- Each session with its date and times, and its sets with weight and reps.
- Effort: an RPE in the file becomes reps in reserve (10 − RPE, rounded down, at most 4+). A set
  with no RPE has none. It still shows as last time and counts toward your weekly sets, but it
  doesn't move your estimate or a suggestion.
- Warm-ups stay warm-ups. Drop sets and sets to failure stay marked as such. A set to failure with
  no RPE counts as 0 in reserve.
- Bodyweight, from Hevy's measurements file, on days that have none yet.

Sets timed or measured by distance don't come across, and neither do exercises you skip, workout
names, notes or superset pairings.

**Machines your gym doesn't have.** Those sets show on Progress, and Claude can read them, but the
app doesn't suggest weights from them. If you want a machine's history to carry on,
[add it to your gym](/docs/gyms/) under the exercise's name before you import. On a new phone,
that means finishing Setup, adding the machines, then importing from Settings.

**Importing again is safe.** A session already imported, or one overlapping a session on the phone,
is skipped.

If you've [connected Claude](/docs/coaching/), imported sessions are copied like any other, and
Claude sees which app they came from.

## Take an import back

**Settings** lists each import. **Remove** deletes exactly what that import brought in; what you
logged in Overload Vector stays. To change how exercises were matched, remove the import and import
the file again.
