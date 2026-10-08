import { describe, expect, it } from "vitest";
import { imagePrompt } from "./prompts";

const baseArguments: Parameters<typeof imagePrompt>[0] = {
  analysis: {
    skinTone: "medium",
    undertone: "warm",
    eyeColor: "brown",
    hairColor: "brown",
    faceShape: "oval",
    eyeShape: "almond",
    lipShape: "full",
  },
  mode: "random",
  lookProfile: {
    intensity: "soft",
    complexionDepth: "medium",
    complexionUndertone: "warm",
    complexionFinish: "radiant",
    blushFamily: "peach",
    bronzerFamily: "warm",
    eyeFamilies: ["bronze"],
    eyelinerColor: "brown",
    mascaraColor: "brown",
    browColor: "brown",
    lipFamily: "nude",
    lipFinish: "satin",
  },
};

describe("imagePrompt", () => {
  it("requires open eyes in the source to remain open", () => {
    const prompt = imagePrompt(baseArguments);

    expect(prompt).toContain("eyes are open in the source photo");
    expect(prompt).toContain("must remain open");
  });

  it("preserves facial hair when no change is requested", () => {
    const randomPrompt = imagePrompt(baseArguments);
    const unrelatedWishesPrompt = imagePrompt({
      ...baseArguments,
      mode: "custom",
      preferences: { wishes: "Use a soft rose lip color." },
    });

    expect(randomPrompt).toContain("Preserve all existing facial hair exactly");
    expect(randomPrompt).toContain("Do not remove");
    expect(unrelatedWishesPrompt).toContain(
      "Unrelated wishes do not authorize any facial-hair change",
    );
  });
});
