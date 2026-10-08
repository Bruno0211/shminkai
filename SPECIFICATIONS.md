# kreirAI Product Specification

Last updated: 2026-10-08

This file is the canonical product specification. Update it whenever a requirement is added, changed, or removed.

## 1. Product vision

kreirAI is a mobile-first web application that creates personalized makeup looks from a face photograph. AI analyzes visible cosmetic characteristics—including skin tone and undertone, eye and hair color, face shape, eye shape, and lip shape—and generates a realistic makeup look designed for those features.

The key differentiator is feature-aware personalization rather than applying a generic makeup filter.

## 2. Supported languages

- Croatian is the default language.
- English is available through a persistent HR/EN language switcher.
- AI-generated look names, explanations, and makeup-area details use the selected language.

## 3. Visual design

- Background: `#121214`
- Primary accent and CTA: `#e10174`
- Secondary highlights: `#ff4d94`
- The design is mobile-first, responsive on larger screens, and accounts for mobile safe areas.
- Interactive controls use accessible touch targets and visible keyboard focus states.

## 4. Home page

- Show two overlapping before/after makeup cards.
- Carousel advances automatically every five seconds and also supports manual slide selection.
- Show the primary “kreirAI svoj look” / “creAIte your look” CTA.
- Show an information button that opens an explanation of the application.
- State that uploaded photos are not stored.

## 5. Workflow selection

- Show two stacked cards: “Surprise me” and “My wishes.”
- The active card is visually prominent; the passive card sits darkened behind it.
- Users can switch by swiping the card or selecting the synchronized side/bottom option list.
- Each card has an information dialog, representative visual, and continuation CTA.

## 6. Random-look workflow

- Let the user take a front-facing face photo or upload one from the gallery.
- Accept JPEG, PNG, and WebP files up to 8 MB.
- Show preview and retry controls.
- Require explicit consent before AI processing.
- Generate a look informed by skin tone, undertone, eye color, hair color, face shape, eye shape, and lip shape.

## 7. Custom-look workflow

- Include the same photo, validation, preview, and consent flow as random generation.
- Let users provide occasion, intensity, preferred colors, finish, and free-text wishes.
- Validate and constrain all preferences before they are sent to AI.
- Adapt user wishes to the person’s visible facial characteristics.

## 8. Generated result

- Preserve the photographed person’s identity, expression, pose, face geometry, hair, clothing, lighting, background, and framing.
- Apply realistic makeup only; do not reshape facial features, change skin tone, or apply excessive beauty filtering.
- Show the generated image, look name, download action, restart action, and overall explanation.
- Results are session-only and are not persisted to an account or database.

## 9. AI integration

- Use Google Gemini server-side; API credentials must never be exposed to the browser.
- Use `gemini-3.8-flash` by default for visible-feature analysis and structured explanatory copy.
- Use a configurable Gemini image model for image editing.
- Validate AI inputs and structured outputs with Zod.
- AI prompts must avoid inferring ethnicity, health, age, identity, personality, or other sensitive traits.
- Return safe user-facing errors without exposing provider internals or credentials.

## 10. Privacy and security

- Process photos ephemerally and never write them to the application filesystem or database.
- Validate declared MIME type, file size, and image magic bytes server-side.
- Keep secrets in environment variables and git-ignored local environment files.
- Present AI output as creative cosmetic inspiration, not professional or medical advice.
- Confirm provider retention terms and applicable regional privacy requirements before production launch.

## 11. Testing and quality

- Unit-test schemas, localization, and structured AI response parsing.
- Mock Gemini in automated API tests.
- Cover mobile home, dialogs, language switching, workflow selection, photo upload, generation success/error states, and result display with Playwright.
- Required checks: ESLint, TypeScript, unit/API tests, production build, and core mobile end-to-end flows.

## 12. Out of scope for the current version

- Product-search recommendations
- Step-by-step makeup application instructions beyond generated explanations
- Accounts
- Saving or syncing previous looks
