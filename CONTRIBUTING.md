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
- **Evidence first.** Only mark a feature `true` when a public source confirms it. Leave it out if unsure, so it shows as "unknown". Add the URLs you used to `sources`.
- **Open source** means public source under an OSI-approved license. Use the exact SPDX id (e.g. `GPL-3.0-only` vs `GPL-3.0-or-later`). Freeware is not open source.
- **Status:** use `maintenance` if there has been no release for about 2 years, and `discontinued` if officially ended. Explain in `status_note`.
- **Headquarters** is where most of the team works, as a full English country name.
- Update **`last_verified`** whenever you check an entry.
- Vendors are welcome to update their own listings. Please say you're affiliated in the PR.
