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

- **The Budget after the vote:** built on the backend's `budget-after-vote` branch, not deployed yet; contract in the
  backend's `docs/budget-api.md`, "After the vote". `afterVote` on `GET /budget/:year/summary` and each year of
  `GET /budget` (the team's dated notes with their source), `implementation` on each proposal (`applied | not_applied |
  disputed`, null when unknown) and `?implementation=not_applied`. The frontend reads them (`lib/api/budget.ts`): a
  «Depois da votação» box on the year's page, a badge in the list and a section on the proposal's page. Until then, nothing shows.

- **Who was elected to each local body:** built on the backend's `local-elected-names` branch, not deployed yet;
  contract in the backend's `docs/places-api.md`, "Who was elected". From CNE's official map (Mapa Oficial n.º 2-B/2025),
  as elected on 12 Oct 2025 (no later substitutions). In `GET /places/:key`: `council.organs[].seats[].members`
  (`[{ name, position, role: "presidente" | null, localOfficialId }]`, list order; absent = no names loaded; `[]` = the
  map's names don't add up to the seats), `council.source` (`{ name, url, asOf }`, `asOf` the latest rectification), and
  on a parish `juntaPresident` (`{ name, list, label, parties, election }`). The frontend reads them already
  (`lib/api/places.ts`); without them the page keeps the seats only.

## Open, not confirmed

These were asked before and may already be done; check with the backend before building on them.

- **Excerpt markup:** some excerpts contained literal HTML. The frontend strips it as a safeguard; the API should strip
  it at import.
- **Hiding comments in admin,** without SQL.
- **A dedicated sitemap list,** instead of walking pages of articles.

## Asked: admin «readers» (24 Nov 2026)

The frontend has built `/admin/utilizadores` (list) and `/admin/utilizadores/:id` (one reader) against mocks of
exactly this (`mocks/adminReaders.ts`). Same conventions as the other admin routes: under `/admin`, the admin session cookie, JSON, errors
`{ error: { code, message } }`, cursors as elsewhere.

**Who:** role `admin` only (not `moderator` or `author`): 403 `forbidden` otherwise.
**Never sent:** password hashes, IPs, session tokens.
**Audit:** opening a reader (§3) and every action (§5) go into the existing audit log (§6).

### 1. List: `GET /admin/readers`

Query (all optional): `q` (username or email, contains, case-insensitive), `email=confirmed|unconfirmed|none`,
`status=active|suspended|banned|deleted`, `active=7|30` (seen in the last N days),
`sort=newest|oldest|last_seen|most_active` (default newest), `cursor`, `limit` (default 50, max 100).

```json
{
  "items": [
    {
      "id": 812,
      "username": "rita_m",
      "email": "rita@example.com",
      "emailConfirmed": true,
      "newsletter": false,
      "createdAt": "2026-11-02T10:14:00.000Z",
      "lastSeenAt": "2026-11-23T21:40:00.000Z",
      "status": "active",
      "suspendedUntil": null,
      "signupFrom": "/orcamento/2027/proposta/25391",
      "counts": { "comments": 14, "forumPosts": 3, "importa": 22, "follows": 5, "saved": 9, "predictions": 4, "reportsMade": 1, "reportsAgainst": 0 }
    }
  ],
  "nextCursor": "c50",
  "total": 1342
}
```
- `email`: null when they gave none. `lastSeenAt`: the last authenticated request (daily precision is fine).
- `signupFrom`: the site page they signed up from, or null. **New:** the frontend will send it as
  `signupFrom` (a path starting with `/`, max 300 chars) in the `POST /auth/register` body. Store it, ignore it if invalid.
- `status`: `active | suspended | banned | deleted` (deleted: kept as a row only if you soft-delete; otherwise omit them).

### 2. Totals: `GET /admin/readers/stats`

```json
{ "total": 1342, "newToday": 12, "newThisWeek": 87, "active7d": 410, "active30d": 760, "withEmail": 690, "emailConfirmed": 540, "suspended": 3, "banned": 2,
  "signupsByDay": [{ "date": "2026-11-23", "count": 12 }] }
```
`signupsByDay`: the last 30 days, Lisbon days, oldest first, zero days included.

### 3. One reader: `GET /admin/readers/:id`

The list item's fields, plus:
```json
{
  "...": "every field of a list item",
  "moderation": [
    { "at": "2026-11-20T09:00:00.000Z", "action": "comment_removed", "by": { "id": 2, "name": "Equipa" }, "reason": "insulto", "until": null }
  ]
}
```
`moderation[].action`: `comment_removed | post_removed | suspended | unsuspended | banned | unbanned | content_removed`. 404 `not_found`.

### 4. What they did: `GET /admin/readers/:id/activity?cursor=&kind=`

Newest first, one timeline across everything. `kind` (optional, comma list) filters by the kinds below.
```json
{
  "items": [
    { "at": "2026-11-23T21:40:00.000Z", "kind": "comment", "text": "Concordo com a proposta…", "removed": false,
      "target": { "type": "article", "id": 51234, "title": "Parlamento aprova…" } },
    { "at": "2026-11-23T20:10:00.000Z", "kind": "follow", "text": null, "removed": false,
      "target": { "type": "budget_proposal", "id": 25391, "title": "Artigo 91.º", "year": 2027 } }
  ],
  "nextCursor": null
}
```
- `kind`: `comment | forum_thread | forum_post | importa | vote | follow | unfollow | save | prediction | report | feedback | read`.
  - `vote`: an article's up/down vote (`text`: `"up"` or `"down"`). `report`: `text` is the reason.
  - `read`: **only if** you already keep reads per account. If you don't, leave it out; we won't add tracking for it.
- `target`: where it happened, so the page can link to it: `type` is `article | story | thread | initiative | budget_proposal | editorial`,
  with `id`, `title` (null when unknown), plus `year` for budget proposals, `board` for threads, `slug` for editorial posts.
  A comment or reply points at the article, story or post it's on; a forum reply at its thread. Null when there's none (feedback).
- `text`: the comment or post body (plain text, at most 300 chars), or null.

### 5. Actions (each audited, each returns the reader as in §3)

- `POST /admin/readers/:id/suspend` `{ "until": "2026-12-01T00:00:00.000Z", "reason": "…" }`: can't log in or take part until then.
- `POST /admin/readers/:id/unsuspend` `{ "reason": "…" }`
- `POST /admin/readers/:id/ban` `{ "reason": "…" }` / `POST /admin/readers/:id/unban` `{ "reason": "…" }`
- `POST /admin/readers/:id/remove-content` `{ "reason": "…" }`: hides all their comments and forum posts (as a moderator removal does). Returns `{ "removed": 17 }` next to the reader.
- `DELETE /admin/readers/:id` `{ "reason": "…" }`: deletes the account as `DELETE /me` does. 204.

`reason`: required, 3–500 chars (400 `invalid_request` otherwise). Suspended or banned readers get 403
`account_suspended` / `account_banned` on login and on participation routes, so the site can say so.

### 6. Audit: the existing `GET /admin/audit`

No new route: log into the audit you already have, with `entity: "reader"`, `entityId` the reader's id, and
`action` one of `reader.view | reader.suspend | reader.unsuspend | reader.ban | reader.unban | reader.remove_content | reader.delete`
(`after`: `{ "reason": "…", "until": "…" }` for actions). Please also accept `entityId` as a filter
(`GET /admin/audit?entity=reader&entityId=812`), so a reader's page can show who looked at it and what was done.

## Asked: today's news counts per outlet and party (27 Nov 2026)

The home page's box beside the news, «Hoje: N notícias»: a bar per outlet, most first, and a tab per party. The site
sends when the day starts (05:00 in Lisbon; before 05:00, the previous day's), so the API only needs `since`.

1. `GET /articles/sources?since=2026-11-27T05:00:00.000Z` → `{ "total": 214, "items": [{ "name": "publico.pt", "count": 31 }] }`:
   visible articles with `publishedAt >= since`, most first (ties by name). `total` is distinct articles. Without
   `since`, as today. The site reads `total` as the sign that `since` was understood: without it, nothing is shown.
2. `GET /articles/parties?since=…` → `{ "total": 214, "items": [{ "slug": "ps", "count": 48 }] }`: articles about each
   party (the match of `GET /articles?party=ps`), most first; one article about three parties counts for each.

Public, a 60 s cache is fine. Until both exist the box hides (or shows only the outlets).
