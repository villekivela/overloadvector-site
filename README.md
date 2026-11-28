# overloadvector.com

The website of Overload Vector, a strength-training app for Android: its home page, user docs, FAQ,
privacy policy and contact page. It is built with [Astro Starlight](https://starlight.astro.build/)
and published on GitHub Pages.

## Working on it

Needs Node 22.23.4 or newer.

```sh
npm ci
npm run dev       # http://localhost:4321, without search
npm run build     # into dist/, with the search index
npm test          # checks the built site, in a headless Chrome too (set CHROME to choose one)
npm run preview   # serves dist/, search included
npm run stills    # redraws the home page's still phones (The home page)
npm run clips     # makes one of the phone's clips from a screen recording (Clips)
```

## The logo

The favicon and the social preview are generated in the app's repository
(`villekivela/overloadvector`, `brand/README.md`) and copied here. Never edit them here: regenerate
them there with `python3 -I tools/brand/brand.py`, then copy its `brand/site/` files over:

| From `brand/site/` | To |
| --- | --- |
| `favicon.svg`, `favicon.ico` | `public/` |
| `social-1200x630.png` | `public/social.png` |

The header and the footer draw the mark themselves (`src/components/Mark.astro`), in the text's
colour, beside the name in Mona Sans capitals. Running text says Overload Vector.

## The look

`src/styles/graphite.css` holds the look, as `--ov-` variables that Starlight's own are set from:
the app's Graphite greys, dark and light, and one signal colour, the orange `#e8571c` with `#111` on
it. The signal is for the primary action and "you are here"; a lit muscle is the same orange, as in
the app. Plates and reps-in-reserve chips keep the app's colours.

What you press, the home page's closing band and the pressed answer in Progression have the mark's
stepped corner, cut from their lower right.

Both themes meet WCAG AA, which `test/contrast.test.mjs` checks on the home page, two docs pages,
the FAQ and the privacy policy: text at 4.5:1, large text and the rim or line that tells a control's state at 3:1.
Orange text smaller than large would fail on the light theme: darken `--ov-signal-ink` there if a
page ever needs it.

Every page has the site's own header (`src/components/Header.astro`): the mark and the name, Docs
and FAQ, Starlight's search on every page but the home page, and Starlight's theme menu. The docs,
the FAQ and the other reading pages are Starlight's, with its sidebar and its list of the page's
headings, restyled in `graphite.css`.

## The pages

| Page | File |
| --- | --- |
| Home | `src/components/Home.astro`, then `src/content/docs/index.mdx` |
| User docs, `/docs/…` | `src/content/docs/docs/` |
| FAQ, contact, privacy policy | `src/content/docs/faq.md`, `contact.md`, `privacy.md` |

Write for users, in plain English, from the app as it is. The site speaks as Overload Vector and to
"you". Only the privacy policy says "we", and only the FAQ's questions say "I"; `test/wording.test.mjs`
checks that, and that no page joins a sentence with a dash. A new page goes in the sidebar
(`astro.config.mjs`) and in `test/pages.mjs`.

`/privacy/` is the app's privacy policy: its address must not change. Keep its date current.

### The home page

`src/components/Home.astro` is the whole home page: the name and the pitch, then what the app
does, section by section, beside one phone, then privacy and the band that offers the beta.
`index.mdx` only gives the page its title and description.

Each section has a small working model of what it describes, drawn by the page: Program's 12-week
block, Logging's set and its reps-in-reserve chips, Technique's muscles,
Progression's three steps and plates, Coaching's proposed Change. They show made-up training, and
read whole without JavaScript.

On a wide screen the phone is a 3D model drawn with three.js (`src/phone/`): it opens turned a
little further away, turns into place, slightly side on, over the first quarter of a view of
scroll, and from there on stands still, pinned, while each section's screen crossfades onto it as
the section reaches the middle of the view. Logging, Technique and Coaching play a clip of the app
there instead (Clips). Every section's words read at full strength. Behind the phone, at the top of
the page, stands the mark, as big as the window allows.
`phone.js` is the model, a Pixel 10 Pro's shape built from plain geometry, with no maker's logo and
nothing downloaded, and holds its two poses. `story.js` says what the phone shows at a scroll
position, how long its turn takes and where a section takes the screen, and `stage.js` drives the
model from it.

A narrow screen, a visitor who asked for less motion and a browser without WebGL get a still of the
same phone with each text instead, under it on a narrow screen and beside it on a wide one, and
never load three.js. Technique's still is the mannequin with its muscles lit, as the list beside it is. The stills are in `src/assets/phone/`,
drawn from the model by `npm run stills` (it needs Chrome, as the tests do). Run it after changing
the model, a pose or a screenshot the home page shows, and commit what it draws. Today's still stands
as the page opens, and holds the live phone's place until the model has loaded; the others stand as
it rests.

### Clips

`src/assets/clips/clip-<screen>-<theme>.webm`, `.mp4` and `.png`: what the live phone plays for a
screen, in place of its still. Muted and looping, a clip plays from its start whenever its section
becomes the current one, and pauses when another takes over. The `.png` is its first frame, which
the phone shows until the clip plays. The stills never load a clip.

Each is 4 to 8 s, and the WebM about 1 MB or less; `npm test` checks both, and that each loop
doesn't jump. Coaching's is up to 12 s: the scripted coach answers at once, so its question and
its proposed Change are each stopped a second or two longer with `+<t>:<d>` (below), or the
clip looks sped up. The test checks they stand still long enough to read. Record a clip on an Android emulator with made-up training (as Screenshots), at a
font scale of 1, in demo mode with the clock at 12:00. Start the emulator with `-gpu host`: drawn in
software the mannequin gets a few frames a second, and its turn to the muscles, which eases frame by
frame, takes a quarter of a minute.

```sh
adb shell screenrecord --size 640x1428 --bit-rate 40000000 /sdcard/rec.mp4
```

Then cut it, with ffmpeg on your path:

```sh
npm run clips -- rec.mp4 <screen> <light|dark> <from s> <to s> [<x:y:w:h[:a:b]>]
```

A loop closes on itself: the recording comes back to where it began, and the cut ends a frame
before it gets there, so the clip's last frame is next to its first. Logging types a set's reps,
logs it, takes it back and clears the reps; Technique turns the muscles layer on and off over two
reps of 4 s, starting where the rep holds; and Coaching closes the check-in's proposal back to
Coach. An argument `+<t>:<d>` stops the clip at its second t for d seconds more; put t where the
screen stands still (Coaching's: `1.45 10.12 +3.4:0.8 +7.95:1.5` dark, `1.4 9.78 +3.4:1.2 +7.7:1.6`
light, from recordings that tap a second and a half after they start). Something that repeats, such as the mannequin's rep, is best cut
a whole number of repeats long, starting where it holds. The last argument keeps a part of the
screen (x, y, width and height in the clip's pixels) as it is in the first frame, for the session
clock, which only counts on; `:a:b` lets it go between the clip's seconds a and b, while the rest
timer takes its place. The script prints the seam beside a step from one frame to the next: a seam
well below the step will show. Retake both themes together, so that the section looks the same in
either.

A section with a clip puts only that on the live phone: Technique's clip shows its muscles, so the
live phone doesn't change to `muscles`, which the stills show.

The list of muscles beside Technique's clip lights and dims with the clip. `LIT` in
`src/components/Home.astro` holds, for each theme, the seconds between which that clip's muscles
are lit; `src/phone/stage.js` marks the stage `data-unlit` outside them, and the list is lit
whenever the clip isn't playing. After cutting the clip again, measure the two times again: write
the clip out frame by frame with `ffmpeg` (30 a second), find the first frame with the muscles
orange and the first without, and divide each frame's number by 30.

The coach's clip uses the scripted coach (Settings → Scripted coach, debug builds), never a real
key or account. No clip shows a technique video or any of its frames.

### The file format pages

`program-format.md` and `gym-format.md` are copies of the app's own notes, so don't edit them here.
When a note changes:

```sh
npm run formats -- <path to the app repo>
```

It stops if a note holds something only the app repo's readers can follow, or if words it rewrites
have changed: update `scripts/sync-formats.mjs` then.

### Screenshots

`src/assets/shots/shot-<screen>-light.png` and `-dark.png`, 640 px wide, from the app on an Android
emulator with made-up training. No real person's data, and nothing that shows a debug build.
`shot-muscles-*` is on no page: it is the screen of Technique's still phone, which
`npm run stills` draws from it.

A docs page places both, the light one first, inside `<div class="shots">`; the theme picked in the menu
shows its own:

```md
![What the screen shows](../../../assets/shots/shot-today-light.png)
![What the screen shows](../../../assets/shots/shot-today-dark.png)
```

## Fonts

Mona Sans, condensed to 75% at weight 800 and set in capitals, for the name, a page's title, its
sections' headings and large figures; Inter for everything else, smaller headings included (`src/styles/fonts.css`). They are served from this site, never
from a font service, and their licences are published beside them (`public/fonts/`) and linked in
the footer.

`src/assets/fonts/` holds them as woff2. Mona Sans is the app's one cut, whole, packed with
`woff2_compress`. Inter's three weights are the app's files, which keep the hyphen proportional
under tabular figures, cut down to the letters the site can need:

```sh
pyftsubset inter-400.woff2 --flavor=woff2 --layout-features='*' --output-file=inter-400.woff2 \
  --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2122,U+2190-2199,U+2212,U+2248,U+2260-2265,U+22EE,U+2713"
```

That is Basic Latin, Latin-1 and Latin Extended-A, the dashes, quotes and arrows, and a few signs.
`npm test` fails if a page draws any text in a font of the visitor's own, so a letter outside these
shows there. The app's ⋮ is the exception: Inter doesn't have it.

## Publishing

Push to `main`. The [Publish](.github/workflows/publish.yml) workflow builds the site, tests it and
deploys it to GitHub Pages. A pull request is built and tested, not deployed.

The repository's Pages settings hold the source (GitHub Actions) and the custom domain
(`overloadvector.com`), so no `CNAME` file is needed.

## DNS

The domain is registered at Porkbun, which hosts its DNS (Domain Management →
overloadvector.com → DNS). Porkbun adds the domain to the host field itself, so leave the host empty
for the apex.

### Records GitHub Pages needs

| Type | Host | Value |
| --- | --- | --- |
| A | *(empty)* | `185.199.108.153` |
| A | *(empty)* | `185.199.109.153` |
| A | *(empty)* | `185.199.110.153` |
| A | *(empty)* | `185.199.111.153` |
| AAAA | *(empty)* | `2606:50c0:8000::153` |
| AAAA | *(empty)* | `2606:50c0:8001::153` |
| AAAA | *(empty)* | `2606:50c0:8002::153` |
| AAAA | *(empty)* | `2606:50c0:8003::153` |
| CNAME | `www` | `villekivela.github.io` |

GitHub redirects `www.overloadvector.com` to `overloadvector.com`. The values are from GitHub's
[Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

### Records to delete first

Porkbun's parking records:

| Type | Host | Value |
| --- | --- | --- |
| ALIAS | *(empty)* | `uixie.porkbun.com` |
| CNAME | `*` | `uixie.porkbun.com` |

The ALIAS would clash with the A and AAAA records. GitHub warns against a wildcard record, which
would let someone else publish a Pages site on a subdomain.

### Records to keep

- `CNAME mcp` and the `CNAME _….mcp` that points at `acm-validations.aws`: the app's Claude
  connector and its certificate.
- The `MX` records (`fwd1.porkbun.com`, `fwd2.porkbun.com`) and the `TXT` record starting
  `v=spf1`: they forward `support@overloadvector.com`.

### Afterwards

1. In the repository's **Settings → Pages**, wait for the DNS check to pass, then turn on
   **Enforce HTTPS**. GitHub can take up to a day to issue the certificate.
2. Optional, and recommended: verify the domain for the account (your GitHub **Settings → Pages →
   Add a domain**), which adds a `TXT` record at the host `_github-pages-challenge-villekivela` with
   the value GitHub shows.
