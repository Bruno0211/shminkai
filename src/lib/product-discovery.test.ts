// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./gemini", () => ({
  client: () => ({ models: { generateContent } }),
}));

import { discoverProducts, productPageExists } from "./product-discovery";
import type { LookProfile } from "./schemas";

const lookProfile: LookProfile = {
  intensity: "medium",
  complexionFinish: "natural",
  blushFamily: "rose",
  bronzerFamily: "neutral",
  eyeFamilies: ["taupe"],
  eyelinerColor: "brown",
  lipFamily: "mauve",
  lipFinish: "matte",
};

function fetchResponse(status: number, url: string) {
  return { status, url, body: null } as unknown as Response;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  generateContent.mockReset();
});

describe("discoverProducts", () => {
  it("keeps only verified product pages on allowed shops", async () => {
    generateContent.mockResolvedValue({
      text: `Here you go: ${JSON.stringify({
        products: [
          { brand: "Essence", name: "Blush", shade: "Rose", url: "https://www.notino.hr/essence/blush/", matchReason: "Rose." },
          { brand: "Other", name: "Elsewhere", url: "https://www.amazon.de/blush", matchReason: "Off-list." },
          { brand: "Gone", name: "Missing", url: "https://www.douglas.hr/p/missing", matchReason: "404." },
        ],
      })}`,
    });
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      fetchResponse(url.includes("missing") ? 404 : 200, url)));

    const results = await discoverProducts({ lookProfile, locale: "en" });
    const blush = results.filter((result) => result.category === "blush");

    expect(blush).toEqual([expect.objectContaining({
      kind: "product",
      brand: "Essence",
      retailer: "Notino",
      shadeGuidance: "Rose",
      url: "https://www.notino.hr/essence/blush/",
    })]);
    expect(results.every((result) => !result.url.includes("amazon"))).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(8);
    expect(generateContent.mock.calls[0][0].config.tools).toEqual([{ googleSearch: {} }]);
  });

  it("falls back to a shop-restricted search when discovery fails", async () => {
    generateContent.mockRejectedValue(new Error("quota"));

    const results = await discoverProducts({ lookProfile, locale: "hr" });

    expect(results).toHaveLength(8);
    expect(results.every((result) => result.kind === "search")).toBe(true);
    expect(new URL(results[0].url).searchParams.get("q")).toContain("site:dm.hr");
  });
});

describe("productPageExists", () => {
  it("rejects pages that redirect to a homepage or another site", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(fetchResponse(200, "https://www.notino.hr/"))
      .mockResolvedValueOnce(fetchResponse(200, "https://example.com/p/1")));

    expect(await productPageExists("https://www.notino.hr/p/1")).toBe(false);
    expect(await productPageExists("https://www.notino.hr/p/2")).toBe(false);
  });

  it("accepts shops that block automated checks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked")));
    expect(await productPageExists("https://www.dm.hr/p/1")).toBe(true);
  });
});
