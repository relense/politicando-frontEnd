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
