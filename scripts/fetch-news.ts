// Drafts (or, with --auto, publishes) release items from public releases and changelogs.
//
// Sources per product:
//   - Releases: GitHub/GitLab releases from `source_code_url`, plus RSS/Atom feeds in `release_feeds`
//   - News: RSS/Atom feeds of the vendor's blog in `news_feeds`
//   - Changelog pages: when a product has none of the release sources above, its
//     `release_notes_url` page is watched. A text snapshot is kept in scripts/changelog-snapshots/
//     (commit it). New lines since the last snapshot become a release draft dated today.
//     The first run for a product drafts the top of the page so its latest release can be added.
//
// Rules (the same for every product):
//   - Only completed calendar months are drafted, so releases can be rolled up.
//   - All releases in a month become ONE draft item (kind: release). Pre-releases
//     (flagged on GitHub/GitLab or named alpha/beta/rc/...) and items without an x.y version are skipped.
//   - Blog posts become one draft each (kind: announcement); delete marketing posts in review.
//     Change kind to pricing/status/acquisition where it fits. Release announcements on a blog
//     belong in the monthly release item instead.
//   - Months/URLs that already have a news file (draft or not) are skipped.
//
// Drafts are written with `draft: true` and an empty summary. To publish one, write a
// summary in your own words (never copy the release notes), then set `draft: false`.
//
// Rejecting a draft: delete the file and add a line to scripts/news-ignored.txt, either the
// item's URL or "<slug> <YYYY-MM>" for a release month, so it isn't drafted again.
//
// Run it once a month, early in the month (.github/workflows/releases.yml does this).
// Usage: pnpm fetch-news [--auto] [--months 3] [--news] [--dry-run] [slug...]
//   --auto   summarize with Claude (scripts/summarize.ts, needs ANTHROPIC_API_KEY) and publish
//            items that pass the checks. Items with nothing user-facing are added to
//            news-ignored.txt; anything that fails is left for the next run.
//   --news   also draft blog posts from news_feeds (not shown on the site yet)
// Set GITHUB_TOKEN to avoid GitHub's unauthenticated rate limit (60 requests/hour).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { newsSchema, productSchema } from "../src/lib/schema.ts";
import { MAX_INPUT_CHARS, summarize, summaryProblem } from "./summarize.ts";

type Release = { date: string; version: string; url: string; notes: string };
type Post = { date: string; title: string; url: string; notes: string };

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const months = Number(opt("--months", "3"));
const dryRun = flag("--dry-run");
const withNews = flag("--news");
const auto = flag("--auto");
const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--months");

const root = join(import.meta.dirname, "..");
const productDir = join(root, "src", "data", "products");
const newsDir = join(root, "src", "data", "news");
const UA = "Mozilla/5.0 (compatible; PresenterList-news-fetcher)";
const snapshotDir = join(root, "scripts", "changelog-snapshots");

// Window: the last `months` completed months.
const now = new Date();
const today = now.toISOString().slice(0, 10);
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const windowEnd = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))); // exclusive
const windowStart = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1)));
/** In --auto mode, changelog pages are attributed to the month that just ended. */
const lastMonth = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
const monthEnd = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
const inWindow = (date: string) => date.slice(0, 7) >= windowStart && date.slice(0, 7) < windowEnd;

// Existing items, so reruns don't duplicate.
mkdirSync(newsDir, { recursive: true });
const existing = readdirSync(newsDir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => newsSchema.safeParse(parse(readFileSync(join(newsDir, f), "utf8"))))
  .filter((r) => r.success)
  .map((r) => r.data!);
const existingUrls = new Set(existing.map((n) => n.url));
const existingReleaseMonths = new Set(existing.filter((n) => n.kind === "release").map((n) => `${n.product} ${n.date.slice(0, 7)}`));
// Rejected items: URLs and "<slug> <YYYY-MM>" release months.
const ignoreFile = join(root, "scripts", "news-ignored.txt");
function ignoreMonth(slug: string, ym: string, reason: string) {
  existingReleaseMonths.add(`${slug} ${ym}`);
  console.log(`  ${slug} ${ym}: nothing to publish (${reason})`);
  if (!dryRun) writeFileSync(ignoreFile, `${readFileSync(ignoreFile, "utf8").trimEnd()}\n${slug} ${ym}  # auto: ${reason.replace(/\n/g, " ").slice(0, 120)}\n`);
}
for (const line of existsSync(ignoreFile) ? readFileSync(ignoreFile, "utf8").split("\n") : []) {
  const l = line.replace(/#.*/, "").trim();
  if (!l) continue;
  if (/^https?:\/\//.test(l)) existingUrls.add(l);
  else existingReleaseMonths.add(l.replace(/\s+/, " "));
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function githubReleases(owner: string, repo: string): Promise<Release[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const data = await getJson(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=50`, headers);
  return data
    .filter((r: any) => !r.draft && !r.prerelease && r.published_at)
    .map((r: any) => ({ date: r.published_at.slice(0, 10), version: r.tag_name, url: r.html_url, notes: r.body ?? "" }));
}

async function gitlabReleases(path: string): Promise<Release[]> {
  const data = await getJson(`https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}/releases?per_page=50`);
  return data
    .filter((r: any) => !r.upcoming_release && r.released_at)
    .map((r: any) => ({
      date: r.released_at.slice(0, 10),
      version: r.tag_name,
      url: r._links?.self ?? `https://gitlab.com/${path}/-/releases/${r.tag_name}`,
      notes: r.description ?? "",
    }));
}

// Minimal RSS 2.0 / Atom parsing; good enough for drafting.
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : "";
};
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos|rsquo|lsquo|rdquo|ldquo|hellip|ndash|mdash);/g, (_, e) =>
      ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "…", ndash: "–", mdash: "—" })[e as string]!,
    );
// Titles may be entity-encoded twice (&amp;apos;), so decode, strip tags, decode again.
const stripHtml = (s: string) =>
  decode(decode(s.replace(/<!\[CDATA\[|\]\]>/g, "")).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function feedPosts(url: string): Promise<Post[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const xml = await res.text();
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.flatMap((b) => {
    const link = tag(b, "link") || b.match(/<link\b[^>]*href="([^"]+)"/i)?.[1] || "";
    const rawDate = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const d = new Date(rawDate);
    if (!link || isNaN(d.getTime())) return [];
    return [{ date: d.toISOString().slice(0, 10), title: stripHtml(tag(b, "title")), url: link, notes: stripHtml(tag(b, "description") || tag(b, "summary") || tag(b, "content")) }];
  });
}

// Pre-releases are often only marked in the tag name, and some tags aren't versions at all.
const PRERELEASE_WORD = /\b(alpha|beta|rc\d*|pre-?release|preview|nightly|canary|snapshot|insiders?)\b/i; // whole title/tag
const PRERELEASE_VERSION = /[-.+](alpha|beta|rc|pre|dev)|\d(a|b|rc)\d+$/i; // version string only
// Every release source must name a version (x.y), so blog-style posts in release feeds and
// non-version git tags are skipped the same way for every product.
const isStable = (r: Release) => {
  const v = versionOf(r.version);
  return /\d+\.\d+/.test(v) && !PRERELEASE_WORD.test(r.version) && !PRERELEASE_VERSION.test(v);
};

const VERSION_OR_DATE =
  /\b\d+\.\d+\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}\b|\b\d{1,2}(st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/i;

/** Visible text of an HTML (or plain-text) page, one block per line. */
async function pageLines(url: string): Promise<string[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  let text = await res.text();
  if (!(res.headers.get("content-type") ?? "").includes("text/plain"))
    text = text
      .replace(/<(script|style|noscript|svg|head|nav|footer)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  text = decode(text);
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3);
}

const clean = (v: string) => v.replace(/^v(?=\d)/i, "");
/** "7.16.2" from a tag or a feed title like "ProPresenter 7.16.2 Release Notes"; falls back to the text. */
const versionOf = (s: string) => s.match(/\d+(\.\d+)+[a-z0-9.+-]*/i)?.[0] ?? clean(s);
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
const commentBlock = (text: string, max = 5000) => {
  const t = text.length > max ? `${text.slice(0, max)}…` : text;
  return t.split(/\r?\n/).map((l) => `#   ${l}`.trimEnd()).join("\n");
};

function saveSnapshot(slug: string, lines: string[]) {
  if (dryRun) return;
  mkdirSync(snapshotDir, { recursive: true });
  writeFileSync(join(snapshotDir, `${slug}.txt`), lines.join("\n"));
}

/** Title from versions. No release counts: the feed shouldn't reward shipping often. */
function releaseTitle(name: string, ym: string, first: string, last: string) {
  if (!last) return `${name}: ${monthName(ym)} updates`;
  if (!first || first === last) return `${name} ${last} released`;
  return `${name}: ${monthName(ym)} releases (${first} to ${last})`;
}

function writeDraft(item: Record<string, unknown>, reference: string, snapshot?: { kind: "changelog"; slug: string; lines: string[] }) {
  const base = `${item.date}-${item.product}`;
  let file = `${base}.yaml`;
  for (let i = 2; existsSync(join(newsDir, file)); i++) file = `${base}-${i}.yaml`;
  const published = item.draft === false;
  const header = published ? "# Generated by scripts/fetch-news.ts --auto (summary written by Claude).\n" : [
    "# DRAFT generated by scripts/fetch-news.ts.",
    "# Write a one or two sentence summary in your own words (don't copy the notes below),",
    "# then set draft: false. Delete this file if nothing user-facing changed.",
    "# Source text, for reference only:",
    commentBlock(reference),
    "",
  ].join("\n");
  if (dryRun) {
    console.log(`  would write ${file}: ${item.title}${item.summary ? `\n      ${item.summary}` : ""}`);
    return;
  }
  writeFileSync(join(newsDir, file), header + stringify(item));
  console.log(`  ${published ? "published" : "wrote draft"} ${file}: ${item.title}`);
  if (snapshot) saveSnapshot(snapshot.slug, snapshot.lines);
}

let failures = 0;
let apiFailures = 0;
const noSource: string[] = [];
const files = readdirSync(productDir).filter((f) => f.endsWith(".yaml"));
console.log(`Drafting news for ${windowStart} to ${monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))}${dryRun ? " (dry run)" : ""}`);

for (const f of files) {
  const slug = f.replace(/\.yaml$/, "");
  if (only.length && !only.includes(slug)) continue;
  const p = productSchema.parse(parse(readFileSync(join(productDir, f), "utf8")));
  if (p.status === "discontinued") continue;

  // Releases: GitHub / GitLab, plus release-note feeds
  const src = p.source_code_url ?? "";
  const gh = src.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  const gl = src.match(/^https:\/\/gitlab\.com\/([^#?]+?)\/?$/);
  let releases: Release[] = [];
  let releasesPage = p.release_notes_url ?? "";
  let source = "";
  try {
    if (gh) {
      releases = await githubReleases(gh[1], gh[2].replace(/\.git$/, ""));
      releasesPage ||= `https://github.com/${gh[1]}/${gh[2]}/releases`;
      source = "GitHub";
    } else if (gl) {
      releases = await gitlabReleases(gl[1]);
      releasesPage ||= `https://gitlab.com/${gl[1]}/-/releases`;
      source = "GitLab";
    }
  } catch (e) {
    console.error(`✗ ${slug}: ${(e as Error).message}`);
    failures++;
  }
  for (const feed of p.release_feeds ?? []) {
    try {
      const posts = await feedPosts(feed);
      releases.push(...posts.map((x) => ({ date: x.date, version: x.title, url: x.url, notes: x.notes })));
      source ||= new URL(feed).hostname.replace(/^www\./, "");
      releasesPage ||= new URL(feed).origin;
    } catch (e) {
      console.error(`✗ ${slug}: ${(e as Error).message}`);
      failures++;
    }
  }
  const hasReleaseSource = Boolean(gh || gl || p.release_feeds?.length);
  if (!hasReleaseSource && !p.release_notes_url && !p.news_feeds?.length) noSource.push(slug);

  const byMonth = new Map<string, Release[]>();
  for (const r of releases.filter((r) => inWindow(r.date) && isStable(r))) byMonth.set(r.date.slice(0, 7), [...(byMonth.get(r.date.slice(0, 7)) ?? []), r]);
  for (const [ym, rs] of byMonth) {
    if (existingReleaseMonths.has(`${slug} ${ym}`)) continue;
    rs.sort((a, b) => a.date.localeCompare(b.date));
    const first = versionOf(rs[0].version);
    const last = versionOf(rs.at(-1)!.version);
    const single = rs.length === 1;
    let summary = "";
    if (auto) {
      // Share the input cap between releases so a busy month doesn't lose its newest ones.
      const per = Math.floor(MAX_INPUT_CHARS / rs.length) - 40;
      const full = rs.map((r) => `## ${r.version} (${r.date})\n${r.notes.slice(0, per)}`).join("\n\n");
      const res = await summarize({ product: p.name, targetMonth: ym, kind: "releases", text: full });
      if (!res) {
        apiFailures++; // try again next run
        continue;
      }
      if (!res.publish) {
        ignoreMonth(slug, ym, res.reason);
        continue;
      }
      const problem = summaryProblem(res.summary);
      if (problem) {
        console.error(`  ! ${slug} ${ym}: summary rejected (${problem}), leaving a draft for review`);
        apiFailures++;
      }
      else summary = res.summary;
    }
    writeDraft(
      {
        title: releaseTitle(p.name, ym, single ? last : first, last),
        date: rs.at(-1)!.date,
        product: slug,
        kind: "release",
        url: single ? rs[0].url : releasesPage,
        summary,
        source,
        draft: !summary,
      },
      // ~600 characters per release so every release in a rolled-up month is visible to the reviewer.
      rs.map((r) => `## ${r.version} (${r.date})\n${r.notes.length > 600 ? `${r.notes.slice(0, 600)}…` : r.notes}`).join("\n\n"),
    );
  }

  // Changelog page watcher, only for products without a structured release source.
  if (!hasReleaseSource && p.release_notes_url) {
    try {
      const lines = await pageLines(p.release_notes_url);
      const snapFile = join(snapshotDir, `${slug}.txt`);
      const first = !existsSync(snapFile);
      const old = new Set(first ? [] : readFileSync(snapFile, "utf8").split("\n"));
      // First check: skip site navigation by starting near the first line with a version or date.
      const start = Math.max(0, lines.findIndex((l) => VERSION_OR_DATE.test(l)) - 2);
      const added = first ? lines.slice(start, start + 60) : lines.filter((l) => !old.has(l));
      const ym = auto ? lastMonth : today.slice(0, 7);
      if (auto && added.length > 0 && !existingReleaseMonths.has(`${slug} ${ym}`)) {
        const res = await summarize({ product: p.name, targetMonth: ym, kind: "changelog", text: added.join("\n").slice(0, MAX_INPUT_CHARS) });
        if (!res) apiFailures++;
        else {
          // Keep lines for releases after the target month unseen, so next month picks them up.
          const settled = !res.newest_date_in_text || res.newest_date_in_text <= monthEnd(ym);
          const problem = res.publish ? summaryProblem(res.summary) : undefined;
          if (!res.publish) ignoreMonth(slug, ym, res.reason);
          else if (problem) {
            console.error(`  ! ${slug} ${ym}: summary rejected (${problem}); will retry next run`);
            apiFailures++;
          }
          else {
            const date = res.last_release_date.startsWith(ym) ? res.last_release_date : monthEnd(ym);
            writeDraft(
              {
                title: releaseTitle(p.name, ym, res.first_version, res.last_version),
                date,
                product: slug,
                kind: "release",
                url: p.release_notes_url,
                summary: res.summary,
                source: new URL(p.release_notes_url).hostname.replace(/^www\./, ""),
                draft: false,
              },
              "",
            );
            existingReleaseMonths.add(`${slug} ${ym}`);
          }
          if (settled && !problem) saveSnapshot(slug, lines);
        }
      } else if (auto) {
        // nothing new, or this month is already covered
      } else if (added.length === 0) {
        // unchanged
      } else if (existingReleaseMonths.has(`${slug} ${ym}`)) {
        console.log(`  ${slug}: release notes changed, but there's already a release item for ${ym}; will retry next month`);
      } else {
        writeDraft(
          {
            title: first ? `${p.name}: latest release` : `${p.name}: release notes updated`,
            date: today,
            product: slug,
            kind: "release",
            url: p.release_notes_url,
            summary: "",
            source: new URL(p.release_notes_url).hostname.replace(/^www\./, ""),
            draft: true,
          },
          [
            first
              ? "First check of this changelog page. Top of the page below: add the latest release if it falls in the last few months, otherwise delete this draft."
              : "Lines added to the changelog page since the last check. Set the title to the version(s) and the date to the latest release date.",
            "",
            ...added.slice(0, 80),
          ].join("\n"),
          { kind: "changelog", slug, lines },
        );
        existingReleaseMonths.add(`${slug} ${ym}`);
      }
    } catch (e) {
      console.error(`✗ ${slug}: ${(e as Error).message}`);
      failures++;
    }
  }

  // News: blog posts from RSS / Atom feeds
  for (const feed of withNews ? (p.news_feeds ?? []) : []) {
    let posts: Post[] = [];
    try {
      posts = await feedPosts(feed);
    } catch (e) {
      console.error(`✗ ${slug}: ${(e as Error).message}`);
      failures++;
    }
    for (const post of posts.filter((x) => inWindow(x.date) && !existingUrls.has(x.url))) {
      writeDraft(
        {
          title: post.title.slice(0, 120),
          date: post.date,
          product: slug,
          kind: "announcement",
          url: post.url,
          summary: "",
          source: new URL(feed).hostname.replace(/^www\./, ""),
          draft: true,
        },
        post.notes,
      );
      existingUrls.add(post.url);
    }
  }
}

if (noSource.length)
  console.log(`\nNo automatic source (check by hand, or add release_feeds / release_notes_url / news_feeds): ${noSource.join(", ")}`);
if (failures) console.error(`\n${failures} source(s) failed; see above.`);
if (apiFailures) {
  console.error(`\n${apiFailures} summary request(s) failed; those items will be retried next run.`);
  process.exitCode = 1;
}
console.log(auto ? "\nDone." : "\nReview drafts in src/data/news, then run pnpm validate.");
