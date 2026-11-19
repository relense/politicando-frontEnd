import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ThreadView } from "@/components/forum/ThreadView";
import { ApiError } from "@/lib/api/client";
import { getBoards, getThread, IDEAS_BOARD, VOTES_BOARD, type ThreadDetail } from "@/lib/api/forums";

type Props = { params: Promise<{ board: string; id: string }> };

async function loadThread(param: string): Promise<ThreadDetail> {
  if (!/^[1-9]\d{0,9}$/.test(param)) notFound();
  try {
    return await getThread(Number(param));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { thread } = await loadThread((await params).id);
  return {
    title: `${thread.title} · Fórum`,
    description: thread.body.replace(/\s+/g, " ").slice(0, 155),
    alternates: { canonical: `/forum/${thread.board}/${thread.id}` },
    // Written by readers, not by us: kept out of search results, links still followed.
    robots: { index: false, follow: true },
  };
}

export default async function ThreadPage({ params }: Props) {
  await connection();
  const { board, id } = await params;
  const detail = await loadThread(id);
  const { thread } = detail;
  // An old or edited link: send it to the board the thread is really on.
  if (thread.board === IDEAS_BOARD) redirect(`/feedback/ideias/${thread.id}`);
  if (thread.board !== board) redirect(`/forum/${thread.board}/${thread.id}`);
  const boardInfo = (await getBoards().catch(() => [])).find((item) => item.board === thread.board);
  const boardLabel = boardInfo?.acronym ?? boardInfo?.name ?? thread.board;

  return (
    // A vote's thread has a column beside it.
    <div data-wide={thread.board === VOTES_BOARD ? true : undefined}>
      <nav aria-label="Caminho" className="mb-4 font-mono text-sm">
        <Link href="/forum" className="text-link underline">
          Fórum
        </Link>
        <span aria-hidden="true" className="text-muted">
          {" "}
          ›{" "}
        </span>
        <Link href={`/forum/${thread.board}`} className="text-link underline">
          {boardLabel}
        </Link>
      </nav>
      <ThreadView key={thread.id} initial={detail} />
    </div>
  );
}
