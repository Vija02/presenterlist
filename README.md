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

### Adding a comparison feature

Add a key to `FEATURE_GROUPS` in `src/lib/schema.ts`. It shows up automatically in filters, product pages, comparison tables and `/features/<key>/`. Existing products show it as "unknown" until filled in.

### Feature values

| value     | meaning                           |
| --------- | --------------------------------- |
| `true`    | supported out of the box          |
| `false`   | not supported                     |
| `partial` | limited (explain in `feature_notes`) |
| `addon`   | needs a paid add-on or higher tier |
| _omitted_ | unknown                           |

## Config

The site URL and GitHub repo used for "Suggest an edit" links are in `src/config.ts` (also update `public/robots.txt`).

## Deploying

The output is a static `dist/` folder. It deploys to Cloudflare Pages, Netlify, Vercel or GitHub Pages with build command `pnpm build` and output dir `dist`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: MIT. Product data in `src/data/`: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
