// Interactive scaffold for a new product file.
// Usage: pnpm add-product
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stringify } from "yaml";
import { DEPLOYMENTS, FEATURE_KEYS, PLATFORMS, PRICING_MODELS } from "../src/lib/schema.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q: string, def = "") => (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def;
const askList = async (q: string, options: Record<string, string>, def = "") => {
  const keys = Object.keys(options);
  while (true) {
    const ans = await ask(`${q} (comma-separated: ${keys.join(", ")})`, def);
    const list = ans.split(",").map((s) => s.trim()).filter(Boolean);
    const bad = list.filter((x) => !keys.includes(x));
    if (list.length && !bad.length) return list;
    console.log(`  Unknown value(s): ${bad.join(", ") || "(none given)"}`);
  }
};

const name = await ask("Product name");
const slug = await ask("Slug", name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
const file = join(import.meta.dirname, "..", "src", "data", "products", `${slug}.yaml`);
if (existsSync(file)) {
  console.error(`${file} already exists.`);
  process.exit(1);
}
const openSource = (await ask("Open source? (y/n)", "n")).toLowerCase().startsWith("y");
const data: Record<string, unknown> = {
  name,
  tagline: await ask("One-line tagline"),
  description: await ask("Short neutral description"),
  website: await ask("Website URL", "https://"),
  developer: await ask("Developer / company", name),
  headquarters: (await ask("Headquarters country (blank if unknown)")) || undefined,
  founded: Number(await ask("Year founded (blank if unknown)")) || undefined,
  status: "active",
  open_source: openSource,
  ...(openSource
    ? { license: await ask("SPDX license id", "GPL-3.0-only"), source_code_url: await ask("Source code URL", "https://github.com/") }
    : {}),
  pricing: {
    models: await askList("Pricing models", PRICING_MODELS, openSource ? "free" : "subscription"),
    free_trial: (await ask("Free trial? (y/n)", "n")).toLowerCase().startsWith("y"),
  },
  platforms: await askList("Platforms", PLATFORMS, "windows,macos"),
  deployment: await askList("Deployment", DEPLOYMENTS, "desktop"),
  features: {},
  sources: [],
  last_verified: new Date().toISOString().slice(0, 10),
};
rl.close();

const featureHelp = `# Features: set any of these to true | false | partial | addon (omit if unknown)\n# ${FEATURE_KEYS.join(", ")}\n`;
writeFileSync(file, stringify(data, { lineWidth: 100 }).replace("features: {}\n", `${featureHelp}features: {}\n`));
console.log(`\nCreated ${file}\nFill in features and sources, then run: pnpm validate ${slug}`);
