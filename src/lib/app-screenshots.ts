// Shared by scripts/app-screenshots.ts (runs under native Node TS) and the site, so no Astro imports.
import { createHash } from "node:crypto";

/** Local file name in public/app-screenshots for a product's screenshot image URL. */
export const appScreenshotFile = (slug: string, image: string) =>
  `${slug}-${createHash("sha1").update(image).digest("hex").slice(0, 10)}.webp`;

export type AppScreenshotMeta = Record<string, { width: number; height: number; image: string; fetched: string }>;
