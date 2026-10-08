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

export const generationResponseSchema = z.object({
  image: z.string().startsWith("data:image/"),
  analysis: facialAnalysisSchema,
  lookName: z.string().min(1).max(120),
  explanation: z.array(z.string().min(1).max(500)).min(1).max(8),
});

export type FacialAnalysis = z.infer<typeof facialAnalysisSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type GenerationResponse = z.infer<typeof generationResponseSchema>;
