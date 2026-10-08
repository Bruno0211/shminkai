import "server-only";

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { z } from "zod";
import {
  facialAnalysisSchema,
  type FacialAnalysis,
  type Locale,
  type Preferences,
} from "./schemas";
import { analysisPrompt, explanationPrompt, imagePrompt } from "./prompts";

const explanationSchema = z.object({
  lookName: z.string().min(1).max(120),
  explanation: z.array(z.string().min(1).max(500)).min(1).max(8),
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
}: {
  bytes: Buffer;
  mimeType: string;
  analysis: FacialAnalysis;
  mode: "random" | "custom";
  preferences?: Preferences;
}) {
  const response = await client().models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
    contents: [{
      role: "user",
      parts: [
        { text: imagePrompt({ analysis, mode, preferences }) },
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
        required: ["lookName", "explanation"],
        properties: {
          lookName: { type: Type.STRING },
          explanation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });
  return explanationSchema.parse(parseJson(response.text ?? ""));
}
