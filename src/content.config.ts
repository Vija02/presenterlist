import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { newsSchema, productSchema } from "./lib/schema.ts";

const products = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/data/products" }),
  schema: productSchema,
});

const news = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/data/news" }),
  schema: newsSchema,
});

export const collections = { products, news };
