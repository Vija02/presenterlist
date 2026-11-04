# PresenterList

Astro 7 static site + Tailwind v4. A directory comparing church presentation software (like signagelist.org).

- Data: `src/data/products/*.yaml`, validated by the zod schema in `src/lib/schema.ts` (shared with `scripts/validate.ts`, which runs under native Node TS, so keep that file free of Astro imports and use `.ts` import extensions).
- Run `pnpm validate` after data edits and `pnpm build` after code edits.
- Features are hierarchical (`FEATURE_GROUPS` → feature → optional `sub`). In YAML a feature with subs is either a scalar or a map of subs; notes are keyed `feature` or `feature.sub`. Always read values through `featureValueOf`/`feat()`, never `p.features[k]` directly, because parents are rolled up from subs.
- Feature values: true / false / "partial" / "addon"; omit = unknown. Never guess features; require a source. `false` needs evidence of absence.
- When renaming or moving feature keys, migrate every product YAML (only rewrite the `features`/`feature_notes` blocks) and run `pnpm validate`.
- The maintainer builds TheOpenPresenter; keep listings neutral and use the same rules for every product.
- A stray `~/node_modules/cookie` exists on the maintainer's machine; `cookie@^2` is a direct dependency so the Astro prerender resolves the right version.
