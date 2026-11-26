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
```

## The logo

The favicon, the header's logo and the social preview are generated in the app's repository
(`villekivela/overloadvector`, `brand/README.md`) and copied here. Never edit them here: regenerate
them there with `python3 -I tools/brand/brand.py`, then copy its `brand/site/` files over:

| From `brand/site/` | To |
| --- | --- |
| `favicon.svg`, `favicon.ico` | `public/` |
| `social-1200x630.png` | `public/social.png` |
| `logo-light.svg`, `logo-dark.svg` | `src/assets/` |

The header shows the logo in place of the site's title, which stays its accessible name. The
capitals are logo art only: running text says Overload Vector.

## The pages

| Page | File |
| --- | --- |
| Home | `src/components/Home.astro`, then `src/content/docs/index.mdx` |
| User docs, `/docs/…` | `src/content/docs/docs/` |
| FAQ, contact, privacy policy | `src/content/docs/faq.md`, `contact.md`, `privacy.md` |

Write for users, in plain English, from the app as it is. A new page goes in the sidebar
(`astro.config.mjs`) and in `test/pages.mjs`.

`/privacy/` is the app's privacy policy: its address must not change. Keep its date current.

### The home page

`src/components/Home.astro` is the top of the home page: the pitch, then what the app does, section by section, beside
one phone. `index.mdx` holds the pitch's words and buttons, and everything below the phone.

On a wide screen the phone is a 3D model drawn with three.js (`src/phone/`): it turns from its back
to its front as the reader scrolls through the pitch, then stays pinned while each section puts its
own screen on it. `phone.js` is the model, a Pixel 10 Pro's shape built from plain geometry, with no
maker's logo and nothing downloaded. `story.js` says what the phone shows at a scroll position, and
`stage.js` drives the model from it.

The home page's header has links to the docs and the FAQ where the other pages have the search
(`src/components/Search.astro`).

A narrow screen, a visitor who asked for less motion and a browser without WebGL get a still of the
same phone under each text instead, and never load three.js. The stills are in `src/assets/phone/`,
drawn from the model by `npm run stills` (it needs Chrome, as the tests do). Run it after changing
the model or a screenshot the home page shows, and commit what it draws.

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

A docs page places both, the light one first, inside `<div class="shots">`; the theme picked in the menu
shows its own:

```md
![What the screen shows](../../../assets/shots/shot-today-light.png)
![What the screen shows](../../../assets/shots/shot-today-dark.png)
```

## Fonts

The app's own: Space Grotesk for words in titles, Inter for everything else and every number
(`src/styles/fonts.css`). They are served from this site, never from a font service, and their
licences are published beside them (`public/fonts/`) and linked in the footer. `src/assets/fonts/`
holds the app's font files, whole, packed with `woff2_compress`; Inter's keep the hyphen
proportional under tabular figures, as the app patches them.

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
