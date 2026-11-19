import { http, HttpResponse } from "msw";
import type { ApiEditorialDetailInput } from "@/lib/api/schemas";
import { adminFail, audit, requireAdmin, type MockAdmin } from "./adminState";
import { editorialPosts } from "./editorialFixtures";

/*
 * Writing the blog (editorial-api.md "Writing"). Posts live in `editorialPosts`, as the public routes read them; what
 * only the admin sees (draft or published, who wrote it, the media link as typed) is kept here, by post id.
 */

const API = "*/api/v2";

type Meta = { status: "draft" | "published"; authorId: number | null; mediaUrl: string | null; updatedAt: string };

const meta = new Map<number, Meta>(
  editorialPosts.map((post) => [
    post.id,
    { status: "published", authorId: null, mediaUrl: post.media?.url ?? null, updatedAt: post.publishedAt ?? "2026-11-01T09:00:00.000Z" },
  ]),
);

/** What readers can see: drafts never leave the admin. */
export const publicPosts = () => editorialPosts.filter((post) => meta.get(post.id)?.status !== "draft");

const RANK = { author: 0, moderator: 1, admin: 2 } as const;
const moderates = (admin: MockAdmin) => RANK[admin.role] >= RANK.moderator;

const present = (post: ApiEditorialDetailInput, withBody = true) => {
  const own = meta.get(post.id)!;
  const { body, readingMinutes: _minutes, ...rest } = post;
  void _minutes;
  return {
    ...rest,
    authorName: post.authorName ?? "Redação Politicando",
    subtitle: post.subtitle ?? null,
    coverImageUrl: post.coverImageUrl ?? null,
    publishedAt: post.publishedAt ?? null,
    status: own.status,
    authorId: own.authorId,
    mediaUrl: own.mediaUrl,
    updatedAt: own.updatedAt,
    ...(withBody ? { body } : {}),
  };
};

const slugify = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "artigo";

const MEDIA = /^https:\/\/(open\.spotify\.com|(www\.)?youtube\.com|youtu\.be|(www\.)?vimeo\.com|soundcloud\.com|podcasts\.apple\.com)\//;
const embedOf = (url: string) => {
  const provider = url.includes("spotify")
    ? "spotify"
    : url.includes("youtu")
      ? "youtube"
      : url.includes("vimeo")
        ? "vimeo"
        : url.includes("soundcloud")
          ? "soundcloud"
          : "apple_podcasts";
  return { provider, url, embedUrl: provider === "spotify" ? url.replace("open.spotify.com/", "open.spotify.com/embed/") : url };
};

type Input = {
  title: string;
  subtitle: string | null;
  slug: string | null;
  kind: string;
  body: string;
  authorName: string | null;
  coverImageUrl: string | null;
  mediaUrl: string | null;
  tags: string[];
};

/** The checks the API makes, enough for the editor's error messages. */
function fieldsOf(
  input: Input | null,
  admin: MockAdmin,
  id: number | null,
): Response | (Partial<ApiEditorialDetailInput> & { mediaUrl: string | null }) {
  if (!input || typeof input.title !== "string" || input.title.trim().length < 3 || !Array.isArray(input.tags))
    return adminFail(400, "validation_failed", "body/title: Too small");
  if (input.mediaUrl && !MEDIA.test(input.mediaUrl))
    return adminFail(400, "unsupported_media", "Use a YouTube, Vimeo, Spotify, SoundCloud or Apple Podcasts link");
  const existing = editorialPosts.find((post) => post.id === id);
  let slug = input.slug ?? existing?.slug ?? slugify(input.title);
  if (input.slug && editorialPosts.some((post) => post.slug === slug && post.id !== id))
    return adminFail(409, "slug_taken", "Another post uses that slug");
  if (!input.slug && !existing) {
    const base = slug;
    let n = 2;
    while (editorialPosts.some((post) => post.slug === slug)) slug = `${base}-${n++}`;
  }
  return {
    title: input.title.trim(),
    subtitle: input.subtitle,
    slug,
    kind: input.kind,
    body: input.body,
    authorName: input.authorName ?? existing?.authorName ?? admin.name,
    coverImageUrl: input.coverImageUrl,
    media: input.mediaUrl ? embedOf(input.mediaUrl) : null,
    mediaUrl: input.mediaUrl,
    tags: [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()))],
  };
}

function load(id: number, admin: MockAdmin): ApiEditorialDetailInput | Response {
  const post = editorialPosts.find((item) => item.id === id);
  if (!post) return adminFail(404, "not_found", "Post not found");
  if (meta.get(id)!.authorId !== admin.id && !moderates(admin))
    return adminFail(403, "forbidden", "Only its author or a moderator can change it");
  return post;
}

export const editorialAdminHandlers = [
  http.get(`${API}/admin/editorial`, ({ request }) => {
    const admin = requireAdmin(request);
    if (admin instanceof Response) return admin;
    const items = editorialPosts
      .filter((post) => moderates(admin) || meta.get(post.id)!.authorId === admin.id)
      .sort((a, b) => meta.get(b.id)!.updatedAt.localeCompare(meta.get(a.id)!.updatedAt))
      .map((post) => present(post, false));
    return HttpResponse.json({ items });
  }),
  http.get(`${API}/admin/editorial/:id`, ({ params, request }) => {
    const admin = requireAdmin(request);
    if (admin instanceof Response) return admin;
    const post = load(Number(params.id), admin);
    return post instanceof Response ? post : HttpResponse.json(present(post));
  }),
  http.post(`${API}/admin/editorial`, async ({ request }) => {
    const admin = requireAdmin(request);
    if (admin instanceof Response) return admin;
    const fields = fieldsOf((await request.json().catch(() => null)) as Input | null, admin, null);
    if (fields instanceof Response) return fields;
    const id = Math.max(0, ...editorialPosts.map((post) => post.id)) + 1;
    const { mediaUrl, ...rest } = fields;
    const post = { id, featured: false, publishedAt: undefined, readingMinutes: 1, ...rest } as unknown as ApiEditorialDetailInput;
    editorialPosts.unshift(post);
    meta.set(id, { status: "draft", authorId: admin.id, mediaUrl, updatedAt: new Date().toISOString() });
    audit(admin, "editorial.create", "editorial", id);
    return HttpResponse.json(present(post), { status: 201 });
  }),
  http.put(`${API}/admin/editorial/:id`, async ({ params, request }) => {
    const admin = requireAdmin(request);
    if (admin instanceof Response) return admin;
    const post = load(Number(params.id), admin);
    if (post instanceof Response) return post;
    const fields = fieldsOf((await request.json().catch(() => null)) as Input | null, admin, post.id);
    if (fields instanceof Response) return fields;
    const { mediaUrl, ...rest } = fields;
    Object.assign(post, rest);
    meta.set(post.id, { ...meta.get(post.id)!, mediaUrl, updatedAt: new Date().toISOString() });
    audit(admin, "editorial.update", "editorial", post.id);
    return HttpResponse.json(present(post));
  }),
  http.post(`${API}/admin/editorial/:id/:action`, ({ params, request }) => {
    const action = String(params.action);
    if (!["publish", "unpublish", "feature", "unfeature"].includes(action)) return adminFail(404, "not_found");
    const admin = requireAdmin(request, action.endsWith("feature") ? "moderator" : "author");
    if (admin instanceof Response) return admin;
    const post = load(Number(params.id), admin);
    if (post instanceof Response) return post;
    const own = meta.get(post.id)!;
    if (action === "feature" && own.status !== "published") return adminFail(400, "not_published", "Publish it first");
    if (action === "publish" && post.body.trim() === "") return adminFail(400, "empty_body", "Write something first");
    if (action === "publish") {
      own.status = "published";
      post.publishedAt ??= new Date().toISOString();
    }
    if (action === "unpublish") {
      own.status = "draft";
      post.featured = false;
    }
    if (action === "feature") post.featured = true;
    if (action === "unfeature") post.featured = false;
    own.updatedAt = new Date().toISOString();
    audit(admin, `editorial.${action}`, "editorial", post.id);
    return HttpResponse.json(present(post));
  }),
  http.delete(`${API}/admin/editorial/:id`, ({ params, request }) => {
    const admin = requireAdmin(request);
    if (admin instanceof Response) return admin;
    const post = load(Number(params.id), admin);
    if (post instanceof Response) return post;
    if (meta.get(post.id)!.status === "published") return adminFail(400, "published", "Unpublish it first");
    editorialPosts.splice(editorialPosts.indexOf(post), 1);
    meta.delete(post.id);
    audit(admin, "editorial.delete", "editorial", post.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
