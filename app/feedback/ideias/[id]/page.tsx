import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { NameAvatar } from "@/components/Avatar";
import { CardShare } from "@/components/CardShare";
import { RelativeTime } from "@/components/RelativeTime";
import { FollowButton } from "@/components/account/FollowButton";
import { ForumText } from "@/components/forum/ForumText";
import { IdeaVote } from "@/components/forum/IdeaVote";
import { IdeaStatusBadge } from "@/components/ideas/IdeaBits";
import { IdeaDiscussion } from "@/components/ideas/IdeaDiscussion";
import { ideaClosed, ideaPath } from "@/components/ideas/IdeaRow";
import { IdeaTimeline } from "@/components/ideas/IdeaTimeline";
import { ApiError } from "@/lib/api/client";
import { getSimilarIdeas, getThread, IDEA_STATUS_LABELS, IDEAS_BOARD, posterName, type ThreadDetail } from "@/lib/api/forums";
import { formatLongDate } from "@/lib/format";
import { ideaTimeline } from "@/lib/ideas";

type Props = { params: Promise<{ id: string }> };

/** Read once per request, for the page and its metadata; comments most voted first, as the page opens. */
const loadIdea = cache(async (param: string): Promise<ThreadDetail> => {
  if (!/^[1-9]\d{0,9}$/.test(param)) notFound();
  try {
    return await getThread(Number(param), { sort: "top" });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { thread } = await loadIdea((await params).id);
  return {
    title: `${thread.title} · Ideias`,
    description: thread.body.replace(/\s+/g, " ").slice(0, 155),
    alternates: { canonical: ideaPath(thread.id) },
    // Written by readers, not by us: kept out of search results, links still followed.
    robots: { index: false, follow: true },
  };
}

const box = "rounded-2xl border border-line p-4";
const heading = "font-mono text-[11px] font-bold uppercase tracking-widest";
const day = (value: string) => formatLongDate(value)?.replace(/ de \d{4}$/, "") ?? "";

export default async function IdeaPage({ params }: Props) {
  await connection();
  const detail = await loadIdea((await params).id);
  const { thread } = detail;
  // Any other thread lives on its own board.
  if (thread.board !== IDEAS_BOARD) redirect(`/forum/${thread.board}/${thread.id}`);
  const similar = await getSimilarIdeas(thread.id).catch(() => []);
  const steps = ideaTimeline(thread);
  const author = posterName(thread.nickname);

  return (
    <div data-wide className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <nav aria-label="Caminho" className="mb-4 font-mono text-xs">
          <Link href="/feedback" className="text-link underline">
            Feedback
          </Link>
          <span aria-hidden="true" className="text-muted">
            {" "}
            ›{" "}
          </span>
          <Link href="/feedback" className="text-link underline">
            Ideias
          </Link>
          <span aria-hidden="true" className="text-muted">
            {" "}
            ›{" "}
          </span>
          <span aria-current="page" className="text-muted">
            #{thread.id}
          </span>
        </nav>

        <article aria-labelledby="ideia" className={`${box} flex gap-4`}>
          <IdeaVote id={thread.id} title={thread.title} score={thread.score ?? 0} closed={ideaClosed(thread)} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
              <NameAvatar name={author} size="sm" />
              <span>
                <b className="text-ink">{author}</b> · proposta a {day(thread.createdAt)}
                {thread.area && <> · {thread.area}</>}
              </span>
              <IdeaStatusBadge status={thread.status} />
            </p>
            <h1 id="ideia" className="mt-2 break-words font-serif text-3xl font-bold leading-tight">
              {thread.title}
            </h1>
            <div className="mt-3 leading-relaxed">
              <ForumText body={thread.body} anchors={new Map()} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FollowButton kind="thread" id={thread.id} />
              <CardShare
                path={ideaPath(thread.id)}
                title={thread.title}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line px-3 font-mono text-xs font-bold hover:bg-surface"
              />
            </div>
          </div>
        </article>

        {thread.duplicateOf && (
          <p className={`${box} mt-4 text-sm`}>
            <span className={`${heading} block text-muted`}>Duplicada</span>
            Já foi sugerida:{" "}
            <Link href={ideaPath(thread.duplicateOf.id)} className="font-bold text-link underline">
              {thread.duplicateOf.title}
            </Link>
            . Os votos desta ideia contam lá.
          </p>
        )}

        {thread.answer && (
          <section
            aria-labelledby="resposta-equipa"
            className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--stage-approved)_45%,transparent)] bg-[color-mix(in_srgb,var(--stage-approved)_7%,transparent)] p-4"
          >
            <h2 id="resposta-equipa" className={`${heading} flex flex-wrap items-center gap-x-2 text-[var(--stage-approved)]`}>
              Resposta da equipa · fixada
              {thread.answeredAt && (
                <span className="font-normal normal-case tracking-normal text-muted">
                  <RelativeTime value={thread.answeredAt} />
                </span>
              )}
            </h2>
            <div className="mt-2 leading-relaxed">
              <ForumText body={thread.answer} anchors={new Map()} />
            </div>
          </section>
        )}

        {steps.length > 0 && (
          <div className="my-6">
            <IdeaTimeline steps={steps} />
          </div>
        )}

        <div className={steps.length > 0 ? "" : "mt-6"}>
          <IdeaDiscussion initial={detail} locked={thread.locked} />
        </div>
      </div>

      <aside aria-label="Sobre esta ideia" className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <section aria-labelledby="numeros" className={box}>
          <h2 id="numeros" className={`${heading} text-muted`}>
            Sobre esta ideia
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div className="flex flex-col-reverse">
              <dt className="font-mono text-[11px] text-muted">{thread.score === 1 ? "voto" : "votos"}</dt>
              <dd className="font-serif text-3xl font-bold">{thread.score ?? 0}</dd>
            </div>
            {thread.followers !== null && (
              <div className="flex flex-col-reverse">
                <dt className="font-mono text-[11px] text-muted">a seguir</dt>
                <dd className="font-serif text-3xl font-bold">{thread.followers}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-muted">Quem vota ou segue recebe uma notificação quando o estado muda.</p>
        </section>

        {similar.length > 0 && (
          <section aria-labelledby="parecidas" className={box}>
            <h2 id="parecidas" className={`${heading} text-muted`}>
              Ideias parecidas
            </h2>
            <ul className="mt-2 flex flex-col">
              {similar.map((idea) => (
                <li key={idea.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 border-b border-line py-2 last:border-b-0">
                  <span className="font-mono text-xs font-bold">
                    <span aria-hidden="true">▲ </span>
                    {idea.score ?? 0}
                    <span className="sr-only"> votos</span>
                  </span>
                  <span className="min-w-0">
                    <Link href={ideaPath(idea.id)} className="text-sm font-bold leading-snug hover:underline">
                      {idea.title}
                    </Link>
                    {idea.status && (
                      <span className="block font-mono text-[11px]" style={{ color: IDEA_STATUS_LABELS[idea.status].color }}>
                        {IDEA_STATUS_LABELS[idea.status].label}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="outra" className={box}>
          <h2 id="outra" className="font-bold">
            Tens outra ideia?
          </h2>
          <p className="mt-1 text-sm text-muted">Procura primeiro no quadro: pode já existir.</p>
          <Link
            href="/feedback"
            className="mt-3 inline-flex min-h-9 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
          >
            Ir ao quadro de ideias
          </Link>
        </section>
      </aside>
    </div>
  );
}
