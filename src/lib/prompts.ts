import type { FacialAnalysis, Locale, LookProfile, Preferences } from "./schemas";

export function analysisPrompt(locale: Locale) {
  return `Analyze only the visible cosmetic characteristics in this face photo.
Return JSON with exactly these string fields: skinTone, undertone, eyeColor, hairColor, faceShape, eyeShape, lipShape.
Use neutral, respectful cosmetic language. Do not infer ethnicity, health, age, identity, personality, or any other sensitive trait.
Write values in ${locale === "hr" ? "Croatian" : "English"}.`;
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
}: {
  analysis: FacialAnalysis;
  locale: Locale;
  preferences?: Preferences;
}) {
  return `Create a concise name and 3-5 short reasons explaining a makeup look based on this visible cosmetic analysis:
${JSON.stringify(analysis)}
User preferences: ${JSON.stringify(preferences ?? {})}
Respond in ${locale === "hr" ? "Croatian" : "English"} as JSON with:
{"lookName":"string","explanation":["string"],"lookProfile":{"intensity":"soft|medium|bold","complexionFinish":"natural|matte|radiant|satin","blushFamily":"color family","bronzerFamily":"neutral|warm","eyeFamilies":["1-3 color families"],"eyelinerColor":"black|brown|plum","lipFamily":"color family","lipFinish":"matte|satin|glossy"}}.
Allowed color families: neutral, rose, peach, coral, berry, mauve, red, nude, brown, bronze, gold, champagne, taupe, plum, black.
The lookProfile must describe the makeup visibly applied in the generated look so it can be matched to real cosmetic products.
Discuss color harmony and placement only. Do not make health, ethnicity, age, or personality claims.`;
}
