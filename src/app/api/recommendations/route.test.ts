// @vitest-environment node
import { describe, expect, it } from "vitest";

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
  it("returns tailored shopping searches without caching", async () => {
    const response = await POST(request(validBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.recommendations).toHaveLength(8);
    expect(json.recommendations.find(
      (recommendation: { category: string }) => recommendation.category === "blush",
    )).toMatchObject({
      brand: "Google Shopping",
      market: "hr",
    });
    expect(json.recommendations.find(
      (recommendation: { category: string }) => recommendation.category === "blush",
    ).url).toContain("rose+blush");
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
