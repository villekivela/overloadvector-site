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
npm test          # checks the built site
npm run preview   # serves dist/, search included
```

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
