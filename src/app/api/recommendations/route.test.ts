// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/product-discovery", async () => {
  const { buildShoppingSearches } = await import("@/lib/product-searches");
  return { discoverProducts: vi.fn(async (input) => buildShoppingSearches(input)) };
});

import { POST } from "./route";

const validBody = {
  locale: "en",
  lookProfile: {
    intensity: "medium",
    complexionDepth: "medium",
    complexionUndertone: "warm",
    complexionFinish: "natural",
    blushFamily: "rose",
    bronzerFamily: "neutral",
    eyeFamilies: ["taupe", "champagne"],
    eyelinerColor: "brown",
    mascaraColor: "brown",
    browColor: "brown",
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
  it("returns recommendations without caching", async () => {
    const response = await POST(request(validBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.recommendations).toHaveLength(27);
    expect(json.recommendations.find(
      (recommendation: { category: string }) => recommendation.category === "blush",
    )).toMatchObject({
      kind: "search",
      matchScore: 40,
    });
    const blushUrl = new URL(json.recommendations.find(
      (recommendation: { category: string }) => recommendation.category === "blush",
    ).url);
    expect(blushUrl.searchParams.get("q")).toContain("rose blush");
    expect(blushUrl.searchParams.get("q")).toContain("site:notino.hr");
    const concealerUrl = new URL(json.recommendations.find(
      (recommendation: { category: string }) => recommendation.category === "concealer",
    ).url);
    expect(concealerUrl.searchParams.get("q")).toContain("concealer shade");
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

});
