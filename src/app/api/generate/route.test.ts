// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const analysis = {
  skinTone: "medium",
  undertone: "warm",
  eyeColor: "brown",
  hairColor: "brown",
  faceShape: "oval",
  eyeShape: "almond",
  lipShape: "full",
};

const lookProfile = {
  intensity: "soft",
  complexionFinish: "radiant",
  blushFamily: "peach",
  bronzerFamily: "warm",
  eyeFamilies: ["bronze", "gold"],
  eyelinerColor: "brown",
  lipFamily: "nude",
  lipFinish: "satin",
} as const;

const outfit = {
  hasClothing: true,
  summary: "navy satin dress",
  colors: ["navy"],
  pattern: "solid",
  formality: "evening",
  metals: "gold",
} as const;

vi.mock("@/lib/gemini", () => ({
  analyzeFace: vi.fn(async () => analysis),
  analyzeOutfit: vi.fn(async () => outfit),
  generateMakeupImage: vi.fn(async () => "data:image/png;base64,AAAA"),
  explainLook: vi.fn(async () => ({
    lookName: "Soft bronze",
    explanation: ["Warm bronze complements the visible undertone."],
    lookProfile,
  })),
}));

import { analyzeOutfit, explainLook, generateMakeupImage } from "@/lib/gemini";
import { POST } from "./route";

function jpeg(name: string, bytes = [0xff, 0xd8, 0xff, 0xdb]) {
  return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
}

function validRequest(
  metadata: unknown = { mode: "random", locale: "en" },
  outfitFile?: File,
) {
  const form = new FormData();
  form.set("photo", jpeg("face.jpg"));
  if (outfitFile) form.set("outfit", outfitFile);
  form.set("metadata", JSON.stringify(metadata));
  return new Request("http://localhost/api/generate", { method: "POST", body: form });
}

describe("POST /api/generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a validated generated look", async () => {
    const response = await POST(validRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      lookName: "Soft bronze",
      analysis,
      lookProfile,
    });
    expect(generateMakeupImage).toHaveBeenCalledWith(
      expect.objectContaining({ lookProfile }),
    );
  });

  it("matches the look to an uploaded outfit in custom mode", async () => {
    const response = await POST(validRequest({ mode: "custom", locale: "en" }, jpeg("outfit.jpg")));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ outfit });
    expect(explainLook).toHaveBeenCalledWith(expect.objectContaining({ outfit }));
    expect(generateMakeupImage).toHaveBeenCalledWith(
      expect.not.objectContaining({ outfit: expect.anything() }),
    );
  });

  it("ignores an outfit photo without clothing", async () => {
    vi.mocked(analyzeOutfit).mockResolvedValueOnce({
      ...outfit,
      colors: [...outfit.colors],
      hasClothing: false,
    });
    const response = await POST(validRequest({ mode: "custom", locale: "en" }, jpeg("outfit.jpg")));
    expect(response.status).toBe(200);
    expect((await response.json()).outfit).toBeUndefined();
    expect(explainLook).toHaveBeenCalledWith(expect.objectContaining({ outfit: undefined }));
  });

  it("still generates when outfit analysis fails", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    vi.mocked(analyzeOutfit).mockRejectedValueOnce(new Error("quota"));
    const response = await POST(validRequest({ mode: "custom", locale: "en" }, jpeg("outfit.jpg")));
    expect(response.status).toBe(200);
  });

  it("rejects an outfit in random mode", async () => {
    const response = await POST(validRequest({ mode: "random", locale: "en" }, jpeg("outfit.jpg")));
    expect(response.status).toBe(400);
    expect(analyzeOutfit).not.toHaveBeenCalled();
  });

  it("rejects an outfit file that is not a real image", async () => {
    const response = await POST(validRequest(
      { mode: "custom", locale: "en" },
      jpeg("outfit.jpg", [0x00, 0x01, 0x02, 0x03]),
    ));
    expect(response.status).toBe(400);
  });

  it("rejects invalid metadata", async () => {
    const response = await POST(validRequest({ mode: "unknown", locale: "en" }));
    expect(response.status).toBe(400);
  });
});
