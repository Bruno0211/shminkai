# shminkAI

A mobile-first Croatian/English web app that analyzes visible facial features and uses Gemini image editing to create a personalized makeup look.

## Local setup

Requires Node.js 22+.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add a Google Gemini API key as `GEMINI_API_KEY`.
4. Run `npm run dev` and open `http://localhost:3000`.

The default models are `gemini-3.8-flash` for structured analysis and copy, and `gemini-2.5-flash-image` for makeup image editing. Override either model in `.env.local` if availability differs for your Google AI account.

Product recommendations use Gemini with Google Search grounding, limited to the shops listed in `src/lib/retailers.ts`. Set `GEMINI_SEARCH_MODEL` to use a different model for product search.

## Privacy and validation

- Photos are accepted only as JPEG, PNG, or WebP up to 8 MB.
- MIME type and file signature are validated server-side.
- Images are sent directly to Gemini and are not written to disk or a database by this app.
- API keys remain server-side; never prefix them with `NEXT_PUBLIC_`.
- Results are held in browser session storage and disappear when the session is cleared.

Confirm Google’s current data-processing and retention terms before a production launch, and provide the appropriate privacy notice for the regions where the app is offered.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit and API tests mock Gemini and do not require an API key. End-to-end tests mock the generation route.
