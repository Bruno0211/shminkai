import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeFace,
  analyzeOutfit,
  explainLook,
  generateMakeupImage,
  preservesOpenEyes,
} from "@/lib/gemini";
import {
  generateMetadataSchema,
  generationResponseSchema,
  type Locale,
  type OutfitProfile,
} from "@/lib/schemas";

export const maxDuration = 120;

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_ATTEMPTS = 2;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function matchesMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function isAllowedImage(file: File) {
  return file.size > 0 && file.size <= MAX_PHOTO_BYTES && allowedTypes.has(file.type);
}

async function readImage(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return matchesMagicBytes(bytes, file.type) ? bytes : null;
}

// The outfit only steers the makeup plan, so a failed or clothing-free
// analysis is ignored rather than failing the whole generation.
async function safeAnalyzeOutfit(bytes: Buffer, mimeType: string, locale: Locale) {
  try {
    const outfit = await analyzeOutfit({ bytes, mimeType, locale });
    return outfit.hasClothing ? outfit : undefined;
  } catch (error) {
    console.error(
      "Outfit analysis failed:",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const metadataRaw = form.get("metadata");

    if (!(photo instanceof File) || typeof metadataRaw !== "string") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (!isAllowedImage(photo)) {
      return NextResponse.json({ error: "Invalid image." }, { status: 400 });
    }
    const outfitFile = form.get("outfit");
    if (outfitFile !== null && (!(outfitFile instanceof File) || !isAllowedImage(outfitFile))) {
      return NextResponse.json({ error: "Invalid outfit image." }, { status: 400 });
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json({ error: "Invalid metadata." }, { status: 400 });
    }
    const metadata = generateMetadataSchema.parse(metadataJson);
    if (outfitFile && metadata.mode !== "custom") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const bytes = await readImage(photo);
    if (!bytes) {
      return NextResponse.json({ error: "Invalid image content." }, { status: 400 });
    }
    const outfitBytes = outfitFile ? await readImage(outfitFile) : null;
    if (outfitFile && !outfitBytes) {
      return NextResponse.json({ error: "Invalid outfit image content." }, { status: 400 });
    }

    const [analysis, outfit] = await Promise.all([
      analyzeFace({ bytes, mimeType: photo.type, locale: metadata.locale }),
      outfitFile && outfitBytes
        ? safeAnalyzeOutfit(outfitBytes, outfitFile.type, metadata.locale)
        : Promise.resolve<OutfitProfile | undefined>(undefined),
    ]);
    const copy = await explainLook({
      analysis,
      locale: metadata.locale,
      preferences: metadata.preferences,
      outfit,
    });
    let image: string | undefined;
    for (let attempt = 0; attempt < MAX_IMAGE_ATTEMPTS; attempt += 1) {
      const candidate = await generateMakeupImage({
        bytes,
        mimeType: photo.type,
        analysis,
        mode: metadata.mode,
        preferences: metadata.preferences,
        lookProfile: copy.lookProfile,
        eyeCorrection: attempt > 0,
      });
      if (await preservesOpenEyes({
        sourceBytes: bytes,
        sourceMimeType: photo.type,
        generatedImage: candidate,
      })) {
        image = candidate;
        break;
      }
    }
    if (!image) throw new Error("Generated image did not preserve open eyes");

    const result = generationResponseSchema.parse({
      image,
      analysis,
      lookName: copy.lookName,
      explanation: copy.explanation,
      lookProfile: copy.lookProfile,
      outfit,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error(
      "Look generation failed:",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return NextResponse.json(
      { error: "The look could not be generated." },
      { status: 502 },
    );
  }
}
