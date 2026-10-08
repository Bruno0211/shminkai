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

## 6. Photo capture

- Offer two explicit photo sources in both generation workflows:
  - Open the device camera and take a live, front-facing photo inside the application.
  - Upload an existing photo from the device gallery or filesystem.
- Replace the original single upload area with these two source buttons; do not present them as an additional duplicate control.
- Use the browser MediaDevices API for the live camera preview.
- Present the live preview in a focused pop-up camera frame with a pink `#e10174` border that matches the application.
- Prefer the front-facing camera, show a face-positioning guide, and let the user capture or cancel.
- Stop all camera tracks immediately after capture, cancellation, or component cleanup.
- Explain camera permission errors and retain gallery upload as the fallback.
- Live camera access requires HTTPS in production or localhost during development.

## 7. Random-look workflow

- Accept JPEG, PNG, and WebP files up to 8 MB.
- Show preview and retry controls.
- Require explicit consent before AI processing.
- Generate a look informed by skin tone, undertone, eye color, hair color, face shape, eye shape, and lip shape.

## 8. Custom-look workflow

- Include the same photo, validation, preview, and consent flow as random generation.
- Let users provide occasion, intensity, preferred colors, finish, and free-text wishes.
- Validate and constrain all preferences before they are sent to AI.
- Adapt user wishes to the person’s visible facial characteristics.
- Offer an optional outfit photo (gallery upload only, no camera) with the same type and size validation as the face photo, plus preview and remove controls. The outfit option is available in the custom workflow only.
- Analyze only the clothing and accessories in the outfit photo (colors, pattern, formality, metal tones); ignore any person shown. Run outfit analysis in parallel with face analysis.
- Use the outfit to shape the makeup plan and include one explanation point about how the makeup complements it. Explicit user preferences take priority over the outfit.
- The outfit never changes the generated image's clothing and is never sent to the image model or the product recommendation endpoint.
- If the outfit photo shows no clothing or its analysis fails, generate the look without it.
- Show a short "Matched to your outfit" summary on the result.
- Downscale face and outfit photos in the browser before upload (longest edge 1600 px) to keep requests small.

## 9. Generated result

- Preserve the photographed person’s identity, expression, pose, face geometry, hair, clothing, lighting, background, and framing.
- Apply realistic makeup only; do not reshape facial features, change skin tone, or apply excessive beauty filtering.
- Show the generated image, look name, download action, restart action, and overall explanation.
- Show an action that opens product recommendations matched to the generated makeup.
- Results are session-only and are not persisted to an account or database.
- After a successful generation, clear the previously selected/captured photo and consent state. Starting another look must always return to an empty photo-source choice and must never analyze the previous photo implicitly.

## 10. Product recommendations

- Generate a structured makeup profile describing the look's color families, finishes, and intensity, and use it as the shared plan for both image generation and product matching.
- Load recommendations on demand when the user opens the product list; cache them only for the current page session.
- While live product discovery is running, show one accessible animated progress bar and replace it with results when the search completes.
- Discover real products with Gemini grounded Google Search, restricted to the allowed Croatian retailers configured in `src/lib/retailers.ts` (currently notino.hr, douglas.hr, dm.hr, mueller.hr).
- Run one search per full-look category in parallel: complexion, blush, bronzer, eyeshadow, eyeliner, mascara, brows, and lips. Return up to two products per category.
- Derive every search query from the validated structured makeup profile.
- Keep only HTTPS product-page URLs on an allowed retailer domain; discard links that return 404/410 or redirect off the allowed shops or to a homepage.
- If a category's search fails, times out, or yields no verified product, fall back to a Google search link restricted to the allowed retailers with `site:` operators.
- Use a low thinking level for product searches so the full list loads in roughly 15 seconds.
- Open product and search links safely in a new tab.
- For foundation and concealer, recommend only the formula or finish and instruct the user to choose their own shade; do not estimate an exact complexion shade from the photo.
- Show the search category, shade/color guidance, market, and a concise reason why the search matches the look.
- Support Croatian and English product-list UI and matching explanations.
- State that product prices and availability can change.
- Send only the structured makeup profile to the recommendation endpoint, never the face photo or generated image.

## 11. AI integration

- Use Google Gemini server-side; API credentials must never be exposed to the browser.
- Use `gemini-3.8-flash` by default for visible-feature analysis and structured explanatory copy.
- Use a configurable Gemini image model for image editing.
- Validate AI inputs and structured outputs with Zod.
- AI prompts must avoid inferring ethnicity, health, age, identity, personality, or other sensitive traits.
- Return safe user-facing errors without exposing provider internals or credentials.

## 12. Privacy and security

- Process photos ephemerally and never write them to the application filesystem or database.
- Validate declared MIME type, file size, and image magic bytes server-side.
- Keep secrets in environment variables and git-ignored local environment files.
- Present AI output as creative cosmetic inspiration, not professional or medical advice.
- Confirm provider retention terms and applicable regional privacy requirements before production launch.

## 13. Testing and quality

- Unit-test schemas, localization, and structured AI response parsing.
- Mock Gemini in automated API tests.
- Cover mobile home, dialogs, language switching, workflow selection, live-camera entry and permission errors, photo upload, generation success/error states, result display, product recommendations, safe outbound product links, and recommendation retry states with Playwright.
- Required checks: ESLint, TypeScript, unit/API tests, production build, and core mobile end-to-end flows.

## 14. Out of scope for the current version

- Step-by-step makeup application instructions beyond generated explanations
- Accounts
- Saving or syncing previous looks
