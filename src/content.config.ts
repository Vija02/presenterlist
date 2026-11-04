import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { productSchema } from "./lib/schema.ts";

const products = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/data/products" }),
  schema: productSchema,
});

export const collections = { products };
