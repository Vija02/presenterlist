import type { APIRoute } from "astro";
import { getProducts } from "../lib/products.ts";

export const GET: APIRoute = async ({ site }) => {
  const products = await getProducts();
  return new Response(
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        count: products.length,
        products: products.map((p) => ({ ...p, url: new URL(`/software/${p.slug}/`, site).toString() })),
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json" } },
  );
};
