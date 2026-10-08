import "server-only";

import { ThinkingLevel } from "@google/genai";
import { client } from "./gemini";
import { buildCategorySearches, fallbackSearch, type CategorySearch } from "./product-searches";
import { productSearchPrompt } from "./prompts";
import { retailerForUrl, retailers } from "./retailers";
import {
  discoveredProductsSchema,
  type Locale,
  type LookProfile,
  type ProductRecommendation,
} from "./schemas";

const SEARCH_TIMEOUT_MS = 60_000;
const URL_CHECK_TIMEOUT_MS = 6_000;
const MAX_PRODUCTS_PER_CATEGORY = 5;
const MIN_RECOMMENDATIONS_PER_CATEGORY = 3;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in search response");
  return JSON.parse(text.slice(start, end + 1));
}

// Drops links the model invented: missing pages, and pages that redirect off
// the allowed shops or back to a homepage. Shops that block bots (403, network
// errors) are given the benefit of the doubt.
export async function productPageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(URL_CHECK_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; shminkAI product check)" },
    });
    await response.body?.cancel();
    if (response.status === 404 || response.status === 410) return false;
    const finalUrl = response.url || url;
    if (!retailerForUrl(finalUrl)) return false;
    return new URL(finalUrl).pathname.replace(/\/+$/, "") !== "";
  } catch {
    return true;
  }
}

async function searchCategory(
  search: CategorySearch,
  locale: Locale,
): Promise<ProductRecommendation[]> {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_SEARCH_MODEL
      ?? process.env.GEMINI_ANALYSIS_MODEL
      ?? "gemini-3.8-flash",
    contents: productSearchPrompt({
      query: search.query,
      shadeGuidance: search.shadeGuidance,
      locale,
      domains: retailers.map((retailer) => retailer.domain),
    }),
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
      // Default thinking makes grounded searches take ~70s; low keeps them ~15s.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    },
  });

  const { products } = discoveredProductsSchema.parse(extractJson(response.text ?? ""));
  const candidates = products
    .filter((product) => retailerForUrl(product.url))
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const verified = await Promise.all(
    candidates.map(async (product) => ((await productPageExists(product.url)) ? product : null)),
  );

  const seen = new Set<string>();
  return verified
    .filter((product) => product !== null)
    .filter((product) => !seen.has(product.url) && seen.add(product.url))
    .slice(0, MAX_PRODUCTS_PER_CATEGORY)
    .map<ProductRecommendation>((product, index) => ({
      id: `product-${search.category}-${index}`,
      kind: "product",
      category: search.category,
      brand: product.brand,
      name: product.name,
      shadeGuidance: product.shade?.trim() || search.shadeGuidance,
      matchScore: product.matchScore ?? Math.max(60, 100 - (index * 5)),
      retailer: retailerForUrl(product.url)!.name,
      url: product.url,
      matchReason: product.matchReason,
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

// Searches each makeup category in parallel on the allowed shops. A category
// whose search fails or finds nothing falls back to a site-restricted search link.
export async function discoverProducts({
  lookProfile,
  locale,
}: {
  lookProfile: LookProfile;
  locale: Locale;
}): Promise<ProductRecommendation[]> {
  const searches = buildCategorySearches({ lookProfile, locale });
  const results = await Promise.all(searches.map(async (search) => {
    let products: ProductRecommendation[] = [];
    try {
      products = await searchCategory(search, locale);
    } catch (error) {
      console.error(
        `Product search failed for ${search.category}:`,
        error instanceof Error ? error.message : "Unknown provider error",
      );
    }
    const usedRetailers = new Set(products.map((product) => product.retailer));
    const fallbacks = retailers
      .filter((retailer) => !usedRetailers.has(retailer.name))
      .slice(0, Math.max(0, MIN_RECOMMENDATIONS_PER_CATEGORY - products.length))
      .map((retailer, index) => fallbackSearch(search, locale, retailer, index));
    return [...products, ...fallbacks].sort((a, b) => b.matchScore - a.matchScore);
  }));
  return results.flat();
}
