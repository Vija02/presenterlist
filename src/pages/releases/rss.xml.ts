import type { APIRoute } from "astro";
import { getReleases, rssResponse } from "../../lib/news.ts";

export const GET: APIRoute = async ({ site }) =>
  rssResponse(site!, {
    title: "Releases",
    description: "Monthly release roundups from church presentation software.",
    path: "/releases/",
    items: await getReleases(),
  });
