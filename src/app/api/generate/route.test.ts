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

vi.mock("@/lib/gemini", () => ({
  analyzeFace: vi.fn(async () => analysis),
  generateMakeupImage: vi.fn(async () => "data:image/png;base64,AAAA"),
  explainLook: vi.fn(async () => ({
    lookName: "Soft bronze",
    explanation: ["Warm bronze complements the visible undertone."],
  })),
}));

import { POST } from "./route";

function validRequest(metadata: unknown = { mode: "random", locale: "en" }) {
  const form = new FormData();
  form.set(
    "photo",
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], "face.jpg", {
      type: "image/jpeg",
    }),
  );
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
    });
  });

  it("rejects invalid metadata", async () => {
    const response = await POST(validRequest({ mode: "unknown", locale: "en" }));
    expect(response.status).toBe(400);
  });
});
