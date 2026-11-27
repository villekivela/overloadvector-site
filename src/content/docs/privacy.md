---
title: Privacy policy
description: What stays on your phone, what leaves it and when, for the Overload Vector app, server and website.
---

*Last updated 27 November 2026.*

Overload Vector is a strength-training app for Android. Your training stays on your phone and
leaves it only for the things you switch on below. There are no ads, no analytics and no
trackers, and nothing is sold or shared for advertising.

## What stays on your phone

Everything you put in the app: programs, sessions, gyms and equipment, bodyweight, goals, notes,
your training style and your settings. The app needs no account and works without a network. A photo
of a weight stack is read on the phone and deleted once read; the app's text reader sends nothing.

## Backups

- **A backup file** is made only when you tap **Export backup**, and saved where you choose.
- **Android's backup** copies the app's data to your Google account about once a day, if backup is on
  in your phone's settings. Google keeps it under
  [Google's privacy policy](https://policies.google.com/privacy). You manage it in your phone's
  Google settings.

Neither holds your Claude key or your connector sign-in.

## Coaching with your own Claude key

If you add an Anthropic API key, the app talks to `api.anthropic.com` directly from your phone, with
your key. Nothing goes through our server. Anthropic handles what it receives under its own
[terms and privacy policy](https://www.anthropic.com/legal/privacy).

- **When you save the key**, the app checks it with a request that holds no training.
- **When you check in**, it sends your answers and what Claude needs to answer: your program with its
  notes, the Changes in force with the earlier check-in that made each one (its questions and your
  answers, which may mention pain), your recent sessions and weekly sets, your training days, goals
  and gyms with their equipment, the exercise library, and your training style, including your age
  band, aches and anything you typed there, where you've filled them in.
- **When you attach a file** (a spreadsheet, PDF or photo) to build a program, or ask Claude to read
  a weight stack from a photo, that file or photo is sent.

The key is stored encrypted on the phone. **Remove** in Settings forgets it.

## Connecting Claude to your Overload Vector account

Nothing here happens unless you tap **Connect Claude** and agree.

**What is copied.** So that Claude can read it, the app copies your training to your Overload Vector
account on our server: sessions, programs, Changes, exercise histories and estimates, lift goals,
bodyweight, your training days with their gyms and minutes, gyms and equipment, your exercise
library with your own edits, your training style and sore spots, the check-ins behind your Changes
(their questions and your answers), and what you typed (such as gym names and notes). This is health
data, and we keep it only because you agreed. Your Claude key and photos are never copied.

With each copy the server also records the app version, the time, and a random device ID that tells
your phones apart.

**Sign-in.** You sign in with Google, which handles the sign-in under
[Google's privacy policy](https://policies.google.com/privacy), or, if we have invited your email
address, with a one-time code mailed to it. An invitation adds your address to our sign-in service
(Amazon Cognito) before you first sign in. Your email address and your sign-in, with Google or by an
emailed code, are held by that service. The training copy is filed under an opaque ID, not your name
or email. It is still your personal data, because the sign-in service can tie the ID back to you.

**What Claude does with it.** Claude, in its own app and when you ask it, reads the copy and may
propose a Change, a workout or a program. A proposal waits on our server until the app picks it up.
When you accept or decline it, your answer (or why the app couldn't use the proposal) is sent back
and kept with it, where Claude can read it. What Claude reads there is handled under Anthropic's
terms. The copy is never sent back to a phone.

**Where.** On Amazon Web Services, in the EU (region eu-north-1, Stockholm, Sweden). Amazon processes
it for us. If you sign in by email, Amazon SES in the same region sends the code to your address. We
share it with nobody else.

**How long.** Until you delete it. A proposal, answered or not, is deleted 30 days after Claude made
it. Server logs, which hold the opaque ID but no training data, are kept for 30 days. The database's recovery copies
keep deleted data for up to 35 days.

**Deleting it.** **Settings → Delete my account data** deletes the copy, any waiting proposals and your
Overload Vector account, after you sign in once more. The training on your phone stays.
**Disconnect** only stops the copying. After it, the phone still remembers which account was
connected, so that a later delete can't remove another one, until you delete that account or connect
again.

## Other connections the app makes

- **Update check.** The app downloaded from our releases page asks GitHub
  (`api.github.com`) whether a newer version exists, and downloads it from GitHub when you tap the
  update. The request says nothing about you or your training; GitHub sees your network address, as
  any website does. **Settings → Check for updates** switches it off.
- **Links you open**, such as an exercise's technique video on YouTube, open in your browser and are
  covered by that site's policy.

## This website

The site is hosted on GitHub Pages, and GitHub may log visitors' network addresses to run it. We add
no cookies, analytics or trackers. Your light or dark choice is remembered in your own browser.

## When you email us

Mail to `support@overloadvector.com` is forwarded to our mailbox by our domain registrar, Porkbun. We
use it to answer you, and you can ask us to delete it.

## Why we may process it, and your rights

The connector's copy is processed with your **consent**, which you can withdraw at any time with
**Delete my account data**. Email you send us is processed to answer you. Under EU data protection law
you can ask to see, correct, delete or receive your data, object to its processing, and complain to
your data protection authority. Most of it you can do yourself in the app; for the rest, email us.

## Changes and contact

We'll update this page when what the app does with data changes, with the date at the top. Questions
and requests: [support@overloadvector.com](mailto:support@overloadvector.com).
