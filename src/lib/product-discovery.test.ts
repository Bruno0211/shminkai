// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./gemini", () => ({
  client: () => ({ models: { generateContent } }),
}));

import {
  clearVerificationCache,
  discoverProducts,
  resolveSource,
  titleMatches,
  verifyDmProduct,
  splitDmTitle,
  verifyProductPage,
} from "./product-discovery";
import type { LookProfile } from "./schemas";

const lookProfile: LookProfile = {
  intensity: "medium",
  complexionDepth: "medium",
  complexionUndertone: "warm",
  complexionFinish: "natural",
  blushFamily: "rose",
  bronzerFamily: "neutral",
  eyeFamilies: ["taupe"],
  eyelinerColor: "brown",
  mascaraColor: "brown",
  browColor: "brown",
  lipFamily: "mauve",
  lipFinish: "matte",
};

const redirect = (id: string) =>
  `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`;

function response(init: {
  status?: number;
  url?: string;
  location?: string;
  html?: string;
  json?: unknown;
}) {
  const status = init.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    url: init.url ?? "",
    headers: new Headers(init.location ? { location: init.location } : {}),
    body: { cancel: async () => {} },
    text: async () => init.html ?? "",
    json: async () => init.json,
  } as unknown as Response;
}

// Simulates Google redirects, shop pages, and dm's product service.
const web: Record<string, () => Response> = {
  [redirect("douglas")]: () => response({
    status: 302,
    location: "https://www.douglas.hr/p/dior-rouge-blush-c0294",
  }),
  "https://www.douglas.hr/p/dior-rouge-blush-c0294": () => response({
    url: "https://www.douglas.hr/p/dior-rouge-blush-c0294",
    html: "<title>DIOR Rouge Blush &#039;Rose&#x27; | DOUGLAS</title>",
  }),
  [redirect("dm")]: () => response({
    status: 302,
    location: "https://www.dm.hr/p/d/1602165/max-factor-creme-puff-blush",
  }),
  "https://products.dm.de/product/products/detail/HR/dan/1602165": () => response({
    json: {
      title: { headline: "Creme Puff Blush rumenilo – 15 Seductive Pink" },
      metadata: { canonical: "https://www.dm.hr/p/d/1602165/max-factor-creme-puff-blush" },
    },
  }),
  [redirect("category")]: () => response({
    status: 302,
    location: "https://www.douglas.hr/c/make-up/rumenila/",
  }),
  [redirect("gone")]: () => response({
    status: 302,
    location: "https://www.douglas.hr/p/discontinued-blush-123",
  }),
  "https://www.douglas.hr/p/discontinued-blush-123": () => response({ status: 404 }),
};

function stubWeb() {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const handler = web[input.toString()];
    return handler ? handler() : response({ status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearVerificationCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  generateContent.mockReset();
});

describe("discoverProducts", () => {
  it("shows only products whose search results resolve to verified product pages", async () => {
    generateContent.mockResolvedValue({
      text: `Here you go: ${JSON.stringify({
        products: [
          { brand: "Other", name: "Rose Blush", source: redirect("category"), matchScore: 99, matchReason: "Category page." },
          { brand: "Dior", name: "Rouge Blush", shade: "Rose", source: redirect("douglas"), matchScore: 90, matchReason: "Rose." },
          { brand: "Gone", name: "Discontinued Blush", source: redirect("gone"), matchScore: 98, matchReason: "404." },
          { brand: "Max Factor", name: "Creme Puff Blush 15 Seductive Pink", source: redirect("dm"), matchScore: 96, matchReason: "Pink." },
        ],
      })}`,
    });
    stubWeb();

    const results = await discoverProducts({ lookProfile, locale: "en" });
    const blush = results.filter((result) => result.category === "blush");

    expect(blush).toEqual([
      expect.objectContaining({
        kind: "product",
        retailer: "dm",
        matchScore: 96,
        name: "Creme Puff Blush rumenilo – 15 Seductive Pink",
        shadeGuidance: "15 Seductive Pink",
        url: "https://www.dm.hr/p/d/1602165/max-factor-creme-puff-blush",
      }),
      expect.objectContaining({
        kind: "product",
        retailer: "Douglas",
        brand: "Dior",
        matchScore: 90,
        name: "Rouge Blush 'Rose'",
        shadeGuidance: "Rose",
        url: "https://www.douglas.hr/p/dior-rouge-blush-c0294",
      }),
      expect.objectContaining({ kind: "search", retailer: "Müller" }),
    ]);
    expect(generateContent).toHaveBeenCalledTimes(9);
    expect(generateContent.mock.calls[0][0].config.tools).toEqual([{ googleSearch: {} }]);
  });

  it("rejects a link whose page is a different product than the model described", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        products: [{
          brand: "Dior",
          name: "Skinny Lining waterproof eyeliner",
          source: redirect("douglas"),
          matchReason: "Mismatch.",
        }],
      }),
    });
    stubWeb();

    const results = await discoverProducts({ lookProfile, locale: "en" });
    expect(results.every((result) => result.kind === "search")).toBe(true);
  });

  it("falls back to a shop-restricted search when discovery fails", async () => {
    generateContent.mockRejectedValue(new Error("quota"));

    const results = await discoverProducts({ lookProfile, locale: "hr" });

    expect(results).toHaveLength(27);
    expect(results.every((result) => result.kind === "search")).toBe(true);
    expect(results.every((result) => result.matchScore > 0)).toBe(true);
    expect(results.some((result) =>
      new URL(result.url).searchParams.get("q")?.includes("site:dm.hr"),
    )).toBe(true);
  });
});

describe("resolveSource", () => {
  it("follows Google redirects and passes direct links through", async () => {
    stubWeb();
    expect(await resolveSource(redirect("douglas")))
      .toBe("https://www.douglas.hr/p/dior-rouge-blush-c0294");
    expect(await resolveSource("https://www.douglas.hr/p/x")).toBe("https://www.douglas.hr/p/x");
    expect(await resolveSource("not a url")).toBeNull();
  });
});

describe("verifyProductPage", () => {
  it("rejects missing, blocked, and non-product pages", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ status: 404 }))
      .mockResolvedValueOnce(response({ status: 403 }))
      .mockResolvedValueOnce(response({ url: "https://www.douglas.hr/" }))
      .mockRejectedValueOnce(new Error("timeout")));

    expect(await verifyProductPage("https://www.douglas.hr/p/1")).toBeNull();
    expect(await verifyProductPage("https://www.mueller.hr/p/2")).toBeNull();
    expect(await verifyProductPage("https://www.douglas.hr/p/3")).toBeNull();
    expect(await verifyProductPage("https://www.douglas.hr/p/4")).toBeNull();
  });

  it("caches confirmed pages", async () => {
    const fetchMock = stubWeb();
    await verifyProductPage("https://www.douglas.hr/p/dior-rouge-blush-c0294");
    await verifyProductPage("https://www.douglas.hr/p/dior-rouge-blush-c0294");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("verifyDmProduct", () => {
  it("rejects products dm no longer has", async () => {
    stubWeb();
    expect(await verifyDmProduct("https://www.dm.hr/p/d/999/missing")).toBeNull();
    expect(await verifyDmProduct("https://www.dm.hr/make-up/olovke")).toBeNull();
  });
});

describe("splitDmTitle", () => {
  it("takes the variant shade from dm's title", () => {
    expect(splitDmTitle("True Match tekući puder – 1.N Neutral Undertone, 30 ml")).toEqual({
      title: "True Match tekući puder – 1.N Neutral Undertone, 30 ml",
      shade: "1.N Neutral Undertone",
    });
    expect(splitDmTitle("The Nudes paleta sjenila za oči, 12 g")).toEqual({
      title: "The Nudes paleta sjenila za oči, 12 g",
    });
  });
});

describe("titleMatches", () => {
  it("requires most of the product name to appear in the shop title", () => {
    expect(titleMatches("Hyper Precise All Day tuš za oči", "Hyper Precise All Day tuš za oči – Black")).toBe(true);
    expect(titleMatches("Skinny Lining vodootporni tuš", "N°1 maskara – 010 Black")).toBe(false);
  });
});
