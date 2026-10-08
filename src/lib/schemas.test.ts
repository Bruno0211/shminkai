import { describe, expect, it } from "vitest";
import {
  generateMetadataSchema,
  generationResponseSchema,
  preferencesSchema,
  recommendationRequestSchema,
  recommendationResponseSchema,
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

  it("validates bounded look profiles for recommendations", () => {
    const parsed = recommendationRequestSchema.parse({
      locale: "en",
      lookProfile: {
        intensity: "soft",
        complexionDepth: "light",
        complexionUndertone: "warm",
        complexionFinish: "radiant",
        blushFamily: "peach",
        bronzerFamily: "warm",
        eyeFamilies: ["bronze", "gold"],
        eyelinerColor: "brown",
        mascaraColor: "brown",
        browColor: "brown",
        lipFamily: "nude",
        lipFinish: "satin",
      },
    });

    expect(parsed.lookProfile.eyeFamilies).toEqual(["bronze", "gold"]);
  });

  it("rejects insecure product links", () => {
    const parsed = recommendationResponseSchema.safeParse({
      recommendations: [{
        id: "unsafe",
        category: "lips",
        brand: "Brand",
        name: "Product",
        shadeGuidance: "Choose a matching shade.",
        priceTier: "affordable",
        matchScore: 90,
        retailer: "Retailer",
        url: "http://example.com/product",
        matchReason: "It matches the lip finish.",
      }],
    });

    expect(parsed.success).toBe(false);
  });
});
