import { z } from "zod";

export const localeSchema = z.enum(["hr", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const facialAnalysisSchema = z.object({
  skinTone: z.string().min(1).max(80),
  undertone: z.string().min(1).max(80),
  eyeColor: z.string().min(1).max(80),
  hairColor: z.string().min(1).max(80),
  faceShape: z.string().min(1).max(80),
  eyeShape: z.string().min(1).max(80),
  lipShape: z.string().min(1).max(80),
});

export const preferencesSchema = z.object({
  occasion: z.string().max(60).optional(),
  intensity: z.enum(["soft", "medium", "bold"]).optional(),
  colors: z.string().max(120).optional(),
  finish: z.enum(["natural", "matte", "glowy", "satin"]).optional(),
  wishes: z.string().trim().max(500).optional(),
});

export const generateMetadataSchema = z.object({
  mode: z.enum(["random", "custom"]),
  locale: localeSchema,
  preferences: preferencesSchema.optional(),
});

export const colorFamilySchema = z.enum([
  "neutral",
  "rose",
  "peach",
  "coral",
  "berry",
  "mauve",
  "red",
  "nude",
  "brown",
  "bronze",
  "gold",
  "champagne",
  "taupe",
  "plum",
  "black",
]);

export const productFinishSchema = z.enum([
  "natural",
  "matte",
  "radiant",
  "satin",
  "shimmer",
  "glossy",
]);

export const lookProfileSchema = z.object({
  intensity: z.enum(["soft", "medium", "bold"]),
  complexionDepth: z.enum(["fair", "light", "medium", "tan", "deep"]),
  complexionUndertone: z.enum(["cool", "neutral", "warm", "olive"]),
  complexionFinish: z.enum(["natural", "matte", "radiant", "satin"]),
  blushFamily: colorFamilySchema,
  bronzerFamily: z.enum(["neutral", "warm"]),
  eyeFamilies: z.array(colorFamilySchema).min(1).max(3),
  eyelinerColor: z.enum(["black", "brown", "plum"]),
  mascaraColor: z.enum(["black", "brown", "plum"]),
  browColor: z.enum(["black", "brown", "taupe", "auburn", "blonde"]),
  lipFamily: colorFamilySchema,
  lipFinish: z.enum(["matte", "satin", "glossy"]),
});

export const productCategorySchema = z.enum([
  "complexion",
  "concealer",
  "blush",
  "bronzer",
  "eyeshadow",
  "eyeliner",
  "mascara",
  "brows",
  "lips",
]);

export const recommendationRequestSchema = z.object({
  locale: localeSchema,
  lookProfile: lookProfileSchema,
});

export const productRecommendationSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["product", "search"]).optional(),
  category: productCategorySchema,
  brand: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  shadeGuidance: z.string().min(1).max(160),
  priceTier: z.enum(["affordable", "premium"]).optional(),
  matchScore: z.number().int().min(0).max(100),
  retailer: z.string().min(1).max(80),
  url: z.string().url().refine((url) => url.startsWith("https://")),
  matchReason: z.string().min(1).max(240),
});

export const recommendationResponseSchema = z.object({
  recommendations: z.array(productRecommendationSchema).min(1).max(45),
});

export const discoveredProductsSchema = z.object({
  products: z.array(z.object({
    brand: z.string().min(1).max(80),
    name: z.string().min(1).max(160),
    shade: z.string().max(160).optional(),
    url: z.string().url(),
    matchScore: z.number().int().min(0).max(100).optional(),
    matchReason: z.string().min(1).max(240),
  })).max(5),
});

export const generationResponseSchema = z.object({
  image: z.string().startsWith("data:image/"),
  analysis: facialAnalysisSchema,
  lookName: z.string().min(1).max(120),
  explanation: z.array(z.string().min(1).max(500)).min(1).max(8),
  lookProfile: lookProfileSchema,
});

export type FacialAnalysis = z.infer<typeof facialAnalysisSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type LookProfile = z.infer<typeof lookProfileSchema>;
export type ColorFamily = z.infer<typeof colorFamilySchema>;
export type ProductFinish = z.infer<typeof productFinishSchema>;
export type ProductCategory = z.infer<typeof productCategorySchema>;
export type ProductRecommendation = z.infer<typeof productRecommendationSchema>;
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
export type GenerationResponse = z.infer<typeof generationResponseSchema>;
