import { describe, expect, it } from "vitest";
import {
  generateMetadataSchema,
  generationResponseSchema,
  preferencesSchema,
} from "./schemas";

describe("generation schemas", () => {
  it("accepts a valid custom request", () => {
    const parsed = generateMetadataSchema.parse({
      mode: "custom",
      locale: "hr",
      preferences: { intensity: "soft", finish: "glowy", wishes: "Bronze eyes" },
    });
    expect(parsed.mode).toBe("custom");
  });

  it("rejects oversized free text", () => {
    expect(() => preferencesSchema.parse({ wishes: "x".repeat(501) })).toThrow();
  });

  it("requires a data image in the response", () => {
    const parsed = generationResponseSchema.safeParse({
      image: "https://example.com/photo.png",
      analysis: {},
      lookName: "Look",
      explanation: ["Reason"],
    });
    expect(parsed.success).toBe(false);
  });
});
