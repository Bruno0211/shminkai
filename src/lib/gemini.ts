import "server-only";

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { z } from "zod";
import {
  facialAnalysisSchema,
  lookProfileSchema,
  productRecommendationSchema,
  recommendationResponseSchema,
  type FacialAnalysis,
  type Locale,
  type LookProfile,
  type ProductCategory,
  type ProductRecommendation,
  type Preferences,
} from "./schemas";
import { analysisPrompt, explanationPrompt, imagePrompt } from "./prompts";

const explanationSchema = z.object({
  lookName: z.string().min(1).max(120),
  explanation: z.array(z.string().min(1).max(500)).min(1).max(8),
  lookProfile: lookProfileSchema,
});

const searchedRecommendationSchema = z.object({
  recommendations: z.array(
    productRecommendationSchema.omit({ id: true }),
  ).min(1).max(12),
});

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

function parseJson(text: string) {
  return JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
}

export async function analyzeFace({
  bytes,
  mimeType,
  locale,
}: {
  bytes: Buffer;
  mimeType: string;
  locale: Locale;
}): Promise<FacialAnalysis> {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.8-flash",
    contents: [{
      role: "user",
      parts: [
        { text: analysisPrompt(locale) },
        { inlineData: { mimeType, data: bytes.toString("base64") } },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: [
          "skinTone",
          "undertone",
          "eyeColor",
          "hairColor",
          "faceShape",
          "eyeShape",
          "lipShape",
        ],
        properties: {
          skinTone: { type: Type.STRING },
          undertone: { type: Type.STRING },
          eyeColor: { type: Type.STRING },
          hairColor: { type: Type.STRING },
          faceShape: { type: Type.STRING },
          eyeShape: { type: Type.STRING },
          lipShape: { type: Type.STRING },
        },
      },
    },
  });
  return facialAnalysisSchema.parse(parseJson(response.text ?? ""));
}

export async function generateMakeupImage({
  bytes,
  mimeType,
  analysis,
  mode,
  preferences,
  lookProfile,
}: {
  bytes: Buffer;
  mimeType: string;
  analysis: FacialAnalysis;
  mode: "random" | "custom";
  preferences?: Preferences;
  lookProfile: LookProfile;
}) {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
    contents: [{
      role: "user",
      parts: [
        { text: imagePrompt({ analysis, mode, preferences, lookProfile }) },
        { inlineData: { mimeType, data: bytes.toString("base64") } },
      ],
    }],
    config: { responseModalities: [Modality.IMAGE] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data) throw new Error("Gemini did not return an image");
  return `data:${image.mimeType ?? "image/png"};base64,${image.data}`;
}

export async function explainLook({
  analysis,
  locale,
  preferences,
}: {
  analysis: FacialAnalysis;
  locale: Locale;
  preferences?: Preferences;
}) {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.8-flash",
    contents: explanationPrompt({ analysis, locale, preferences }),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["lookName", "explanation", "lookProfile"],
        properties: {
          lookName: { type: Type.STRING },
          explanation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          lookProfile: {
            type: Type.OBJECT,
            required: [
              "intensity",
              "complexionFinish",
              "blushFamily",
              "bronzerFamily",
              "eyeFamilies",
              "eyelinerColor",
              "lipFamily",
              "lipFinish",
            ],
            properties: {
              intensity: {
                type: Type.STRING,
                enum: ["soft", "medium", "bold"],
              },
              complexionFinish: {
                type: Type.STRING,
                enum: ["natural", "matte", "radiant", "satin"],
              },
              blushFamily: {
                type: Type.STRING,
                enum: [
                  "neutral", "rose", "peach", "coral", "berry", "mauve",
                  "red", "nude", "brown", "bronze", "gold", "champagne",
                  "taupe", "plum", "black",
                ],
              },
              bronzerFamily: {
                type: Type.STRING,
                enum: ["neutral", "warm"],
              },
              eyeFamilies: {
                type: Type.ARRAY,
                minItems: 1,
                maxItems: 3,
                items: {
                  type: Type.STRING,
                  enum: [
                    "neutral", "rose", "peach", "coral", "berry", "mauve",
                    "red", "nude", "brown", "bronze", "gold", "champagne",
                    "taupe", "plum", "black",
                  ],
                },
              },
              eyelinerColor: {
                type: Type.STRING,
                enum: ["black", "brown", "plum"],
              },
              lipFamily: {
                type: Type.STRING,
                enum: [
                  "neutral", "rose", "peach", "coral", "berry", "mauve",
                  "red", "nude", "brown", "bronze", "gold", "champagne",
                  "taupe", "plum", "black",
                ],
              },
              lipFinish: {
                type: Type.STRING,
                enum: ["matte", "satin", "glossy"],
              },
            },
          },
        },
      },
    },
  });
  return explanationSchema.parse(parseJson(response.text ?? ""));
}

function safeProductHostname(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || hostname === "localhost"
      || hostname.endsWith(".local")
      || hostname.includes(":")
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    ) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

type GroundedStep = {
  type: string;
  is_error?: boolean;
  content?: Array<{
    type: string;
    annotations?: Array<{ type: string; url?: string }>;
  }>;
};

function citedProductHosts(steps?: GroundedStep[]) {
  const hosts = new Set<string>();
  for (const step of steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const content of step.content ?? []) {
      if (content.type !== "text") continue;
      for (const annotation of content.annotations ?? []) {
        if (annotation.type !== "url_citation" || !annotation.url) continue;
        const hostname = safeProductHostname(annotation.url);
        if (hostname) hosts.add(hostname);
      }
    }
  }
  return hosts;
}

type ProductSearchGroup = {
  name: string;
  categories: ProductCategory[];
  limit: number;
};

const productSearchGroups: ProductSearchGroup[] = [
  {
    name: "face",
    categories: ["complexion", "blush", "bronzer"],
    limit: 3,
  },
  {
    name: "eyes",
    categories: ["eyeshadow", "eyeliner", "mascara", "brows"],
    limit: 4,
  },
  {
    name: "lips",
    categories: ["lips"],
    limit: 2,
  },
];

function productSearchPrompt(
  lookProfile: LookProfile,
  locale: Locale,
  group: ProductSearchGroup,
) {
  return `Use Google Search to find currently available makeup products that can recreate this makeup plan:
${JSON.stringify(lookProfile)}

Requirements:
- Search only these categories: ${group.categories.join(", ")}.
- Return no more than ${group.limit} real products, ideally one per requested category.
- Prioritize products currently sold by Croatian retailers, then add global alternatives for important color products.
- Include a mix of affordable and premium options.
- Every URL must be a direct HTTPS product page discovered in this search. Never invent, autocomplete, or guess a URL.
- Ground every returned product URL with a source citation.
- Do not link to search pages, articles, social posts, or category pages.
- Match color families, finish, and intensity to the makeup plan.
- For complexion, recommend a formula/finish only and tell the shopper to choose their own shade. Never estimate a foundation or concealer shade.
- Write shadeGuidance and matchReason in ${locale === "hr" ? "Croatian" : "English"}.
- Use market "hr" for Croatian retailers and "global" otherwise.
- If a suitable verified product page is not found, omit that product rather than guessing.
- Return only valid JSON with this exact shape and no Markdown:
{"recommendations":[{"category":"complexion|blush|bronzer|eyeshadow|eyeliner|mascara|brows|lips","brand":"...","name":"...","shadeGuidance":"...","priceTier":"affordable|premium","market":"hr|global","retailer":"...","url":"https://...","matchReason":"..."}]}`;
}

async function searchProductGroup({
  lookProfile,
  locale,
  group,
}: {
  lookProfile: LookProfile;
  locale: Locale;
  group: ProductSearchGroup;
}) {
  const interaction = await client().interactions.create({
    model: process.env.GEMINI_PRODUCT_MODEL
      ?? process.env.GEMINI_ANALYSIS_MODEL
      ?? "gemini-3.8-flash",
    input: productSearchPrompt(lookProfile, locale, group),
    tools: [{ type: "google_search" }],
    store: false,
  });

  const searched = interaction.steps?.some(
    (step) => step.type === "google_search_result" && !step.is_error,
  );
  if (!searched || !interaction.output_text) {
    throw new Error("Gemini did not complete a grounded product search");
  }

  const parsed = searchedRecommendationSchema.parse(
    parseJson(interaction.output_text),
  );
  const citedHosts = citedProductHosts(interaction.steps);
  if (citedHosts.size === 0) {
    throw new Error("Grounded product search returned no cited sources");
  }
  const grounded = parsed.recommendations.filter((product) => {
    const hostname = safeProductHostname(product.url);
    return group.categories.includes(product.category)
      && hostname !== null;
  });
  if (grounded.length === 0) {
    throw new Error(`Grounded ${group.name} search returned no verified products`);
  }
  return grounded.slice(0, group.limit);
}

export async function searchProducts({
  lookProfile,
  locale,
}: {
  lookProfile: LookProfile;
  locale: Locale;
}): Promise<ProductRecommendation[]> {
  let found: Array<Omit<ProductRecommendation, "id">>;
  try {
    found = await Promise.any(
      productSearchGroups.map(async (group) => {
        try {
          return await searchProductGroup({ lookProfile, locale, group });
        } catch (error) {
          console.warn(
            `Product recommendation ${group.name} search failed:`,
            error instanceof Error ? error.message : "Unknown provider error",
          );
          throw error;
        }
      }),
    );
  } catch {
    throw new Error("No grounded product group returned verified products");
  }
  const unique = [...new Map(found.map((product) => [product.url, product])).values()];

  return recommendationResponseSchema.parse({
    recommendations: unique.map((product, index) => ({
      ...product,
      id: `${product.category}-${index}-${product.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80),
    })),
  }).recommendations;
}
