import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeFace, explainLook, generateMakeupImage } from "@/lib/gemini";
import {
  generateMetadataSchema,
  generationResponseSchema,
} from "@/lib/schemas";

export const maxDuration = 120;

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
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

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const metadataRaw = form.get("metadata");

    if (!(photo instanceof File) || typeof metadataRaw !== "string") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (
      photo.size === 0
      || photo.size > MAX_PHOTO_BYTES
      || !allowedTypes.has(photo.type)
    ) {
      return NextResponse.json({ error: "Invalid image." }, { status: 400 });
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json({ error: "Invalid metadata." }, { status: 400 });
    }
    const metadata = generateMetadataSchema.parse(metadataJson);
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!matchesMagicBytes(bytes, photo.type)) {
      return NextResponse.json({ error: "Invalid image content." }, { status: 400 });
    }

    const analysis = await analyzeFace({
      bytes,
      mimeType: photo.type,
      locale: metadata.locale,
    });
    const copy = await explainLook({
      analysis,
      locale: metadata.locale,
      preferences: metadata.preferences,
    });
    const image = await generateMakeupImage({
      bytes,
      mimeType: photo.type,
      analysis,
      mode: metadata.mode,
      preferences: metadata.preferences,
      lookProfile: copy.lookProfile,
    });

    const result = generationResponseSchema.parse({
      image,
      analysis,
      lookName: copy.lookName,
      explanation: copy.explanation,
      lookProfile: copy.lookProfile,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "The look could not be generated." },
      { status: 502 },
    );
  }
}
