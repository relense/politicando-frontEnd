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

## Agenda política (needed from the API)
The `/agenda` page and the "Próximo evento" box on the front page are built against this contract, with fictional data in `mocks/agendaFixtures.ts`. Until `GET /agenda` exists (404), the page says the calendar is coming and shows the upcoming elections from `GET /elections`; the front page leaves the box out.

### `GET /agenda?from=&kind=&district=&open=&cursor=&limit=`
- `from`: a day (`2026-11-16`); default today, Lisbon time. Only what has not ended yet.
- `kind`: one or more, comma-separated: `parliament`, `committee`, `government`, `president`, `party`, `local`, `election`, `european`, `other`.
- `district`: one of the 18 districts, `Açores` or `Madeira`, as written in `place.district`.
- `open=true`: only events the public can attend.
- Soonest first; `limit` up to 100, default 50.

```jsonc
{
  "items": [
    {
      "id": "ar-2026-11-17-plenario",          // stable across imports, used in links and calendar files
      "kind": "parliament",
      "title": "Debate quinzenal com o Primeiro-Ministro",
      "summary": "…",                          // or null; plain text
      "start": "2026-11-17T15:00:00+00:00",    // with offset; or a bare day "2026-11-21" when allDay
      "end": "2026-11-17T18:00:00+00:00",      // or null; for allDay the last day, inclusive
      "allDay": false,
      "status": "scheduled",                   // scheduled | cancelled | postponed (keep cancelled ones a while, so people see it)
      "place": { "name": "Assembleia da República", "address": "…", "municipality": "Lisboa", "district": "Lisboa", "lat": 38.71, "lng": -9.15 }, // or null
      "online": { "url": "https://…", "label": "Canal Parlamento" },       // live stream, or null
      "attend": { "open": true, "how": "Galerias abertas, com documento de identificação.", "url": null }, // url: registration page
      "organizer": "Assembleia da República",  // or null
      "parties": [{ "slug": "ps", "acronym": "PS" }],
      "sourceUrl": "https://…",                // where the date comes from
      "featured": true                          // editors' pick for the front page box
    }
  ],
  "nextCursor": null,
  "total": 4                                    // matching the filters, same on every page
}
```

### Suggested sources
- **Parlamento:** the plenary and committee agenda in the Assembleia da República's open data (and the "Agenda parlamentar" page): plenary sessions, hearings, votes, the Estado da Nação and Orçamento debates. Kinds `parliament` and `committee`.
- **Governo:** the weekly Conselho de Ministros and ministers' public agenda on portugal.gov.pt. Kind `government`.
- **Presidente:** the public agenda on presidencia.pt. Kind `president`.
- **Partidos:** congresses, national councils, rallies and campaign events, from the parties' sites and news, curated by the editors. Kind `party`.
- **Autarquias:** public meetings of câmaras and assembleias municipais (the law gives the public time to speak), from the municipalities' sites, starting with the largest. Kind `local`.
- **Eleições:** election days once the decree is out, and campaign periods. Kind `election`.
- **União Europeia:** plenaries of the European Parliament and European Council summits. Kind `european`.

## Feedback (needed from the API)
`/feedback` and `/feedback/correcoes` are built against this contract, with fictional data in `mocks/feedbackFixtures.ts`. Until it exists, the form shows an error with the contact email, and the side boxes and the log say they are coming.

### `POST /feedback` (multipart/form-data)
Fields: `kind` (`error | idea | broken | other`; ideas normally go to the ideas board below, `idea` only arrives here while that board is missing), `message` (required, up to 1000 characters), `page` (the section the reader chose, e.g. "Percursos"), `url`, `correction` (what is right), `source` (where it can be confirmed), `email` (only when the reader wants an answer), `screenshot` (PNG or JPG, up to 5 MB), `recaptchaToken`.
- Answer `201 { "id": … }`.
- Errors as usual, with these codes the page explains: `rate_limited`, `captcha_failed`, `file_too_large`, `unsupported_file`, `validation_failed`.
- Privacy, as the privacy page now says: the email is used only to answer that message and deleted when it is closed; screenshots are deleted after 90 days; the public log never says who asked.
- The editors need a way to read, answer and close messages (admin), and to turn an `error` into a correction in the log.

### `GET /feedback/summary`
```jsonc
{
  "stats": { "responseDays": 2, "correctionsThisMonth": 38 },  // median days to a first answer over the last 90 days (null with too few)
  "corrections": [ /* the latest 4, as below */ ]
}
```

### `GET /corrections?cursor=&limit=`
`{ "items": [{ "id": 4, "status": "fixed", "date": "2026-11-16", "area": "Percursos", "title": "…", "url": "/percursos" }], "nextCursor": null }`, newest first. `status`: `fixed | checking | rejected`. `url`: a path on this site or a full link, or null.

## Ideas board (needed from the API: three additions to the forum)
`/feedback/ideias` is a Reddit-style board on top of the forum (`docs/forums-api.md` in the backend), with fictional ideas in `mocks/forumFixtures.ts`. Until the board exists the page says it opens soon, and "Tenho uma ideia" on `/feedback` falls back to `POST /feedback`. `/forum/ideias` redirects to it, and the forum index leaves it out of its list.

1. **A board `ideias`** (name "Ideias", no acronym) in `GET /forums`, outside the party ordering. Threads and replies as on any board, with the same reCAPTCHA, limits and reports.
2. **Upvotes:** `POST /forums/threads/:id/vote`, no body, answers `200 { "score": 42 }`. One vote per reader per thread (by a hash of the IP, like poster IDs); a repeat vote returns the same score without an error. Rate-limited per IP (429 `rate_limited`), no captcha. `score` on each thread in `GET /forums/:board/threads` and `GET /forums/threads/:id`. On `ideias`, `sort=top` orders by `score` (replies only as a tie-break). The page also remembers the vote on the device.
3. **A status set by the team:** `status: null | "reviewing" | "planned" | "in_progress" | "done" | "declined"` on threads, plus an optional `answer` (a short note from the team) and `answeredAt`, set in admin on `ideias` threads. Optional filter `GET /forums/ideias/threads?status=planned`. Ideas that are `done` or `declined` take no more votes on the page.

`/feedback` shows the top five from `GET /forums/ideias/threads?sort=top&limit=5`, so the old `ideas` in the summary and `POST /ideas/:id/vote` are no longer needed.

## Blog: most read (needed from the API)
The blog shows "Mais lidos" (a toggle and a box) as soon as the API counts reads; until then both stay hidden.
- `POST /editorial/:slug/view`: no body, sent by the browser once per post per visit (`navigator.sendBeacon`, so it may arrive as `text/plain`). Count it; keep nothing about the reader beyond what rate limiting needs. Answer 204. Unknown slugs 404 (ignored).
- `GET /editorial?sort=popular&days=7&limit=`: posts ordered by reads in the last `days`, each with `views` (that count). Posts with no reads may be left out.

## Account newsletter (needed from the API)
The profile has a "Newsletter semanal" switch (`components/account/AccountEmail.tsx`, mocked in `mocks/accountFixtures.ts`). Until `/me` says the account's newsletter state, the switch stays hidden and the profile links to `/newsletter` instead.
- **`newsletter` on the user** (`GET /me`, `PUT /me/email`, register and login answers): `"none" | "pending" | "confirmed"`, for the account's email. `pending`: asked for, waiting for the email's confirmation. A subscription made earlier with the public form for the same address counts once that address is confirmed on the account.
- **`PUT /me/newsletter`**, no body: subscribes the account's email. 204. Confirmed email: `confirmed` at once, no new email. Unconfirmed: `pending`, confirmed together with the email (resend the confirmation if needed). No email: 409 `email_required`.
- **`DELETE /me/newsletter`**: unsubscribes that address (as the email's unsubscribe link does). 204, also when not subscribed.

## Agenda: party hearings with their times (needed from the API)
Party hearings come as one `allDay` item per day, with the times only in `summary` ("15h00 - Conselho de Redação…"), and later hearings that day are dropped (19 Nov 2026: the PS's 16:00 one is missing). Send **one item per hearing**: `start` with its time (`2026-11-19T15:00:00+00:00`), `allDay: false`, `summary` only who is heard. The site then shows "15:00" with no change.
