# Politicando

News about Portuguese political parties, with per-party feeds and anonymous threaded comments. Built with Next.js, TypeScript and Tailwind CSS.

## Run locally
```sh
cp .env.example .env.local
npm install
npm run dev:mock   # site on :3000, mock API on :4000
```
Use `npm run dev` instead to run against a real API set in `NEXT_PUBLIC_API_URL`, including `/api/v2`.

If you switch between the mock and the real API on port 4000, delete `.next` first: Next caches API responses by URL, so mock data can otherwise reappear.

## Checks
```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium   # first run only
npm run test:e2e
```

## Production settings
Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is optional. Do not set `NEXT_PUBLIC_CAPTCHA_MODE=mock`.

What is still needed from the API is listed in [docs/api-handoff.md](docs/api-handoff.md).
