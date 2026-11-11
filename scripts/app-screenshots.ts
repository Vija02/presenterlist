// Downloads each product's app screenshots (the `screenshots` field, official sources only) into
// public/app-screenshots/<slug>-<hash>.webp, resized to at most 1600px wide.
//
// Same handling for every product. The files are committed, so the site never depends on the
// source URLs staying up: run this after adding or changing a `screenshots` entry and commit the
// result. Existing files are skipped; files no product references any more are removed.
//
// Usage: pnpm app-screenshots [--force] [slug...]
//   --force  download again even if the file exists
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { parse } from "yaml";
import { appScreenshotFile, type AppScreenshotMeta } from "../src/lib/app-screenshots.ts";
import { productSchema } from "../src/lib/schema.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const root = join(import.meta.dirname, "..");
const productDir = join(root, "src", "data", "products");
const outDir = join(root, "public", "app-screenshots");
const metaFile = join(outDir, "meta.json");
const MAX_WIDTH = 1600;
const MAX_BYTES = 20 * 1024 * 1024;
const CONCURRENCY = 4;
const USER_AGENT = "Mozilla/5.0 (compatible; PresenterList-screenshot; +https://presenterlist.org/about/)";

mkdirSync(outDir, { recursive: true });
const meta: AppScreenshotMeta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);

const products = readdirSync(productDir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({ slug: f.replace(/\.yaml$/, ""), ...productSchema.parse(parse(readFileSync(join(productDir, f), "utf8"))) }));

const wanted = products.flatMap((p) => (p.screenshots ?? []).map((s) => ({ slug: p.slug, image: s.image, file: appScreenshotFile(p.slug, s.image) })));
const jobs = wanted
  .filter((j) => (only.length ? only.includes(j.slug) : true))
  .filter((j) => force || !existsSync(join(outDir, j.file)));

async function download(job: (typeof jobs)[number]) {
  try {
    const res = await fetch(job.image, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(45_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error(`not an image (${type || "no content-type"})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error(`too large (${buf.length} bytes)`);
    const info = await sharp(buf, { animated: false })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(outDir, job.file));
    meta[job.file] = { width: info.width, height: info.height, image: job.image, fetched: today };
    console.log(`✓ ${job.slug} ${job.file}`);
  } catch (e) {
    const kept = existsSync(join(outDir, job.file)) ? " (keeping previous)" : "";
    console.error(`✗ ${job.slug} ${job.image}: ${(e as Error).message.split("\n")[0]}${kept}`);
  }
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) await download(j);
  }),
);

// Remove files no product references any more (only on a full run).
if (!only.length) {
  const keep = new Set(wanted.map((j) => j.file));
  for (const f of readdirSync(outDir))
    if (f.endsWith(".webp") && !keep.has(f)) {
      rmSync(join(outDir, f));
      delete meta[f];
      console.log(`- removed ${f}`);
    }
}

writeFileSync(metaFile, JSON.stringify(Object.fromEntries(Object.entries(meta).sort()), null, 2) + "\n");
console.log(`${jobs.length} downloaded or attempted, ${wanted.length} referenced, files in public/app-screenshots`);
