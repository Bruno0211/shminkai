import { NextResponse } from "next/server";
import { discoverProducts } from "@/lib/product-discovery";
import {
  recommendationRequestSchema,
  recommendationResponseSchema,
} from "@/lib/schemas";

export const maxDuration = 120;

const MAX_REQUEST_CHARS = 10_000;

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_REQUEST_CHARS) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const parsedInput = recommendationRequestSchema.safeParse(json);
    if (!parsedInput.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const result = recommendationResponseSchema.parse({
      recommendations: await discoverProducts(parsedInput.data),
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "Product recommendation search failed:",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return NextResponse.json(
      { error: "Product recommendations are unavailable." },
      { status: 500 },
    );
  }
}
