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
{"lookName":"string","explanation":["string"],"lookProfile":{"intensity":"soft|medium|bold","complexionDepth":"fair|light|medium|tan|deep","complexionUndertone":"cool|neutral|warm|olive","complexionFinish":"natural|matte|radiant|satin","blushFamily":"color family","bronzerFamily":"neutral|warm","eyeFamilies":["1-3 color families"],"eyelinerColor":"black|brown|plum","mascaraColor":"black|brown|plum","browColor":"black|brown|taupe|auburn|blonde","lipFamily":"color family","lipFinish":"matte|satin|glossy"}}.
Allowed color families: neutral, rose, peach, coral, berry, mauve, red, nude, brown, bronze, gold, champagne, taupe, plum, black.
The lookProfile must describe every visible makeup shade and finish, including a broad complexion depth and undertone, so it can be matched to real cosmetic products.
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
  return `You MUST use Google Search. Search: ${query} (${sites})
From the search results, pick up to 8 single-product pages that best match "${query}" (shade/color direction: ${shadeGuidance}).
Rules:
- Only use results from these shops: ${domains.join(", ")}. Skip category, brand, search, and article pages.
- For each product, "source" must be the search result link copied EXACTLY as you received it. Do not rewrite, shorten, or construct URLs.
- "name" must be the product name as shown in that search result, including the shade when there is one.
- Recommend a specific shade for every product, including foundation. Use the requested broad complexion depth and undertone for foundation; do not claim an exact skin-color measurement.
- Rank products from strongest to weakest match and assign each a matchScore from 0 to 100.
Respond with only JSON, no prose, in this shape:
{"products":[{"brand":"...","name":"...","shade":"...","source":"https://...","matchScore":95,"matchReason":"..."}]}
Write matchReason (one short sentence) in ${locale === "hr" ? "Croatian" : "English"}. Return {"products":[]} if nothing suitable is found.`;
}
