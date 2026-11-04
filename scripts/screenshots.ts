// Captures a screenshot of each product's homepage into public/screenshots/<slug>.jpg.
//
// Same settings for every product. Screenshots aren't committed: the Deploy workflow captures
// them once a month and caches them between deploys. If a site can't be loaded, the previous
// screenshot (if any) is kept.
//
// Usage: pnpm screenshots [--force] [slug...]
//   --force  recapture even if this month's screenshot exists
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { parse } from "yaml";
import { productSchema } from "../src/lib/schema.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const root = join(import.meta.dirname, "..");
const productDir = join(root, "src", "data", "products");
const outDir = join(root, "public", "screenshots");
const metaFile = join(outDir, "meta.json");
const VIEWPORT = { width: 1280, height: 800 };
const CONCURRENCY = 4;
// Cookie/consent banners from common consent tools and third-party ad slots are hidden
// (consent is not accepted or rejected), the same way on every site, so they don't cover the page.
const HIDE_SELECTORS = `
#onetrust-consent-sdk, #onetrust-banner-sdk, #CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay,
.cky-consent-container, .cky-overlay, #cookie-law-info-bar, .cli-modal-backdrop, #cmplz-cookiebanner-container,
.cmplz-cookiebanner, #moove_gdpr_cookie_info_bar, .cc-window, .cc-banner, #cookie-notice, #cookieNotice,
#usercentrics-root, #didomi-host, .termly-styles-root, #termly-code-snippet-support, #iubenda-cs-banner,
#axeptio_overlay, #hs-eu-cookie-confirmation, .osano-cm-window, #truste-consent-track, .qc-cmp2-container,
#gdpr-cookie-message, .cookie-consent, .cookie-banner, #cookie-banner, #cookiebanner, .cookiebanner,
[aria-label="cookieconsent"], [id^="sp_message_container"],
ins.adsbygoogle, .adsbygoogle, [id^="google_ads_"], [id^="div-gpt-ad"], [id^="aswift_"], #google_vignette,
iframe[src*="googlesyndication"], iframe[src*="doubleclick"], iframe[src*="adservice"], iframe[id^="google_ads"],
iframe[src*="amazon-adsystem"], iframe[src*="taboola"], iframe[src*="outbrain"], iframe[src*="googleads"],
iframe[src*="syndicatedsearch"], .fc-consent-root, .fc-dialog-overlay, iframe[name^="googlefc"],
.google-auto-placed, ins[data-anchor-status], ins[data-ad-format], #ft-floating-toolbar`;
const HIDE_CONSENT = `${HIDE_SELECTORS} { display: none !important; }\nhtml, body { overflow: auto !important; }`;

mkdirSync(outDir, { recursive: true });
const meta: Record<string, string> = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);

const products = readdirSync(productDir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({ slug: f.replace(/\.yaml$/, ""), ...productSchema.parse(parse(readFileSync(join(productDir, f), "utf8"))) }))
  .filter((p) => (only.length ? only.includes(p.slug) : true))
  .filter((p) => p.status !== "discontinued")
  .filter((p) => force || !meta[p.slug]?.startsWith(today.slice(0, 7)) || !existsSync(join(outDir, `${p.slug}.jpg`)));

/**
 * Hides the selectors above inline (some widgets use inline !important styles that beat a stylesheet),
 * plus fixed-position elements that wrap a third-party iframe (late-loading ads, consent prompts, chat widgets).
 */
function hideThirdPartyOverlays(selectors: string) {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selectors))) el.style.setProperty("display", "none", "important");
  // Widgets rendered inside a shadow root (e.g. Google's privacy toolbar): hide the host.
  for (const host of Array.from(document.querySelectorAll<HTMLElement>("body *")))
    if (host.shadowRoot?.querySelector(selectors)) host.style.setProperty("display", "none", "important");
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
    const pos = getComputedStyle(el).position;
    if (pos !== "fixed" && pos !== "sticky") continue;
    const frames = el.tagName === "IFRAME" ? [el as HTMLIFrameElement] : Array.from(el.querySelectorAll("iframe"));
    if (frames.some((f) => f.src && new URL(f.src, location.href).origin !== location.origin)) el.style.setProperty("display", "none", "important");
  }
}

async function capture(browser: Browser, slug: string, url: string) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: "en-US",
    colorScheme: "light",
    userAgent: "Mozilla/5.0 (compatible; PresenterList-screenshot; +https://presenterlist.org/about/)",
  });
  const page = await context.newPage();
  // Keep hiding late-arriving widgets for the whole visit, not just once.
  await page.addInitScript(
    ([fn, selectors]) => setInterval(() => new Function("selectors", `(${fn})(selectors)`)(selectors), 250),
    [hideThirdPartyOverlays.toString(), HIDE_SELECTORS] as const,
  );
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    // Let late content, fonts and hero animations settle. Some sites never go idle.
    await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.addStyleTag({ content: HIDE_CONSENT }).catch(() => {});
    await page.waitForTimeout(2_000);
    // Twice, to catch widgets that appear late.
    await page.evaluate(hideThirdPartyOverlays, HIDE_SELECTORS).catch(() => {});
    await page.waitForTimeout(1_000);
    await page.evaluate(hideThirdPartyOverlays, HIDE_SELECTORS).catch(() => {});
    await page.screenshot({ path: join(outDir, `${slug}.jpg`), type: "jpeg", quality: 72 });
    meta[slug] = today;
    console.log(`✓ ${slug}`);
  } catch (e) {
    console.error(`✗ ${slug}: ${(e as Error).message.split("\n")[0]}${existsSync(join(outDir, `${slug}.jpg`)) ? " (keeping previous)" : ""}`);
  } finally {
    await context.close();
  }
}

if (products.length === 0) {
  console.log("All screenshots are up to date for this month.");
  process.exit(0);
}
const browser = await chromium.launch();
const queue = [...products];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) await capture(browser, p.slug, p.website);
  }),
);
await browser.close();
writeFileSync(metaFile, JSON.stringify(Object.fromEntries(Object.entries(meta).sort()), null, 2) + "\n");
console.log(`${products.length} checked, screenshots in public/screenshots`);
