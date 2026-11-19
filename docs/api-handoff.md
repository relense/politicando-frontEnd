# API status

The frontend targets the API at `/api/v2`. Its contracts live in the backend repo (`../politicando-backEnd/docs/*.md`);
only `lib/api/` knows their shape. For local work, run either the mock (`npm run mock:api`) or the real API on port
4000, not both. Every page keeps a calm "em breve" or empty state when an endpoint answers 404 or fails.

## Live (checked against production, 19 Nov 2026)

- **Launch:** production API, CORS for this site, the reCAPTCHA pair, the article scanner with excerpts.
- **Stories** (`/stories`, `/stories/:id`, `/today`), with `recentSourceCount` on `/today`.
- **Parliament** (`docs/parliament-api.md`), **elections** (`docs/elections-api.md`), **parties** with `leader`, and
  **party votes** (`GET /parties/:slug/votes`).
- **Agenda** (`GET /agenda`), with timed hearings as one item each.
- **Feedback** (`POST /feedback`, `GET /feedback/summary`) and the **corrections log** (`GET /corrections`).
- **Ideas board:** the `ideias` forum board, its votes and team statuses.
- **Blog:** "Mais lidos" (`GET /editorial?sort=popular`, `POST /editorial/:slug/view`).
- **Accounts:** optional email, password recovery and the newsletter switch (`docs/accounts-api.md`), plus the
  newsletter link pages (`docs/newsletter-api.md`).
- **Podcast:** `GET /podcast/latest` and `GET /podcast` (the episode list on the blog's Podcasts filter).

## Being deployed

- **A photo per outlet:** `imageUrl` on each `sources[]` item of `/stories`, `/stories/:id` and `/today` (null when
  that article has none). The frontend already reads it (`storyPhoto` in `lib/api/stories.ts`): a card then shows its
  headline outlet's own photo, and borrows another outlet's, credited, only when it has none.
- **Blog covers from the studio,** at `https://api.politicando.pt/media/<hash>.png|jpg`. Covers are drawn with a plain
  `<img>` (`components/ArticleImage.tsx`), not `next/image`, so no `remotePatterns` entry is needed; add one only if
  that changes.

## Open, not confirmed

These were asked before and may already be done; check with the backend before building on them.

- **Excerpt markup:** some excerpts contained literal HTML. The frontend strips it as a safeguard; the API should strip
  it at import.
- **Hiding comments in admin,** without SQL.
- **A dedicated sitemap list,** instead of walking pages of articles.
