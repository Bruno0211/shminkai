import "server-only";

import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { client } from "./gemini";
import { buildCategorySearches, fallbackSearch, type CategorySearch } from "./product-searches";
import { productSearchPrompt } from "./prompts";
import { isProductPage, retailerForUrl, retailers } from "./retailers";
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
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1_000;
const USER_AGENT = "Mozilla/5.0 (compatible; shminkAI product check)";
const GROUNDING_REDIRECT_HOST = "vertexaisearch.cloud.google.com";

type DiscoveredProduct = z.infer<typeof discoveredProductsSchema>["products"][number];
// `shade` is set when the shop page is a single shade variant, so the card shows
// that page's shade instead of the model's description of the product line.
type VerifiedPage = { url: string; title: string; shade?: string };
type ProductMatch = { product: DiscoveredProduct; retailer: string } & VerifiedPage;

// Verification results are cached so repeated looks do not hit the shops again.
const verificationCache = new Map<string, { value: unknown; expires: number }>();

async function cached<T>(key: string, load: () => Promise<{ value: T; cache: boolean }>) {
  const hit = verificationCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const { value, cache } = await load();
  if (cache) {
    if (verificationCache.size >= CACHE_MAX_ENTRIES) {
      verificationCache.delete(verificationCache.keys().next().value!);
    }
    verificationCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  }
  return value;
}

export function clearVerificationCache() {
  verificationCache.clear();
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in search response");
  return JSON.parse(text.slice(start, end + 1));
}

// Google Search grounding hands the model redirect links. When the model
// rewrites them into shop URLs it often invents product ids, so the model
// returns the redirect and we follow it to the page Google actually indexed.
export async function resolveSource(source: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return null;
  }
  if (parsed.hostname !== GROUNDING_REDIRECT_HOST) return source;
  try {
    const response = await fetch(source, {
      redirect: "manual",
      signal: AbortSignal.timeout(URL_CHECK_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    await response.body?.cancel();
    return response.headers.get("location");
  } catch {
    return null;
  }
}

function pageTitle(html: string) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  return title
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .split(" | ")[0]
    .trim();
}

// The page must load with HTTP 200 on an allowed shop without redirecting to a
// non-product page. Anything that cannot be checked is rejected.
export async function verifyProductPage(url: string): Promise<VerifiedPage | null> {
  return cached(`page:${url}`, async () => {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(URL_CHECK_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT },
      });
      const finalUrl = response.url || url;
      if (response.status !== 200 || !isProductPage(finalUrl)) {
        await response.body?.cancel();
        // Only definite answers are cached; blocks and server errors may be temporary.
        const definite = response.status === 200 || response.status === 404 || response.status === 410;
        return { value: null, cache: definite };
      }
      return { value: { url: finalUrl, title: pageTitle(await response.text()) }, cache: true };
    } catch {
      return { value: null, cache: false };
    }
  });
}

const dmProductSchema = z.object({
  title: z.object({ headline: z.string() }),
  metadata: z.object({ canonical: z.string().url() }),
});

// dm titles read "Product name – Shade, size", e.g.
// "True Match tekući puder – 1.N Neutral Undertone, 30 ml".
export function splitDmTitle(headline: string): { title: string; shade?: string } {
  const separator = headline.lastIndexOf(" – ");
  if (separator === -1) return { title: headline };
  const shade = headline
    .slice(separator + 3)
    .replace(/,\s*[\d.,]+\s*(ml|g|kom\.?)\s*$/i, "")
    .trim();
  return shade ? { title: headline, shade } : { title: headline };
}

// dm pages render client-side and return 200 even for missing products, so the
// product id in the URL is looked up in dm's product service instead.
export async function verifyDmProduct(url: string): Promise<VerifiedPage | null> {
  const dan = new URL(url).pathname.match(/^\/p\/d\/(\d+)\//)?.[1];
  if (!dan) return null;
  return cached(`dm:${dan}`, async () => {
    try {
      const response = await fetch(
        `https://products.dm.de/product/products/detail/HR/dan/${dan}`,
        { signal: AbortSignal.timeout(URL_CHECK_TIMEOUT_MS) },
      );
      if (response.status === 404) return { value: null, cache: true };
      if (!response.ok) return { value: null, cache: false };
      const parsed = dmProductSchema.safeParse(await response.json());
      if (!parsed.success || !isProductPage(parsed.data.metadata.canonical)) {
        return { value: null, cache: false };
      }
      const { title, metadata } = parsed.data;
      return {
        value: {
          url: metadata.canonical,
          ...splitDmTitle(title.headline.replace(/\s+/g, " ").trim()),
        },
        cache: true,
      };
    } catch {
      return { value: null, cache: false };
    }
  });
}

function words(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

// Guards against the model describing one product while the link it cited is
// another: most words of the model's product name must appear in the shop's title.
export function titleMatches(name: string, title: string) {
  const titleWords = new Set(words(title));
  const nameWords = words(name);
  if (nameWords.length === 0) return false;
  const found = nameWords.filter((word) => titleWords.has(word)).length;
  return found / nameWords.length >= 0.5;
}

// Shop titles often start with the brand, which the product card already shows.
function withoutBrand(title: string, brand: string) {
  const rest = title.slice(brand.length).replace(/^[\s\-–:]+/, "");
  return title.toLowerCase().startsWith(brand.toLowerCase()) && rest ? rest : title;
}

async function verifyProduct(product: DiscoveredProduct): Promise<ProductMatch | null> {
  const url = await resolveSource(product.source);
  if (!url || !isProductPage(url)) return null;
  const retailer = retailerForUrl(url)!;
  const page = retailer.verify === "dm-api"
    ? await verifyDmProduct(url)
    : await verifyProductPage(url);
  if (!page || !titleMatches(product.name, page.title)) return null;
  return { product, retailer: retailer.name, ...page };
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

  // Candidates are verified in parallel (results are cached), then the best
  // verified matches are kept in rank order.
  const ranked = [...products].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const verified = await Promise.all(ranked.map(verifyProduct));

  const matches: ProductMatch[] = [];
  for (const match of verified) {
    if (matches.length >= MAX_PRODUCTS_PER_CATEGORY) break;
    if (match && !matches.some((existing) => existing.url === match.url)) matches.push(match);
  }

  return matches
    .map<ProductRecommendation>(({ product, retailer, url, title, shade }, index) => ({
      id: `product-${search.category}-${index}`,
      kind: "product",
      category: search.category,
      brand: product.brand,
      name: withoutBrand(title, product.brand).slice(0, 160),
      shadeGuidance: shade ?? (product.shade?.trim() || search.shadeGuidance),
      matchScore: product.matchScore ?? Math.max(60, 100 - (index * 5)),
      retailer,
      url,
      matchReason: product.matchReason,
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

// Searches each makeup category in parallel on the allowed shops. A category
// whose search fails or finds no verified product falls back to a
// site-restricted search link.
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
