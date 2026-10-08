import "server-only";

import { ApiError, GoogleGenAI, Modality, ThinkingLevel, Type } from "@google/genai";
import sharp from "sharp";
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
import {
  analysisPrompt,
  explanationPrompt,
  eyeStateVerificationPrompt,
  imagePrompt,
  outfitPrompt,
} from "./prompts";

// Structured analysis calls (face, outfit, look plan, eye check) are simple
// classification/JSON tasks; Gemini's default thinking made them take up to
// ~26s each, so they use low thinking to keep a full look well under a minute.
const FAST_THINKING = { thinkingLevel: ThinkingLevel.LOW };

const explanationSchema = z.object({
  lookName: z.string().min(1).max(120),
  explanation: z.array(z.string().min(1).max(500)).min(1).max(8),
  lookProfile: lookProfileSchema,
});

const eyeStateSchema = z.object({
  sourceEyesOpen: z.boolean(),
  generatedEyesOpen: z.boolean(),
  generatedEyesObscured: z.boolean(),
});

// Gemini occasionally fails with temporary server-side errors (e.g. 500
// "Internal error encountered", 503 overloaded, 429 rate limited). These are
// retried with a short backoff instead of failing the whole look.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [800, 2_000];

export function isRetryableGeminiError(error: unknown) {
  return error instanceof ApiError && RETRYABLE_STATUSES.has(error.status);
}

export async function withRetry<T>(
  task: () => Promise<T>,
  { delays = RETRY_DELAYS_MS, signal }: { delays?: number[]; signal?: AbortSignal } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delays.length || signal?.aborted || !isRetryableGeminiError(error)) throw error;
      console.warn(
        `Gemini request failed (${(error as ApiError).status}), retrying in ${delays[attempt]}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

export function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const ai = new GoogleGenAI({ apiKey });
  const generateContent = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = (params) =>
    withRetry(() => generateContent(params), { signal: params.config?.abortSignal });
  return ai;
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
      thinkingConfig: FAST_THINKING,
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
      thinkingConfig: FAST_THINKING,
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

// Gemini returns a ~2-3 MB PNG. Re-encoding it as a high-quality JPEG (~150 KB)
// makes the eye check upload several seconds faster and keeps the response and
// the browser's session storage small.
const OUTPUT_JPEG_QUALITY = 88;

export async function toCompactJpeg(base64: string) {
  const jpeg = await sharp(Buffer.from(base64, "base64"))
    .jpeg({ quality: OUTPUT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function generateMakeupImage({
  bytes,
  mimeType,
  analysis,
  mode,
  preferences,
  lookProfile,
  eyeCorrection = false,
}: {
  bytes: Buffer;
  mimeType: string;
  analysis: FacialAnalysis;
  mode: "random" | "custom";
  preferences?: Preferences;
  lookProfile: LookProfile;
  eyeCorrection?: boolean;
}) {
  // The image model sometimes finishes without an image (finishReason
  // IMAGE_OTHER, no error status), mostly under bursts of requests. That is
  // temporary, so it is retried like other transient Gemini failures.
  for (let attempt = 0; ; attempt += 1) {
    const response = await client().models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
      contents: [{
        role: "user",
        parts: [
          { text: imagePrompt({ analysis, mode, preferences, lookProfile, eyeCorrection }) },
          { inlineData: { mimeType, data: bytes.toString("base64") } },
        ],
      }],
      config: { responseModalities: [Modality.IMAGE] },
    });

    const candidate = response.candidates?.[0];
    const image = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (image?.data) return toCompactJpeg(image.data);
    if (attempt >= RETRY_DELAYS_MS.length) {
      throw new Error(`Gemini did not return an image (${candidate?.finishReason ?? "no candidate"})`);
    }
    console.warn(
      `Gemini returned no image (${candidate?.finishReason ?? "no candidate"}), retrying in ${RETRY_DELAYS_MS[attempt]}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

export async function preservesOpenEyes({
  sourceBytes,
  sourceMimeType,
  generatedImage,
}: {
  sourceBytes: Buffer;
  sourceMimeType: string;
  generatedImage: string;
}) {
  const generatedMatch = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    generatedImage,
  );
  if (!generatedMatch) throw new Error("Generated image data is invalid");

  const response = await client().models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.8-flash",
    contents: [{
      role: "user",
      parts: [
        { text: eyeStateVerificationPrompt() },
        { inlineData: { mimeType: sourceMimeType, data: sourceBytes.toString("base64") } },
        { inlineData: { mimeType: generatedMatch[1], data: generatedMatch[2] } },
      ],
    }],
    config: {
      thinkingConfig: FAST_THINKING,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["sourceEyesOpen", "generatedEyesOpen", "generatedEyesObscured"],
        properties: {
          sourceEyesOpen: { type: Type.BOOLEAN },
          generatedEyesOpen: { type: Type.BOOLEAN },
          generatedEyesObscured: { type: Type.BOOLEAN },
        },
      },
    },
  });
  const result = eyeStateSchema.parse(parseJson(response.text ?? ""));
  return !result.sourceEyesOpen || (
    result.generatedEyesOpen && !result.generatedEyesObscured
  );
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
      thinkingConfig: FAST_THINKING,
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

