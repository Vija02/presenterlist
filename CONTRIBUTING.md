# Contributing to PresenterList

Thanks for helping churches find the right tool.

## Quick ways to help

- **Suggest a product:** open a "Submit a product" issue.
- **Fix a listing:** click "Suggest an edit" on the product page, or edit the YAML file directly in a PR.

## Editing data

1. Each product is one file: `src/data/products/<slug>.yaml`. The slug is kebab-case and becomes the URL.
2. Fields and allowed values are defined in [`src/lib/schema.ts`](src/lib/schema.ts). Run `pnpm add-product` to scaffold a new file.
3. Run `pnpm validate` before opening a PR.

### Data rules

- **Neutral tone.** Use factual descriptions with no marketing superlatives.
- **Features** are listed in `FEATURE_GROUPS` in `src/lib/schema.ts`. Fill in specific sub-features where you can (`slides: { powerpoint: true }`), or a single value when you only know the feature is supported. See the README for the format.
- **Evidence first.** Only mark a feature `true` when a public source confirms it. Leave it out if unsure, so it shows as "unknown". Add the URLs you used to `sources`.
- **Open source** means public source under an OSI-approved license. Use the exact SPDX id (e.g. `GPL-3.0-only` vs `GPL-3.0-or-later`). Freeware is not open source.
- **Status:** use `maintenance` if there has been no release for about 2 years, and `discontinued` if officially ended. Explain in `status_note`.
- **Headquarters** is where most of the team works, as a full English country name.
- Update **`last_verified`** whenever you check an entry.
- **Logos:** use the official logo or app icon from the vendor's site or repo, saved as `public/logos/<slug>.svg` (or a square PNG of at least 128px).
- Vendors are welcome to update their own listings. Please say you're affiliated in the PR.

## Releases

Release items live in `src/data/news/<date>-<product>.yaml` and link to the original release notes (schema: `newsSchema` in `src/lib/schema.ts`). They appear on `/releases/` and on product pages.

They're collected automatically. On the 1st of each month `.github/workflows/releases.yml` runs `pnpm fetch-news --auto`, which:

- gathers last month's stable releases from GitHub/GitLab (`source_code_url`), release-note feeds (`release_feeds`) and, for products with neither, changelog pages (`release_notes_url`, with text snapshots in `scripts/changelog-snapshots/`);
- rolls them up to **one item per product per month**, with no release counts in titles;
- has Claude write a one or two sentence neutral summary (`scripts/summarize.ts`), with the same prompt for every product, and rejects summaries with promotional wording;
- publishes items that pass, records months with nothing user-facing in `scripts/news-ignored.txt`, and commits.

To help: add a `release_feeds` or `release_notes_url` to a product so its releases are picked up, or use the "Submit a release" issue form. To remove or fix an item, edit or delete its file and, if needed, add a line to `scripts/news-ignored.txt` so it isn't recreated. Run `pnpm fetch-news` without `--auto` to create drafts for manual review instead.

The workflow runs Claude Code on the maintainer's Claude subscription: it needs a `CLAUDE_CODE_OAUTH_TOKEN` secret (from `claude setup-token`) in a GitHub environment named `releases`, restricted to the `main` branch. Locally, `SUMMARY_BACKEND=claude-code pnpm fetch-news --auto` uses your own Claude Code login; with `ANTHROPIC_API_KEY` instead it uses the API. Each run is capped at 40 summary requests (`SUMMARY_MAX_CALLS`).

## Screenshots

Product pages show a small screenshot of the product's homepage (`website`) in the sidebar. `pnpm screenshots` captures them into `public/screenshots/` with the same settings for every product (1280×800; cookie banners, ad slots and floating third-party widgets hidden). They aren't committed: the Deploy workflow recaptures them when the month, a product file or the capture script changes, and caches them between deploys. If a site fails to load, the previous screenshot is kept.
