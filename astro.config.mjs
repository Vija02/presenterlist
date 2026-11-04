// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { SITE_URL } from "./src/config.ts";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  // Compression drops the line break between text and a tag on the next line ("as<strong>").
  compressHTML: false,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
