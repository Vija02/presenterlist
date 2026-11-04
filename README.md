# PresenterList

An open, community-maintained directory of **church presentation software**: tools for projecting lyrics, scripture, slides and media. Compare products by price, platform and features.

Inspired by [SignageList](https://github.com/SignageList/signagelist).

## Stack

- [Astro](https://astro.build) (static output) with content collections
- [Tailwind CSS v4](https://tailwindcss.com)
- [Zod](https://zod.dev) schema shared by the site and the validator
- pnpm and Node 22.12+ (Node 24 recommended; scripts use native TypeScript)

## Quick start

```sh
pnpm install
pnpm dev          # http://localhost:4321
pnpm validate     # validate all product YAML
pnpm build        # static site in dist/
pnpm add-product  # interactive scaffold for a new entry
```

## How it works

```
src/
  data/products/*.yaml      ← one file per product (the source of truth)
  lib/schema.ts             ← schema: platforms, pricing models, feature list
  lib/products.ts           ← helpers: badges, similarity, comparison slugs
  content.config.ts         ← Astro collection using the schema
  pages/
    index.astro             ← directory with client-side filters and compare tray
    software/[slug].astro   ← product page (FAQ, JSON-LD, similar tools)
    compare/index.astro     ← interactive comparison of up to 4 products
    compare/[pair].astro    ← static "A vs B" page for every pair
    alternatives/[slug].astro
    features/, platforms/   ← browse by feature / platform
    products.json.ts        ← full dataset as JSON
scripts/
  validate.ts               ← schema validation (also run in CI)
  add-product.ts
```

Every product × product pair gets a generated `/compare/a-vs-b/` page, so the site grows quadratically: 30 products give 435 comparison pages.

### Features

Features are defined once in `FEATURE_GROUPS` in `src/lib/schema.ts`: groups, then features, with optional sub-features. For example, "Slides & presentations" has PowerPoint, Keynote, Google Slides, Canva, PDF and animations. A new key automatically appears in filters, product pages, comparison tables and `/features/<feature>/<sub>/`. Existing products show it as "unknown" until it's filled in.

In a product file, a feature with sub-features can be a single value when the details aren't known, or a map:

```yaml
features:
  bible: true            # supported, specifics unknown
  slides:
    powerpoint: true
    canva: false
    animations: partial
  timers: true           # (features without sub-features are always a single value)
feature_notes:
  slides.animations: Only simple transitions are played back.
```

The top-level tick is rolled up from the sub-features: supported if any sub-feature is supported, and "not supported" only if every listed sub-feature is.

| value     | meaning                              |
| --------- | ------------------------------------ |
| `true`    | supported out of the box             |
| `false`   | not supported                        |
| `partial` | limited (explain in `feature_notes`) |
| `addon`   | needs a paid add-on or higher tier   |
| _omitted_ | unknown                              |

### Logos

Put the official logo or app icon in `public/logos/<slug>.svg` (or `.png`/`.webp`, square, at least 128px) and set `logo: /logos/<slug>.svg`. Products without a logo get a letter placeholder.

## Config

The site URL and GitHub repo used for "Suggest an edit" links are in `src/config.ts` (also update `public/robots.txt`).

## Deploying

The site is hosted on GitHub Pages at presenterlist.org. `.github/workflows/deploy.yml` builds and deploys on every push to `main`, and again after the monthly Releases workflow commits new release items. The custom domain is set by `public/CNAME`.

One-time setup: in the repo's Settings → Pages, set the source to "GitHub Actions"; point the domain's DNS at GitHub Pages (apex `A` records 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153, and `www` as a `CNAME` to `vija02.github.io`); then enable "Enforce HTTPS".

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: MIT. Product data in `src/data/`: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
