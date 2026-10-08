import "server-only";

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { z } from "zod";
import {
  facialAnalysisSchema,
  lookProfileSchema,
  outfitProfileSchema,
  type FacialAnalysis,
  type Locale,
  type LookProfile,
  type OutfitProfile,
  type Preferences,
} from "./schemas";
import { analysisPrompt, explanationPrompt, imagePrompt, outfitPrompt } from "./prompts";

const explanationSchema = z.object({
  lookName: z.string().min(1).max(120),
  explanation: z.array(z.string().min(1).max(500)).min(1).max(8),
  lookProfile: lookProfileSchema,
});

export function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

export function parseJson(text: string) {
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

export async function analyzeOutfit({
  bytes,
  mimeType,
  locale,
}: {
  bytes: Buffer;
  mimeType: string;
  locale: Locale;
}): Promise<OutfitProfile> {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.8-flash",
    contents: [{
      role: "user",
      parts: [
        { text: outfitPrompt(locale) },
        { inlineData: { mimeType, data: bytes.toString("base64") } },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["hasClothing", "summary", "colors", "pattern", "formality", "metals"],
        properties: {
          hasClothing: { type: Type.BOOLEAN },
          summary: { type: Type.STRING },
          colors: { type: Type.ARRAY, maxItems: 4, items: { type: Type.STRING } },
          pattern: {
            type: Type.STRING,
            enum: ["solid", "print", "stripes", "checks", "textured", "mixed"],
          },
          formality: { type: Type.STRING, enum: ["casual", "smart", "evening", "formal"] },
          metals: { type: Type.STRING, enum: ["gold", "silver", "mixed", "none"] },
        },
      },
    },
  });
  return outfitProfileSchema.parse(parseJson(response.text ?? ""));
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
  outfit,
}: {
  analysis: FacialAnalysis;
  locale: Locale;
  preferences?: Preferences;
  outfit?: OutfitProfile;
}) {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.8-flash",
    contents: explanationPrompt({ analysis, locale, preferences, outfit }),
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
              "complexionDepth",
              "complexionUndertone",
              "complexionFinish",
              "blushFamily",
              "bronzerFamily",
              "eyeFamilies",
              "eyelinerColor",
              "mascaraColor",
              "browColor",
              "lipFamily",
              "lipFinish",
            ],
            properties: {
              intensity: {
                type: Type.STRING,
                enum: ["soft", "medium", "bold"],
              },
              complexionDepth: {
                type: Type.STRING,
                enum: ["fair", "light", "medium", "tan", "deep"],
              },
              complexionUndertone: {
                type: Type.STRING,
                enum: ["cool", "neutral", "warm", "olive"],
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
              mascaraColor: {
                type: Type.STRING,
                enum: ["black", "brown", "plum"],
              },
              browColor: {
                type: Type.STRING,
                enum: ["black", "brown", "taupe", "auburn", "blonde"],
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

