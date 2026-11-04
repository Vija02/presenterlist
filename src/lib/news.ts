import { getCollection, type CollectionEntry } from "astro:content";
import { NEWS_KINDS } from "./schema.ts";
import { getProducts } from "./products.ts";
import { SITE_NAME } from "../config.ts";

export type N = CollectionEntry<"news">["data"] & { id: string };

let cache: N[] | undefined;
/** Drafts are shown (badged) in `astro dev` so they can be reviewed, and never in builds. */
export const SHOW_DRAFTS = import.meta.env.DEV;

/** Published items (news and releases), newest first. */
export async function getAllNews(): Promise<N[]> {
  if (!cache) {
    const entries = await getCollection("news");
    cache = entries
      .filter((e) => SHOW_DRAFTS || !e.data.draft)
      .map((e) => ({ ...e.data, id: e.id }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  }
  return cache;
}
/** Announcements, pricing, status and acquisition items. Not shown on the site yet (only releases are). */
export const getNews = async () => (await getAllNews()).filter((n) => n.kind !== "release");
/** Monthly release roundups. */
export const getReleases = async () => (await getAllNews()).filter((n) => n.kind === "release");

export const releasesFor = async (slug: string, limit = 3) => (await getReleases()).filter((n) => n.product === slug).slice(0, limit);
export const newsKindLabel = (k: string) => NEWS_KINDS[k as keyof typeof NEWS_KINDS] ?? k;
export const monthLabel = (date: string) =>
  new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
export const sourceHost = (u: string) => new URL(u).hostname.replace(/^www\./, "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 response for a list of items. */
export async function rssResponse(site: URL, opts: { title: string; description: string; path: string; items: N[] }) {
  const names = new Map((await getProducts()).map((p) => [p.slug, p.name]));
  const self = new URL(`${opts.path}rss.xml`, site).toString();
  const items = opts.items
    .slice(0, 50)
    .map(
      (n) => `    <item>
      <title>${esc(n.title)}</title>
      <link>${esc(n.url)}</link>
      <guid isPermaLink="false">${esc(n.id)}</guid>
      <pubDate>${new Date(`${n.date}T12:00:00Z`).toUTCString()}</pubDate>
      <category>${esc(names.get(n.product) ?? n.product)}</category>
      <description>${esc(n.summary)}</description>
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`${SITE_NAME}: ${opts.title}`)}</title>
    <link>${new URL(opts.path, site)}</link>
    <description>${esc(opts.description)}</description>
    <language>en</language>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
