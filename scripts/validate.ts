// Validates every product YAML against src/lib/schema.ts.
// Usage: pnpm validate [slug...]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { productSchema } from "../src/lib/schema.ts";

const dir = join(import.meta.dirname, "..", "src", "data", "products");
const only = process.argv.slice(2);
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .filter((f) => only.length === 0 || only.includes(f.replace(/\.yaml$/, "")));

let errors = 0;
const names = new Map<string, string>();
for (const file of files) {
  const slug = file.replace(/\.yaml$/, "");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error(`✗ ${file}: filename must be kebab-case (a-z, 0-9, -)`);
    errors++;
  }
  let raw: unknown;
  try {
    raw = parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    console.error(`✗ ${file}: invalid YAML: ${(e as Error).message}`);
    errors++;
    continue;
  }
  const res = productSchema.safeParse(raw);
  if (!res.success) {
    errors++;
    console.error(`✗ ${file}`);
    for (const issue of res.error.issues) console.error(`    ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    continue;
  }
  const lower = res.data.name.toLowerCase();
  if (names.has(lower)) {
    console.error(`✗ ${file}: duplicate product name "${res.data.name}" (also in ${names.get(lower)})`);
    errors++;
  }
  names.set(lower, file);
}

if (errors) {
  console.error(`\n${errors} problem(s) in ${files.length} file(s).`);
  process.exit(1);
}
console.log(`✓ ${files.length} product file(s) valid.`);
