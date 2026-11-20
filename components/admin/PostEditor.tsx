"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import {
  canModerate,
  changePost,
  createPost,
  deletePost,
  getPost,
  POST_KINDS,
  savePost,
  type AdminPost,
  type PostAction,
  type PostInput,
  type PostKind,
} from "@/lib/api/admin";
import { KIND_LABELS } from "@/lib/editorial";
import { formatDateTime, formatTime } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { useMe } from "./AdminShell";
import { buttonClass, ConfirmButton, ErrorNote, inputClass, useExpiry, useExpiryOf } from "./ui";

/** The form's fields, as typed: tags as one comma-separated line. */
type Fields = {
  title: string;
  subtitle: string;
  slug: string;
  kind: PostKind;
  body: string;
  authorName: string;
  coverImageUrl: string;
  mediaUrl: string;
  tags: string;
};

const EMPTY: Fields = {
  title: "",
  subtitle: "",
  slug: "",
  kind: "article",
  body: "",
  authorName: "",
  coverImageUrl: "",
  mediaUrl: "",
  tags: "",
};

const fieldsOf = (post: AdminPost | null): Fields =>
  post
    ? {
        title: post.title,
        subtitle: post.subtitle ?? "",
        slug: post.slug,
        kind: post.kind,
        body: post.body,
        authorName: post.authorName,
        coverImageUrl: post.coverImageUrl ?? "",
        mediaUrl: post.mediaUrl ?? "",
        tags: post.tags.join(", "),
      }
    : EMPTY;

const same = (a: Fields, b: Fields) => (Object.keys(a) as (keyof Fields)[]).every((key) => a[key] === b[key]);

export const tagsOf = (line: string) => [
  ...new Set(
    line
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  ),
];

const blank = (value: string) => value.trim() || null;

export const inputOf = (fields: Fields): PostInput => ({
  title: fields.title.trim(),
  subtitle: blank(fields.subtitle),
  slug: blank(fields.slug),
  kind: fields.kind,
  body: fields.body,
  authorName: blank(fields.authorName),
  coverImageUrl: blank(fields.coverImageUrl),
  mediaUrl: blank(fields.mediaUrl),
  tags: tagsOf(fields.tags),
});

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** The API's own rules (editorialInputSchema), checked first so the answer is in words next to the field. */
export function problemsOf(fields: Fields): Partial<Record<keyof Fields, string>> {
  const problems: Partial<Record<keyof Fields, string>> = {};
  const title = fields.title.trim();
  if (title.length < 3) problems.title = "O título precisa de pelo menos 3 letras.";
  else if (title.length > 200) problems.title = "O título pode ter até 200 caracteres.";
  if (fields.subtitle.trim().length > 300) problems.subtitle = "O subtítulo pode ter até 300 caracteres.";
  if (fields.authorName.trim().length > 100) problems.authorName = "A assinatura pode ter até 100 caracteres.";
  const slug = fields.slug.trim();
  if (slug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80))
    problems.slug = "Só letras minúsculas sem acentos, números e hífenes (por exemplo, o-que-muda-no-irs), até 80.";
  if (fields.coverImageUrl.trim() && !isHttps(fields.coverImageUrl.trim())) problems.coverImageUrl = "Tem de ser um link https://.";
  if (fields.mediaUrl.trim() && !isHttps(fields.mediaUrl.trim())) problems.mediaUrl = "Tem de ser um link https://.";
  const tags = tagsOf(fields.tags);
  if (tags.length > 10) problems.tags = "Até 10 etiquetas.";
  else if (tags.some((tag) => tag.length > 40)) problems.tags = "Cada etiqueta pode ter até 40 caracteres.";
  return problems;
}

/* Unsaved changes are kept in this browser too, so a closed tab or a lost connection doesn't lose the writing. */

const backupKey = (id: number | null) => `politicando:admin-rascunho:${id ?? "novo"}`;
type Backup = { fields: Fields; at: string };

function readBackup(id: number | null): Backup | null {
  try {
    const raw = window.localStorage.getItem(backupKey(id));
    if (!raw) return null;
    const backup = JSON.parse(raw) as Backup;
    return backup && typeof backup.at === "string" && backup.fields && typeof backup.fields.body === "string"
      ? { ...backup, fields: { ...EMPTY, ...backup.fields } }
      : null;
  } catch {
    return null;
  }
}

function writeBackup(id: number | null, fields: Fields | null) {
  try {
    if (fields) window.localStorage.setItem(backupKey(id), JSON.stringify({ fields, at: new Date().toISOString() } satisfies Backup));
    else window.localStorage.removeItem(backupKey(id));
  } catch {
    // Full or blocked storage: the editor still works, without the safety copy.
  }
}

/** Writes a new post (`id` null) or edits one. */
export function PostEditor({ id }: { id: number | null }) {
  const post = useQuery({ queryKey: ["admin-post", id], queryFn: () => getPost(id!), enabled: id !== null });
  useExpiryOf(post.error);

  if (id !== null && post.isPending) return <p className="text-muted">A carregar o artigo…</p>;
  if (id !== null && post.isError)
    return (
      <div className="space-y-3">
        {post.error instanceof ApiError && post.error.status === 404 ? (
          <p role="alert">Este artigo não existe ou foi apagado.</p>
        ) : (
          <ErrorNote error={post.error} />
        )}
        <BackLink />
      </div>
    );
  return <EditorForm key={post.data?.id ?? "novo"} post={post.data ?? null} />;
}

function BackLink() {
  return (
    <Link href="/admin/artigos" className="font-mono text-xs font-bold hover:underline">
      ← Artigos
    </Link>
  );
}

type Step = "save" | PostAction;
const STEP_DONE: Record<Step, string> = {
  save: "Guardado.",
  publish: "Publicado. Pode demorar até um minuto a aparecer no site.",
  unpublish: "Voltou a rascunho: já não aparece no site.",
  feature: "Em destaque na página inicial.",
  unfeature: "Saiu dos destaques.",
};

function EditorForm({ post }: { post: AdminPost | null }) {
  const id = useId();
  const me = useMe();
  const router = useRouter();
  const client = useQueryClient();
  const expiry = useExpiry();
  const [current, setCurrent] = useState(post);
  const [saved, setSaved] = useState(() => fieldsOf(post));
  const [fields, setFields] = useState(saved);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // A copy left from an earlier visit that differs from what the API has: offered back, never applied unasked.
  // Read on the first render: the editor only renders in the browser, once the session is known.
  const [backup, setBackup] = useState<Backup | null>(() => {
    const found = readBackup(post?.id ?? null);
    return found && !same(found.fields, fieldsOf(post)) ? found : null;
  });

  const postId = current?.id ?? null;
  const dirty = !same(fields, saved);
  const problems = problemsOf(fields);
  const valid = Object.keys(problems).length === 0;
  const published = current?.status === "published";
  const moderator = canModerate(me);

  useEffect(() => {
    if (backup) return; // Don't overwrite the copy on offer before the author chooses.
    writeBackup(postId, dirty ? fields : null);
  }, [fields, dirty, postId, backup]);

  const run = useMutation({
    mutationFn: async ({ step, submitted }: { step: Step; submitted: Fields }) => {
      let latest = current;
      if (step === "save" || !latest || !same(submitted, saved)) {
        latest = latest ? await savePost(latest.id, inputOf(submitted)) : await createPost(inputOf(submitted));
        // Kept at once: if publishing fails next, a retry publishes this post instead of creating another.
        const kept = latest;
        setCurrent(kept);
        setSaved(fieldsOf(kept));
        client.setQueryData(["admin-post", kept.id], kept);
      }
      if (step !== "save") latest = await changePost(latest.id, step);
      return latest;
    },
    onSuccess: (latest, { step, submitted }) => {
      const now = fieldsOf(latest);
      client.setQueryData(["admin-post", latest.id], latest);
      client.invalidateQueries({ queryKey: ["admin-posts"] });
      setCurrent(latest);
      setSaved(now);
      // The API tidies some fields (tags in lower case, the address made from the title): show its version, unless
      // the author kept typing meanwhile.
      setFields((typed) => (same(typed, submitted) ? now : typed));
      setDone(STEP_DONE[step]);
      if (!post) {
        writeBackup(null, null);
        router.replace(`/admin/artigos/${latest.id}`);
      }
    },
    onError: (error) => {
      setDone(null);
      expiry(error);
    },
  });

  const remove = useMutation({
    mutationFn: () => deletePost(current!.id),
    onSuccess: () => {
      writeBackup(postId, null);
      client.invalidateQueries({ queryKey: ["admin-posts"] });
      router.push("/admin/artigos");
    },
    onError: expiry,
  });

  const busy = run.isPending || remove.isPending;

  function go(step: Step) {
    setChecked(true);
    setDone(null);
    if (!valid) return;
    run.mutate({ step, submitted: fields });
  }

  const set =
    <K extends keyof Fields>(key: K) =>
    (value: Fields[K]) => {
      setDone(null);
      setFields((previous) => ({ ...previous, [key]: value }));
    };

  const problem = (key: keyof Fields) => (checked ? problems[key] : undefined);
  const words = fields.body.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

  return (
    <section aria-labelledby={`${id}-title`}>
      <BackLink />
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3">
        <h1 id={`${id}-title`} className="text-2xl font-bold">
          {post ? "Editar artigo" : "Novo artigo"}
        </h1>
        {current && (
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${published ? "border-ink" : "border-dashed border-line text-muted"}`}
          >
            {published ? "Publicado" : "Rascunho"}
          </span>
        )}
        {current?.featured && <span className="rounded-full bg-[var(--marker)] px-2 py-0.5 font-mono text-[11px]">Em destaque</span>}
      </div>

      {backup && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--accent)] p-4 text-sm">
          <p className="min-w-0 flex-1">Há alterações deste artigo que não chegaram a ser guardadas, de {formatDateTime(backup.at)}.</p>
          <button
            type="button"
            className={buttonClass("ink")}
            onClick={() => {
              setFields(backup.fields);
              setBackup(null);
            }}
          >
            Recuperar
          </button>
          <button
            type="button"
            className={buttonClass()}
            onClick={() => {
              writeBackup(post?.id ?? null, null);
              setBackup(null);
            }}
          >
            Descartar
          </button>
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          go("save");
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="min-w-0 space-y-4">
          <Field label="Título" error={problem("title")}>
            {(props) => (
              <input
                {...props}
                value={fields.title}
                onChange={(event) => set("title")(event.target.value)}
                className={`${inputClass} text-lg font-bold`}
              />
            )}
          </Field>
          <Field label="Subtítulo" hint="Opcional. Uma frase que aparece por baixo do título." error={problem("subtitle")}>
            {(props) => (
              <input {...props} value={fields.subtitle} onChange={(event) => set("subtitle")(event.target.value)} className={inputClass} />
            )}
          </Field>

          <div>
            <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
              <span id={`${id}-body`} className="font-mono text-xs font-bold">
                Texto
              </span>
              <div role="group" aria-label="Ver o texto" className="flex gap-1">
                {(
                  [
                    ["write", "Escrever"],
                    ["preview", "Pré-visualizar"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                    className={`min-h-8 rounded-full border px-3 font-mono text-xs font-bold ${tab === value ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {tab === "write" ? (
              <>
                <textarea
                  aria-labelledby={`${id}-body`}
                  aria-describedby={`${id}-body-hint`}
                  value={fields.body}
                  onChange={(event) => set("body")(event.target.value)}
                  rows={22}
                  spellCheck
                  lang="pt-PT"
                  className={`${inputClass} min-h-[24rem] resize-y font-mono text-[13px] leading-relaxed`}
                  placeholder={
                    "## Um subtítulo\n\nUm parágrafo com **negrito**, *itálico* e [um link](https://www.parlamento.pt).\n\n- Uma lista\n- Com dois pontos"
                  }
                />
                <p id={`${id}-body-hint`} className="mt-1 font-mono text-[11px] text-muted">
                  Markdown: ## subtítulo · **negrito** · *itálico* · [texto](link) · - lista · &gt; citação · tabelas com | · {words}{" "}
                  {words === 1 ? "palavra" : "palavras"}, {Math.max(1, Math.ceil(words / 200))} min de leitura
                </p>
              </>
            ) : (
              <Preview fields={fields} byline={fields.authorName.trim() || current?.authorName || me.name} />
            )}
          </div>
        </div>

        <aside className="space-y-4" aria-label="Detalhes do artigo">
          <Actions
            current={current}
            dirty={dirty}
            busy={busy}
            moderator={moderator}
            onStep={go}
            onDelete={() => remove.mutate()}
            status={
              run.isPending
                ? "A guardar…"
                : done
                  ? done
                  : dirty
                    ? "Alterações por guardar."
                    : current
                      ? `Guardado às ${formatTime(current.updatedAt)}.`
                      : "Ainda não guardado."
            }
          />
          <ErrorNote error={run.error ?? remove.error} />
          {checked && !valid && (
            <p role="alert" className="text-sm text-danger">
              Corrige os campos assinalados antes de guardar.
            </p>
          )}

          <Field label="Tipo">
            {(props) => (
              <select
                {...props}
                value={fields.kind}
                onChange={(event) => set("kind")(event.target.value as PostKind)}
                className={inputClass}
              >
                {POST_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="Assinatura"
            hint={`O nome que aparece como autor. Em branco: ${current?.authorName ?? me.name}.`}
            error={problem("authorName")}
          >
            {(props) => (
              <input
                {...props}
                value={fields.authorName}
                placeholder={current?.authorName ?? me.name}
                onChange={(event) => set("authorName")(event.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            label="Imagem de capa"
            hint="Opcional. Um link https:// para uma imagem já publicada noutro sítio."
            error={problem("coverImageUrl")}
          >
            {(props) => (
              <input
                {...props}
                type="url"
                inputMode="url"
                value={fields.coverImageUrl}
                placeholder="https://…"
                onChange={(event) => set("coverImageUrl")(event.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            label="Áudio ou vídeo"
            hint="Opcional. Um link do YouTube, Vimeo, Spotify, SoundCloud ou Apple Podcasts: aparece no lugar da capa."
            error={problem("mediaUrl")}
          >
            {(props) => (
              <input
                {...props}
                type="url"
                inputMode="url"
                value={fields.mediaUrl}
                placeholder="https://open.spotify.com/episode/…"
                onChange={(event) => set("mediaUrl")(event.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Etiquetas" hint="Separadas por vírgulas, até 10. Por exemplo: orçamento, parlamento." error={problem("tags")}>
            {(props) => (
              <input {...props} value={fields.tags} onChange={(event) => set("tags")(event.target.value)} className={inputClass} />
            )}
          </Field>
          <Field
            label="Endereço"
            hint={
              published
                ? "Mudar o endereço de um artigo publicado parte os links já partilhados."
                : "Opcional. Em branco, é feito a partir do título."
            }
            error={problem("slug")}
          >
            {(props) => (
              <div className="flex items-center rounded-lg border border-line bg-paper focus-within:outline focus-within:outline-2 focus-within:outline-ink">
                <span className="shrink-0 pl-3 font-mono text-[11px] text-muted">/editorial/</span>
                <input
                  {...props}
                  value={fields.slug}
                  placeholder="o-que-muda-no-irs"
                  onChange={(event) => set("slug")(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-sm outline-none"
                />
              </div>
            )}
          </Field>
        </aside>
      </form>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-xs font-bold">
        {label}
      </label>
      {children({ id, "aria-describedby": described, ...(error ? { "aria-invalid": true as const } : {}) })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Actions({
  current,
  dirty,
  busy,
  moderator,
  status,
  onStep,
  onDelete,
}: {
  current: AdminPost | null;
  dirty: boolean;
  busy: boolean;
  moderator: boolean;
  status: string;
  onStep: (step: Step) => void;
  onDelete: () => void;
}) {
  const published = current?.status === "published";
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4 lg:sticky lg:top-4">
      <p role="status" className="font-mono text-[11px] text-muted">
        {status}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || (!dirty && current !== null)} className={buttonClass(published ? "ink" : "plain")}>
          {published ? "Guardar alterações" : "Guardar rascunho"}
        </button>
        {!published && (
          <button type="button" disabled={busy} onClick={() => onStep("publish")} className={buttonClass("ink")}>
            Publicar
          </button>
        )}
      </div>
      {current && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {published && (
            <a href={`/editorial/${encodeURIComponent(current.slug)}`} target="_blank" rel="noopener" className={buttonClass()}>
              Ver no site<span className="sr-only"> (abre num novo separador)</span>
            </a>
          )}
          {published && moderator && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStep(current.featured ? "unfeature" : "feature")}
              className={buttonClass()}
            >
              {current.featured ? "Tirar do destaque" : "Pôr em destaque"}
            </button>
          )}
          {published && (
            <button type="button" disabled={busy} onClick={() => onStep("unpublish")} className={buttonClass()}>
              Despublicar
            </button>
          )}
          {!published && <ConfirmButton label="Apagar rascunho" confirmLabel="Apagar de vez" disabled={busy} onConfirm={onDelete} />}
        </div>
      )}
      {current?.publishedAt && (
        <p className="font-mono text-[11px] text-muted">Publicado pela primeira vez {formatDateTime(current.publishedAt)}.</p>
      )}
    </div>
  );
}

/** Close to the post page: the same body styles, so what the author sees is what readers get. */
function Preview({ fields, byline }: { fields: Fields; byline: string }) {
  const cover = isHttps(fields.coverImageUrl.trim()) ? fields.coverImageUrl.trim() : null;
  return (
    <div aria-label="Pré-visualização" role="region" className="rounded-2xl border border-line p-5 sm:p-7">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{KIND_LABELS[fields.kind]}</p>
      <p className="mt-2 text-3xl font-bold leading-tight">{fields.title.trim() || "Sem título"}</p>
      {fields.subtitle.trim() && <p className="mt-2 text-lg text-muted">{fields.subtitle.trim()}</p>}
      <p className="mt-3 text-sm font-bold">{byline}</p>
      {fields.kind === "opinion" && (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-2 text-sm text-muted">
          Texto de opinião: vincula apenas {byline}, não o Politicando.
        </p>
      )}
      {fields.mediaUrl.trim() ? (
        <p className="mt-5 rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          O leitor do áudio ou vídeo aparece aqui no site: {fields.mediaUrl.trim()}
        </p>
      ) : (
        cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="mt-5 aspect-video w-full rounded-xl bg-surface object-contain" />
        )
      )}
      <div className="post-body mt-6">
        {fields.body.trim() ? renderMarkdown(fields.body) : <p className="text-muted">Ainda não há texto.</p>}
      </div>
    </div>
  );
}
