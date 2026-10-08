// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchProducts } = vi.hoisted(() => ({
  searchProducts: vi.fn(),
}));

vi.mock("@/lib/gemini", () => ({ searchProducts }));

import { POST } from "./route";

const validBody = {
  locale: "en",
  lookProfile: {
    intensity: "medium",
    complexionFinish: "natural",
    blushFamily: "rose",
    bronzerFamily: "neutral",
    eyeFamilies: ["taupe", "champagne"],
    eyelinerColor: "brown",
    lipFamily: "mauve",
    lipFinish: "matte",
  },
};

function request(body: unknown) {
  return new Request("http://localhost/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/recommendations", () => {
  beforeEach(() => {
    searchProducts.mockReset();
    searchProducts.mockResolvedValue([{
      id: "complexion-0",
      category: "complexion",
      brand: "Example",
      name: "Radiant Base",
      shadeGuidance: "Choose your own shade.",
      priceTier: "affordable",
      market: "hr",
      retailer: "Example Croatia",
      url: "https://example.com/products/radiant-base",
      matchReason: "Matches the natural complexion finish.",
    }]);
  });

  it("returns validated matched products without caching", async () => {
    const response = await POST(request(validBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.recommendations).toHaveLength(1);
    expect(json.recommendations[0]).toMatchObject({
      category: "complexion",
      market: "hr",
    });
    expect(searchProducts).toHaveBeenCalledWith(validBody);
  });

  it("rejects invalid look metadata", async () => {
    const response = await POST(request({
      ...validBody,
      lookProfile: { ...validBody.lookProfile, lipFamily: "invented-color" },
    }));

    expect(response.status).toBe(400);
  });

  it("rejects oversized payloads", async () => {
    const response = await POST(request({ padding: "x".repeat(10_001) }));
    expect(response.status).toBe(400);
  });

  it("returns a safe error when grounded search fails", async () => {
    searchProducts.mockRejectedValueOnce(new Error("Search failed"));
    const response = await POST(request(validBody));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Product recommendations are unavailable.",
    });
  });
});
