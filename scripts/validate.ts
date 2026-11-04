// Validates every product and news YAML against src/lib/schema.ts.
// Usage: pnpm validate [slug...]   (slugs limit the product check; news is always checked)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { newsSchema, productSchema } from "../src/lib/schema.ts";

const dataDir = join(import.meta.dirname, "..", "src", "data");
const only = process.argv.slice(2);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let errors = 0;
const fail = (msg: string) => {
  console.error(`✗ ${msg}`);
  errors++;
};

function load<T>(dir: string, file: string, schema: { safeParse: (v: unknown) => any }): T | undefined {
  let raw: unknown;
  try {
    raw = parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    fail(`${file}: invalid YAML: ${(e as Error).message}`);
    return;
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    fail(file);
    for (const issue of res.error.issues) console.error(`    ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return;
  }
  return res.data as T;
}

// Products
const productDir = join(dataDir, "products");
const allSlugs = readdirSync(productDir).filter((f) => f.endsWith(".yaml")).map((f) => f.replace(/\.yaml$/, ""));
const slugs = allSlugs.filter((s) => only.length === 0 || only.includes(s));
const names = new Map<string, string>();
for (const slug of slugs) {
  const file = `${slug}.yaml`;
  if (!SLUG.test(slug)) fail(`${file}: filename must be kebab-case (a-z, 0-9, -)`);
  const p = load<{ name: string }>(productDir, file, productSchema);
  if (!p) continue;
  const lower = p.name.toLowerCase();
  if (names.has(lower)) fail(`${file}: duplicate product name "${p.name}" (also in ${names.get(lower)})`);
  names.set(lower, file);
}

// News
const newsDir = join(dataDir, "news");
const newsFiles = existsSync(newsDir) ? readdirSync(newsDir).filter((f) => f.endsWith(".yaml")) : [];
const releaseMonths = new Map<string, string>();
let drafts = 0;
for (const file of newsFiles) {
  const n = load<{ date: string; product: string; kind: string; draft: boolean }>(newsDir, file, newsSchema);
  if (!n) continue;
  if (!file.startsWith(`${n.date}-${n.product}`) || !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.yaml$/.test(file))
    fail(`news/${file}: filename must be <date>-<product>[-suffix].yaml, i.e. ${n.date}-${n.product}.yaml`);
  if (!allSlugs.includes(n.product)) fail(`news/${file}: unknown product "${n.product}"`);
  if (n.draft) {
    drafts++;
    continue;
  }
  // Same rule for every product: one release item per product per month.
  if (n.kind === "release") {
    const key = `${n.product} ${n.date.slice(0, 7)}`;
    if (releaseMonths.has(key))
      fail(`news/${file}: ${n.product} already has a release item for ${n.date.slice(0, 7)} (${releaseMonths.get(key)}); roll them into one`);
    releaseMonths.set(key, file);
  }
}

if (errors) {
  console.error(`\n${errors} problem(s).`);
  process.exit(1);
}
console.log(`✓ ${slugs.length} product file(s) valid.`);
console.log(`✓ ${newsFiles.length} news file(s) valid${drafts ? ` (${drafts} draft(s) awaiting review)` : ""}.`);
