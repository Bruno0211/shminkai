import type {
  FacialAnalysis,
  Locale,
  LookProfile,
  OutfitProfile,
  Preferences,
} from "./schemas";

export function analysisPrompt(locale: Locale) {
  return `Analyze only the visible cosmetic characteristics in this face photo.
Return JSON with exactly these string fields: skinTone, undertone, eyeColor, hairColor, faceShape, eyeShape, lipShape.
Use neutral, respectful cosmetic language. Do not infer ethnicity, health, age, identity, personality, or any other sensitive trait.
Write values in ${locale === "hr" ? "Croatian" : "English"}.`;
}

export function outfitPrompt(locale: Locale) {
  return `Describe only the clothing and accessories in this photo so makeup can be matched to the outfit.
Ignore any person: do not describe faces, bodies, skin, or the wearer, and do not infer anything about who wears it.
Return JSON with:
- hasClothing: false if the photo shows no clothing or accessories.
- summary: a short outfit description of at most 8 words, e.g. "navy satin dress with gold earrings".
- colors: 1-4 dominant garment colors, most prominent first.
- pattern: solid, print, stripes, checks, textured, or mixed.
- formality: casual, smart, evening, or formal.
- metals: gold, silver, mixed, or none (from jewelry, buttons, buckles, or metallic fabric).
Write summary and colors in ${locale === "hr" ? "Croatian" : "English"}.`;
}

export function imagePrompt({
  analysis,
  preferences,
  mode,
  lookProfile,
}: {
  analysis: FacialAnalysis;
  preferences?: Preferences;
  mode: "random" | "custom";
  lookProfile: LookProfile;
}) {
  const direction =
    mode === "random"
      ? "Choose a cohesive, contemporary makeup direction that naturally complements the visible features."
      : `Follow these user preferences when safe and visually coherent: ${JSON.stringify(preferences ?? {})}.`;

  return `Edit the supplied portrait into a photorealistic makeup result.
Preserve the same person's identity, expression, pose, face geometry, hair, clothing, lighting, background, and image framing.
Apply makeup only: complexion finish, blush/bronzer, brows, eyeshadow, eyeliner/mascara, and lip color.
Do not reshape facial features, alter skin tone, add accessories, retouch skin texture excessively, or change hair.
Visible cosmetic analysis: ${JSON.stringify(analysis)}.
${direction}
Apply this exact makeup color and finish plan: ${JSON.stringify(lookProfile)}.
The result should look achievable with real makeup, polished but not like a beauty filter.
Return only the edited image.`;
}

export function explanationPrompt({
  analysis,
  locale,
  preferences,
  outfit,
}: {
  analysis: FacialAnalysis;
  locale: Locale;
  preferences?: Preferences;
  outfit?: OutfitProfile;
}) {
  const outfitDirection = outfit
    ? `
Outfit the makeup must complement: ${JSON.stringify(outfit)}
Harmonize the makeup with the outfit's colors, formality, and metal tones. Explicit user preferences take priority; use the outfit to decide anything the user left open.
Include one reason explaining how the makeup works with the outfit.`
    : "";
  return `Create a concise name and 3-5 short reasons explaining a makeup look based on this visible cosmetic analysis:
${JSON.stringify(analysis)}
User preferences: ${JSON.stringify(preferences ?? {})}${outfitDirection}
Respond in ${locale === "hr" ? "Croatian" : "English"} as JSON with:
{"lookName":"string","explanation":["string"],"lookProfile":{"intensity":"soft|medium|bold","complexionFinish":"natural|matte|radiant|satin","blushFamily":"color family","bronzerFamily":"neutral|warm","eyeFamilies":["1-3 color families"],"eyelinerColor":"black|brown|plum","lipFamily":"color family","lipFinish":"matte|satin|glossy"}}.
Allowed color families: neutral, rose, peach, coral, berry, mauve, red, nude, brown, bronze, gold, champagne, taupe, plum, black.
The lookProfile must describe the makeup visibly applied in the generated look so it can be matched to real cosmetic products.
Discuss color harmony and placement only. Do not make health, ethnicity, age, or personality claims.`;
}

export function productSearchPrompt({
  query,
  shadeGuidance,
  locale,
  domains,
}: {
  query: string;
  shadeGuidance: string;
  locale: Locale;
  domains: readonly string[];
}) {
  const sites = domains.map((domain) => `site:${domain}`).join(" OR ");
  return `Find up to 2 makeup products currently sold in Croatia that best match: "${query}" (shade/color direction: ${shadeGuidance}).
Search ONLY these shops, using queries such as: ${query} (${sites})
Rules:
- Every url must be a direct product page on one of these domains: ${domains.join(", ")}. Never link to search pages, category pages, or any other website.
- Only include a product if you found its product page in the search results. Do not guess or construct URLs.
- Prefer products whose shade or color matches the requested direction; name the matching shade when there is one.
- For foundation or concealer, do not pick a skin shade; recommend the formula only.
Respond with only JSON, no prose, in this shape:
{"products":[{"brand":"...","name":"...","shade":"...","url":"https://...","matchReason":"..."}]}
Write matchReason (one short sentence) in ${locale === "hr" ? "Croatian" : "English"}. Return {"products":[]} if nothing suitable is found.`;
}
