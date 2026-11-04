import { getCollection, type CollectionEntry } from "astro:content";
import {
  DEPLOYMENTS,
  FEATURE_PATHS,
  LEAF_PATHS,
  PLATFORMS,
  PRICING_MODELS,
  featureValueOf,
  type FeaturePath,
  type FeatureValue,
} from "./schema.ts";
export { featureLabel, featureFullLabel } from "./schema.ts";

export type ProductEntry = CollectionEntry<"products">;
export type P = ProductEntry["data"] & { slug: string };

let cache: P[] | undefined;
export async function getProducts(): Promise<P[]> {
  if (!cache) {
    const entries = await getCollection("products");
    cache = entries
      .map((e) => ({ ...e.data, slug: e.id }))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }
  return cache;
}

export const platformLabel = (k: string) => PLATFORMS[k as keyof typeof PLATFORMS] ?? k;
export const deploymentLabel = (k: string) => DEPLOYMENTS[k as keyof typeof DEPLOYMENTS] ?? k;
export const pricingLabel = (k: string) => PRICING_MODELS[k as keyof typeof PRICING_MODELS] ?? k;

export const isFree = (p: P) => p.pricing.models.includes("free") || p.pricing.models.includes("donation");
export const hasFreeOption = (p: P) => isFree(p) || p.pricing.models.includes("freemium");

/** Feature value for a path like "slides" or "slides.canva"; undefined means unknown. */
export const feat = (p: P, path: FeaturePath): FeatureValue | undefined => featureValueOf(p.features as any, path);
export const supports = (p: P, path: FeaturePath) => {
  const v = feat(p, path);
  return v === true || v === "partial" || v === "addon";
};
export const fullySupports = (p: P, path: FeaturePath) => feat(p, path) === true;
/** Count of confirmed leaf features (sub-features, plus features without subs). */
export const featureCount = (p: P) => LEAF_PATHS.filter((k) => supports(p, k)).length;
/** All supported paths, parents and subs, for client-side filters. */
export const supportedPaths = (p: P) => FEATURE_PATHS.filter((k) => supports(p, k));

export type Badge = { label: string; tone: "green" | "blue" | "amber" | "gray" | "red" | "neutral" };
export function badges(p: P): Badge[] {
  const out: Badge[] = [];
  if (p.open_source) out.push({ label: "Open Source", tone: "green" });
  if (isFree(p)) out.push({ label: "Free", tone: "blue" });
  else if (p.pricing.models.includes("freemium")) out.push({ label: "Freemium", tone: "blue" });
  if (p.pricing.models.includes("subscription")) out.push({ label: "Subscription", tone: "neutral" });
  if (p.pricing.models.includes("one_time")) out.push({ label: "One-time", tone: "neutral" });
  if (p.pricing.free_trial) out.push({ label: "Free Trial", tone: "amber" });
  if (p.status === "discontinued") out.push({ label: "Discontinued", tone: "red" });
  else if (p.status === "maintenance") out.push({ label: "Unmaintained", tone: "gray" });
  return out;
}

/** Canonical comparison slug: alphabetical so each pair has exactly one URL. */
export function pairSlug(a: string, b: string) {
  return a < b ? `${a}-vs-${b}` : `${b}-vs-${a}`;
}

/** Simple similarity score used to rank alternatives. */
export function similarity(a: P, b: P) {
  let score = 0;
  for (const k of FEATURE_PATHS) if (supports(a, k) && supports(b, k)) score += k.includes(".") ? 0.5 : 1;
  score += 1.5 * a.platforms.filter((x) => b.platforms.includes(x)).length;
  if (a.open_source === b.open_source) score += 1;
  if (isFree(a) === isFree(b)) score += 1;
  if (b.status === "discontinued") score -= 10;
  if (b.status === "maintenance") score -= 3;
  return score;
}

export function alternativesFor(p: P, all: P[]) {
  return all
    .filter((x) => x.slug !== p.slug)
    .map((x) => ({ product: x, score: similarity(p, x) }))
    .sort((x, y) => y.score - x.score || x.product.name.localeCompare(y.product.name))
    .map((x) => x.product);
}

export function initial(name: string) {
  return name.replace(/^the\s*/i, "").charAt(0).toUpperCase() || name.charAt(0);
}

export function listFormat(items: string[], conj = "and") {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conj} ${items.at(-1)}`;
}

export function priceSummary(p: P) {
  if (p.pricing.starting_price) return p.pricing.starting_price;
  return p.pricing.models.map(pricingLabel).join(" / ");
}

export function latestVerified(all: P[]) {
  return all.map((p) => p.last_verified).sort().at(-1);
}

/** URL slug: "slides.google_slides" -> "slides/google-slides". */
export const featureSlug = (path: string) => path.replaceAll("_", "-").replace(".", "/");
export const platformSlug = (k: string) => k;

/** Space-separated tags used by client-side filters. */
export function filterTags(p: P) {
  const t: string[] = [];
  if (p.open_source) t.push("open-source");
  if (isFree(p)) t.push("free");
  if (hasFreeOption(p)) t.push("free-option");
  if (p.pricing.free_trial) t.push("trial");
  for (const m of p.pricing.models) t.push(`price-${m}`);
  for (const d of p.deployment) t.push(`deploy-${d}`);
  return t.join(" ");
}
