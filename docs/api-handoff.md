# API status

The frontend targets the rewritten API at `/api/v2`. Only `lib/api/` knows its shape. For local work, run either the mock (`npm run mock:api`) or the real API on port 4000, not both.

## Agreed and implemented by the API
- Server-side reCAPTCHA v2 verification, using `recaptchaToken` in the comment body.
- Rate limits, comment validation and error responses as `{ error: { code, message } }`.
- CORS allowlist through `CORS_ORIGINS`.

## Still needed before launch
1. **Production API:** a host and base URL, set here as `NEXT_PUBLIC_API_URL`.
2. **Production origin:** this site's domain, added to the API's `CORS_ORIGINS`.
3. **reCAPTCHA pair:** a production site key here and its matching secret in the API.
4. **Article scanner:** the API's `own-scraper` branch must reach its `develop` with or before this frontend change, because article pages now require `excerpt`.
5. **Excerpt markup:** some excerpts contain literal HTML. The frontend strips it as a safeguard, but the API should strip it at ingestion.

## Nice to have
- An admin way to hide comments. It currently needs SQL.
- A dedicated sitemap list. The sitemap currently walks up to 10 pages of 50 articles.
- Story grouping. When several outlets cover the same event, the feed shows one card per article. The scanner could cluster them (for example by title similarity and publish time) and return a `storyId`, so the frontend can show one card with "3 fontes".

## Parlamento page
`/parlamento` follows the API's own contract in the backend repo, `docs/parliament-api.md`: `GET /parliament`, `/deputies/:id`, `/initiatives`, `/initiatives/:id` and `/articles?deputy=`. The mock in `mocks/parliamentFixtures.ts` uses the same shape, with the official seat map and fictional deputies, and `tests/parliament.test.ts` checks it against the schemas.

- Seats come from the official map. Which deputy sits in which chair isn't published, so a seat opens its party's bench and a deputy is picked from there. When the API fills `deputyId` on a seat, pressing the seat opens that deputy directly; no frontend change is needed.
- Photos are loaded only when a deputy's card opens.
- If the API doesn't serve `/parliament` (404), the page says the data is coming soon.
- The production API must list this site's origin in `CORS_ORIGINS`, because the deputy card, initiatives and votes load from the browser.

## Party page
`/partido/[slug]` shows the party's seats, its result in the latest legislativas (`/elections`), its leader and tabs for its deputies, initiatives (`/initiatives?party=`) and votes.

- **Votes by party:** there is no party endpoint yet, so the page reads one of the party's deputies' votes (`/deputies/:id/votes`) and keeps those with `basis` `group` or `unanimous`, the party's own position. A `GET /parties/:slug/votes` with the same items and `position` per party would be simpler and would also cover votes where the bench split.
- **Leader:** read from the deputies' `positions` ("Presidente do CHEGA", "Secretário-Geral do PCP"), so a leader who isn't a deputy (PSD now) isn't shown. A `leader: { name, title, deputyId|null }` on `/parties` would fix that.
