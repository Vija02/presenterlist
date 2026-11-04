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
 * Comparable features, grouped, with optional sub-features.
 *
 * Every value is one of:
 *   true      supported out of the box
 *   false     not supported
 *   "partial" limited support / workaround (explain in feature_notes)
 *   "addon"   needs a paid add-on, plugin or higher tier
 * Omitted means "unknown" and renders as "?".
 *
 * A feature with sub-features can be written either way in YAML:
 *   slides: true            # supports slides, specifics unknown
 *   slides:                 # specifics known
 *     powerpoint: true
 *     animations: partial
 * The top-level value is then rolled up from the sub-features (see featureValueOf).
 */
type FeatureDef = { label: string; description?: string; sub?: Record<string, string> };
type GroupDef = { label: string; features: Record<string, FeatureDef> };

export const FEATURE_GROUPS = {
  content: {
    label: "Content",
    features: {
      songs: {
        label: "Songs & lyrics",
        sub: {
          library: "Song library",
          import_other: "Import from other presentation software",
          import_text: "Paste or import plain-text lyrics",
          auto_import: "Automatic lyrics import (e.g. SongSelect, online sources)",
          chords: "Chord charts for musicians",
          backgrounds: "Motion backgrounds behind lyrics",
          ccli_reporting: "CCLI usage reporting",
        },
      },
      bible: {
        label: "Bible",
        sub: {
          builtin: "Free translations included",
          licensed: "Licensed translations (NIV, ESV, etc.)",
        },
      },
      slides: {
        label: "Slides & presentations",
        sub: {
          powerpoint: "PowerPoint",
          keynote: "Keynote",
          google_slides: "Google Slides",
          canva: "Canva",
          pdf: "PDF",
          animations: "Plays slide animations & transitions",
        },
      },
      media: {
        label: "Media",
        sub: {
          video: "Video playback",
          audio: "Audio playback",
          images: "Images",
          youtube: "YouTube / online video",
        },
      },
      sources: {
        label: "Inputs & other sources",
        sub: {
          camera: "Live camera / capture card",
          screen_share: "Screen sharing",
          web: "Web pages",
          timers: "Countdown timers & clocks",
          messages: "On-screen messages & alerts",
          interaction: "Audience interaction (polls, Q&A, Slido, follow along)",
        },
      },
    },
  },
  languages: {
    label: "Languages",
    features: {
      multilingual: {
        label: "Multilingual",
        sub: {
          ui: "Interface in multiple languages",
          song_libraries: "Songs in other languages",
          bible_translations: "Bibles in other languages",
          bilingual_display: "Bilingual lyrics on screen",
          side_by_side: "Bible translations side by side",
          non_latin: "Non-Latin & right-to-left scripts",
        },
      },
    },
  },
  integrations: {
    label: "Integrations",
    features: {
      software_integrations: {
        label: "Software integrations",
        sub: {
          planning_center: "Planning Center",
          churchsuite: "ChurchSuite",
          worshiptools: "WorshipTools Planning",
        },
      },
      hardware: {
        label: "Hardware control",
        sub: { midi: "MIDI", dmx: "DMX lighting", stream_deck: "Stream Deck / Companion" },
      },
      automation: {
        label: "Automation & extensibility",
        sub: {
          api: "Network API (HTTP / WebSocket)",
          plugins: "Plugins / extensions",
          scripting: "Built-in scripting / macros",
          webhooks: "Webhooks / triggers to other systems",
          mcp: "MCP server for AI assistants",
          ai: "AI features (e.g. verse detection, lyric formatting)",
        },
      },
    },
  },
  presenting: {
    label: "Presenting & control",
    features: {
      outputs: {
        label: "Screens & outputs",
        sub: {
          multiple: "Multiple audience screens",
          stage_display: "Stage display / confidence monitor",
          lower_thirds: "Lower thirds / alpha key for streaming",
          web_output: "Output as a web page (TVs, OBS / vMix browser source)",
        },
      },
      broadcast_video: {
        label: "Broadcast video",
        description: "Professional video connections for production switchers and streaming setups. SDI needs a card such as Blackmagic DeckLink or AJA.",
        sub: { ndi: "NDI", sdi: "SDI" },
      },
      streaming: {
        label: "Built-in streaming & recording",
        description: "Streaming or recording directly from the presentation software, without OBS or vMix.",
        sub: {
          rtmp: "Stream to any RTMP destination",
          youtube: "YouTube Live",
          facebook: "Facebook Live",
          recording: "Record the output to a file",
        },
      },
      tv_output: {
        label: "TV output",
        description: "Show content on TVs (kids rooms, lobby, overflow) without a dedicated computer.",
        sub: {
          apple_tv: "Apple TV app",
          android_tv: "Android / Google TV app",
          fire_tv: "Fire TV app",
          roku: "Roku app",
          casting: "Chromecast / AirPlay",
        },
      },
      connectivity: {
        label: "Connectivity & collaboration",
        sub: {
          cloud_sync: "Cloud sync of library",
          offline: "Works fully offline",
          remote_control: "Remote control from phone or tablet",
          collaboration: "Multiple operators at once",
          web_native: "Web native (runs in a browser)",
        },
      },
    },
  },
} satisfies Record<string, GroupDef>;

/** Top-level feature key, e.g. "slides". */
export type FeatureKey = string;
/** Top-level key or "parent.sub", e.g. "slides.canva". */
export type FeaturePath = string;

export const FEATURE_DEFS: Record<FeatureKey, FeatureDef> = Object.assign(
  {},
  ...Object.values(FEATURE_GROUPS).map((g) => g.features),
);
export const FEATURE_KEYS: FeatureKey[] = Object.keys(FEATURE_DEFS);
export const subKeys = (k: FeatureKey) => Object.keys(FEATURE_DEFS[k]?.sub ?? {});
/** Every path: each top-level key followed by its sub-feature paths. */
export const FEATURE_PATHS: FeaturePath[] = FEATURE_KEYS.flatMap((k) => [k, ...subKeys(k).map((s) => `${k}.${s}`)]);
/** Paths that carry their own data (features without subs, and sub-features). */
export const LEAF_PATHS: FeaturePath[] = FEATURE_KEYS.flatMap((k) =>
  subKeys(k).length ? subKeys(k).map((s) => `${k}.${s}`) : [k],
);

/** Short label: "Canva" for slides.canva. */
export function featureLabel(path: FeaturePath) {
  const [k, s] = path.split(".");
  return s ? (FEATURE_DEFS[k]?.sub?.[s] ?? path) : (FEATURE_DEFS[k]?.label ?? path);
}
/** Label with context: "Slides & presentations: Canva". */
export function featureFullLabel(path: FeaturePath) {
  const [k, s] = path.split(".");
  return s ? `${FEATURE_DEFS[k]?.label}: ${featureLabel(path)}` : featureLabel(path);
}

const featureValue = z.union([z.boolean(), z.literal("partial"), z.literal("addon")]);
export type FeatureValue = z.infer<typeof featureValue>;
type RawFeatures = Record<string, FeatureValue | Record<string, FeatureValue | undefined> | undefined>;

/**
 * Resolves a feature value for a path.
 * - Sub-feature: its own value; false if the whole feature is false; otherwise unknown.
 * - Top-level with subs given: best of the subs (true > partial > addon), false only when
 *   every listed sub is false.
 */
export function featureValueOf(features: RawFeatures | undefined, path: FeaturePath): FeatureValue | undefined {
  const [k, s] = path.split(".");
  const raw = features?.[k];
  if (s) {
    if (raw && typeof raw === "object") return raw[s];
    return raw === false ? false : undefined;
  }
  if (raw === undefined || typeof raw !== "object") return raw;
  const vals = Object.values(raw).filter((v) => v !== undefined);
  if (vals.includes(true)) return true;
  if (vals.includes("partial")) return "partial";
  if (vals.includes("addon")) return "addon";
  if (vals.length && vals.every((v) => v === false)) return false;
  return undefined;
}

const enumOf = <T extends Record<string, string>>(o: T) =>
  z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

const featuresShape = Object.fromEntries(
  FEATURE_KEYS.map((k) => {
    const subs = subKeys(k);
    const schema = subs.length
      ? z.union([featureValue, z.object(Object.fromEntries(subs.map((s) => [s, featureValue.optional()]))).strict()])
      : featureValue;
    return [k, schema.optional()];
  }),
);

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
      .superRefine((r, ctx) => {
        for (const k of Object.keys(r ?? {}))
          if (!FEATURE_PATHS.includes(k))
            ctx.addIssue({ code: "custom", path: [k], message: `unknown feature path (see FEATURE_GROUPS in src/lib/schema.ts)` });
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
