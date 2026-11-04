# PresenterList

Astro 7 static site + Tailwind v4. A directory comparing church presentation software (like signagelist.org).

- Data: `src/data/products/*.yaml`, validated by the zod schema in `src/lib/schema.ts` (shared with `scripts/validate.ts`, which runs under native Node TS — keep that file free of Astro imports and use `.ts` import extensions).
- Run `pnpm validate` after data edits and `pnpm build` after code edits.
- Feature values: true / false / "partial" / "addon"; omit = unknown. Never guess features — require a source.
- The maintainer builds TheOpenPresenter; keep listings neutral and use the same rules for every product.
- A stray `~/node_modules/cookie` exists on the maintainer's machine; `cookie@^2` is a direct dependency so the Astro prerender resolves the right version.
