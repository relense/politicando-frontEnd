import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { IdeaVote } from "@/components/forum/IdeaVote";
import { ThreadView } from "@/components/forum/ThreadView";
import { ApiError } from "@/lib/api/client";
import { getThread, IDEA_STATUS_LABELS, IDEAS_BOARD, type ThreadDetail } from "@/lib/api/forums";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

async function loadIdea(param: string): Promise<ThreadDetail> {
  if (!/^[1-9]\d{0,9}$/.test(param)) notFound();
  try {
    return await getThread(Number(param));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { thread } = await loadIdea((await params).id);
  return {
    title: `${thread.title} · Ideias`,
    description: thread.body.replace(/\s+/g, " ").slice(0, 155),
    alternates: { canonical: `/feedback/ideias/${thread.id}` },
    // Written by readers, not by us: kept out of search results, links still followed.
    robots: { index: false, follow: true },
  };
}

export default async function IdeaPage({ params }: Props) {
  await connection();
  const detail = await loadIdea((await params).id);
  const { thread } = detail;
  // Any other thread lives on its own board.
  if (thread.board !== IDEAS_BOARD) redirect(`/forum/${thread.board}/${thread.id}`);
  const status = thread.status ? IDEA_STATUS_LABELS[thread.status] : null;

  return (
    <div>
      <nav aria-label="Caminho" className="mb-4 font-mono text-sm">
        <Link href="/feedback" className="text-link underline">
          Feedback
        </Link>
        <span aria-hidden="true" className="text-muted">
          {" "}
          ›{" "}
        </span>
        <Link href="/feedback/ideias" className="text-link underline">
          Ideias
        </Link>
      </nav>

      <section aria-label="Votos e estado" className="mb-4 flex flex-wrap items-start gap-4 rounded-2xl border border-line p-4">
        <IdeaVote
          id={thread.id}
          title={thread.title}
          score={thread.score ?? 0}
          closed={thread.status === "done" || thread.status === "declined"}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted">Estado</p>
          <p className="font-bold" style={status ? { color: status.color } : undefined}>
            {status?.label ?? "Ainda por analisar"}
          </p>
          {thread.answer ? (
            <blockquote className="mt-2 border-l-2 border-ink pl-3">
              <p className="leading-relaxed">{thread.answer}</p>
              <footer className="mt-1 font-mono text-xs text-muted">
                Resposta da equipa{thread.answeredAt && <> · {formatDate(thread.answeredAt)}</>}
              </footer>
            </blockquote>
          ) : (
            <p className="mt-1 text-sm text-muted">Lemos todas as ideias. Quando decidirmos, a resposta aparece aqui.</p>
          )}
        </div>
      </section>

      <ThreadView key={thread.id} initial={detail} />
    </div>
  );
}
