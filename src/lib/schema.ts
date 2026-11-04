// Single source of truth for the product data schema.
// Used by Astro content collections (src/content.config.ts) AND by the
// standalone validator (scripts/validate.ts), so keep this file free of
// Astro-specific imports.
import { z } from "zod";

export const PLATFORMS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  web: "Web browser",
  ios: "iOS / iPadOS",
  android: "Android",
  chromeos: "ChromeOS",
} as const;

export const DEPLOYMENTS = {
  desktop: "Desktop app",
  cloud: "Cloud / hosted",
  self_hosted: "Self-hosted",
} as const;

export const PRICING_MODELS = {
  free: "Free",
  freemium: "Freemium",
  subscription: "Subscription",
  one_time: "One-time purchase",
  donation: "Donation-supported",
} as const;

/**
 * Comparable features. Every product may set each key to:
 *   true      – supported out of the box
 *   false     – not supported
 *   "partial" – limited support / workaround (explain in feature_notes)
 *   "addon"   – needs a paid add-on, plugin or higher tier
 * Omitted keys mean "unknown" and render as "?".
 */
export const FEATURE_GROUPS = {
  content: {
    label: "Content",
    features: {
      lyrics: "Song / lyrics library",
      bible: "Built-in Bible",
      slides_import: "Import PowerPoint / Keynote / Google Slides",
      video_playback: "Video playback",
      audio_playback: "Audio playback",
      web_content: "Web pages / YouTube",
      timers: "Countdown timers & clocks",
      lower_thirds: "Lower thirds / alpha key for streaming",
    },
  },
  integrations: {
    label: "Integrations",
    features: {
      ccli_songselect: "CCLI SongSelect import",
      ccli_reporting: "CCLI usage reporting",
      planning_center: "Planning Center integration",
      ndi: "NDI input / output",
      live_video_input: "Live camera / capture input",
      midi: "MIDI / DMX / hardware control",
      api: "API / scripting / automation",
    },
  },
  presenting: {
    label: "Presenting & control",
    features: {
      multiple_outputs: "Multiple screens / outputs",
      stage_display: "Stage display / confidence monitor",
      remote_control: "Remote control from phone or tablet",
      collaboration: "Multiple operators at once",
      cloud_sync: "Cloud sync of library",
      offline: "Works fully offline",
    },
  },
} as const;

type Groups = typeof FEATURE_GROUPS;
export type FeatureKey = {
  [G in keyof Groups]: keyof Groups[G]["features"];
}[keyof Groups];

export const FEATURES: Record<FeatureKey, string> = Object.assign(
  {},
  ...Object.values(FEATURE_GROUPS).map((g) => g.features),
);
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

const featureValue = z.union([z.boolean(), z.literal("partial"), z.literal("addon")]);
export type FeatureValue = z.infer<typeof featureValue>;

const enumOf = <T extends Record<string, string>>(o: T) =>
  z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

const featuresShape = Object.fromEntries(
  FEATURE_KEYS.map((k) => [k, featureValue.optional()]),
) as Record<FeatureKey, z.ZodOptional<typeof featureValue>>;

const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"));

export const productSchema = z
  .object({
    name: z.string().min(1),
    /** One line, shown on cards. Keep under ~90 characters. */
    tagline: z.string().min(1).max(120),
    /** Neutral, factual overview paragraph(s). Plain text. */
    description: z.string().min(1),
    website: z.url(),
    /** Optional path under /public, e.g. /logos/freeshow.svg */
    logo: z.string().startsWith("/").optional(),
    developer: z.string().min(1),
    /** Country where most of the team is based. */
    headquarters: z.string().optional(),
    founded: z.number().int().min(1980).max(2100).optional(),
    status: z.enum(["active", "maintenance", "discontinued"]).default("active"),
    status_note: z.string().optional(),

    open_source: z.boolean().default(false),
    /** SPDX identifier, required when open_source is true. */
    license: z.string().optional(),
    source_code_url: z.url().optional(),

    pricing: z.object({
      models: z.array(enumOf(PRICING_MODELS)).min(1),
      free_trial: z.boolean().default(false),
      /** Human readable, e.g. "$399 one-time" or "From $25/month". */
      starting_price: z.string().optional(),
      pricing_url: z.url().optional(),
      notes: z.string().optional(),
    }),

    platforms: z.array(enumOf(PLATFORMS)).min(1),
    deployment: z.array(enumOf(DEPLOYMENTS)).min(1),
    /** Platforms that can act as an output screen if different from `platforms` (e.g. any browser). */
    output_note: z.string().optional(),

    features: z.object(featuresShape).strict().default({}),
    /** Optional clarifications, keyed by feature. */
    feature_notes: z
      .record(z.string(), z.string())
      .optional()
      .refine((r) => !r || Object.keys(r).every((k) => (FEATURE_KEYS as string[]).includes(k)), {
        message: `feature_notes keys must be one of: ${FEATURE_KEYS.join(", ")}`,
      }),

    languages: z.array(z.string()).optional(),
    docs_url: z.url().optional(),
    community_url: z.url().optional(),

    /** URLs used to verify this entry. */
    sources: z.array(z.url()).min(1),
    last_verified: isoDate,
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.open_source && !p.license)
      ctx.addIssue({ code: "custom", path: ["license"], message: "license is required when open_source is true" });
    if (p.open_source && !p.source_code_url)
      ctx.addIssue({
        code: "custom",
        path: ["source_code_url"],
        message: "source_code_url is required when open_source is true",
      });
  });

export type Product = z.infer<typeof productSchema>;
