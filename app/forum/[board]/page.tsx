import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BoardBadge } from "@/components/forum/BoardBadge";
import { IdeaVote } from "@/components/forum/IdeaVote";
import { NewThreadForm } from "@/components/forum/NewThreadForm";
import { RelativeTime } from "@/components/RelativeTime";
import { ApiError, getArticle, getInitiative } from "@/lib/api/client";
import {
  getBoards,
  getThreads,
  IDEAS_BOARD,
  VOTES_BOARD,
  posterName,
  type Board,
  type ThreadLink,
  type ThreadSort,
} from "@/lib/api/forums";
import { partyPath } from "@/lib/parties";

const PAGE_SIZE = 25;

type Props = {
  params: Promise<{ board: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SORTS: { value: ThreadSort; param: string; label: string }[] = [
  { value: "active", param: "ativas", label: "Ativas" },
  { value: "new", param: "recentes", label: "Recentes" },
  { value: "top", param: "votadas", label: "Mais votadas" },
];

// "respostas" was the old name of the top sort, when it counted replies; old links still land there.
const sortOf = (value: unknown) => SORTS.find((sort) => sort.param === (value === "respostas" ? "votadas" : value)) ?? SORTS[0]!;
const pageOf = (value: unknown) => (typeof value === "string" && /^[1-9]\d{0,3}$/.test(value) ? Number(value) : 1);
const idOf = (value: unknown) => (typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null);

function pathOf(board: string, sort: string, page = 1) {
  const query = new URLSearchParams();
  if (sort !== SORTS[0]!.param) query.set("ordem", sort);
  if (page > 1) query.set("pagina", String(page));
  return query.size > 0 ? `/forum/${board}?${query}` : `/forum/${board}`;
}

async function loadBoard(slug: string): Promise<Board> {
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) notFound();
  // Ideas have their own page, with votes.
  if (slug === IDEAS_BOARD) redirect("/feedback");
  // No forum served (404): not found. The API down is an error page (try again), never «não encontrado» for a board that exists.
  const boards = await getBoards().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  });
  const board = boards.find((item) => item.board === slug);
  if (!board) notFound();
  return board;
}

/** What the new thread will be about, when the reader came from an article or an initiative. Never breaks the page. */
async function loadLink(artigo: unknown, iniciativa: unknown): Promise<ThreadLink> {
  const articleId = idOf(artigo);
  const initiativeId = idOf(iniciativa);
  try {
    if (articleId) return { kind: "article", id: articleId, title: (await getArticle(articleId)).title };
    if (initiativeId) return { kind: "initiative", id: initiativeId, title: (await getInitiative(initiativeId)).title };
  } catch {
    // Unknown or unavailable: the thread simply isn't linked.
  }
  return null;
}

const boardTitle = (board: Board) => (board.acronym ? `Fórum do ${board.acronym}` : "Fórum geral");

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const board = await loadBoard((await params).board);
  const { ordem, pagina } = await searchParams;
  return {
    title: boardTitle(board),
    description: board.acronym
      ? `Discussões anónimas sobre o ${board.name} (${board.acronym}) e as suas propostas.`
      : "Discussões anónimas sobre política portuguesa.",
    alternates: { canonical: pathOf(board.board, sortOf(ordem).param, pageOf(pagina)) },
  };
}

export default async function BoardPage({ params, searchParams }: Props) {
  await connection();
  const board = await loadBoard((await params).board);
  // The votes board: the site opens its threads (the API answers 403 board_closed to readers).
  const closed = board.board === VOTES_BOARD;
  const { ordem, pagina, artigo, iniciativa } = await searchParams;
  const sort = sortOf(ordem);
  const page = pageOf(pagina);
  const [threads, link] = await Promise.all([
    getThreads(board.board, { sort: sort.value, page, limit: PAGE_SIZE }).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    loadLink(artigo, iniciativa),
  ]);
  const pages = Math.max(1, Math.ceil(threads.total / PAGE_SIZE));
  const tab = (active: boolean) =>
    `rounded-full border px-3 py-1 font-mono text-xs font-bold ${active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;

  return (
    <div data-wide className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <nav aria-label="Caminho" className="mb-4 font-mono text-sm">
          <Link href="/forum" className="text-link underline">
            Fórum
          </Link>
          <span aria-hidden="true" className="text-muted">
            {" "}
            ›{" "}
          </span>
          <span aria-current="page">{board.acronym ?? board.name}</span>
        </nav>
        <header className="mb-6 flex items-center gap-4">
          <BoardBadge board={board} size={56} />
          <div>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{boardTitle(board)}</h1>
            <p className="text-muted">
              {board.acronym ? (
                <>
                  {board.name} ·{" "}
                  <Link href={partyPath(board.board)} className="text-link underline">
                    Notícias do partido
                  </Link>
                </>
              ) : (
                "Política portuguesa em geral"
              )}
            </p>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Ordenar discussões">
            <ul className="flex flex-wrap gap-2">
              {SORTS.map((item) => (
                <li key={item.value}>
                  <Link
                    href={pathOf(board.board, item.param)}
                    aria-current={item === sort ? "page" : undefined}
                    className={tab(item === sort)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {!closed && (
            <a href="#nova" className="rounded-full bg-ink px-4 py-1.5 font-mono text-sm font-bold text-paper hover:opacity-90 xl:hidden">
              Nova discussão
            </a>
          )}
        </div>

        {threads.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            {page > 1 ? "Não há discussões nesta página." : "Ainda não há discussões. Começa a primeira."}
          </p>
        ) : (
          <ul aria-label="Discussões" className="flex flex-col gap-3">
            {threads.items.map((thread) => (
              <li key={thread.id}>
                <article className="relative flex gap-3 rounded-2xl border border-line p-4 hover:bg-surface">
                  <IdeaVote id={thread.id} title={thread.title} score={thread.score ?? 0} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
                      {thread.pinned && <span className="rounded-full bg-ink px-2 py-0.5 font-bold text-paper">Fixada</span>}
                      {thread.locked && <span className="rounded-full border border-line px-2 py-0.5 font-bold text-ink">Fechada</span>}
                      <span className="font-bold text-ink">{posterName(thread.nickname)}</span>
                      <span>(ID: {thread.posterId})</span>
                      <span aria-hidden="true">·</span>
                      <RelativeTime value={thread.createdAt} />
                    </div>
                    <h2 className="break-words text-lg font-bold leading-snug">
                      {/* The whole card is clickable through this link's overlay. */}
                      <Link href={`/forum/${board.board}/${thread.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
                        {thread.title}
                      </Link>
                    </h2>
                    {thread.excerpt && <p className="mt-1 line-clamp-2 break-words text-muted">{thread.excerpt}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
                      <span>{thread.replyCount === 1 ? "1 resposta" : `${thread.replyCount} respostas`}</span>
                      <span>
                        Última <RelativeTime value={thread.bumpedAt} />
                      </span>
                      {thread.link && (
                        <Link
                          href={thread.link.kind === "article" ? `/article/${thread.link.id}` : `/iniciativas/${thread.link.id}`}
                          className="relative z-10 max-w-full truncate rounded-full border border-line px-2 py-0.5 text-ink hover:border-ink"
                        >
                          {thread.link.kind === "article" ? "Notícia" : "Iniciativa"}: {thread.link.title}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Páginas" className="mt-8 flex items-center justify-between font-mono text-sm">
            {page > 1 ? (
              <Link href={pathOf(board.board, sort.param, page - 1)} rel="prev" className="text-link underline">
                ← Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Página {page} de {pages}
            </span>
            {page < pages ? (
              <Link href={pathOf(board.board, sort.param, page + 1)} rel="next" className="text-link underline">
                Seguintes →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>

      <aside
        id="nova"
        className="scroll-mt-24 no-scrollbar xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain xl:pb-2"
      >
        {closed ? (
          <div className="rounded-2xl border border-line p-4 text-sm leading-relaxed">
            <p className="font-bold">Uma conversa por votação</p>
            <p className="mt-1 text-muted">
              Abrimos uma discussão para cada votação na agenda do plenário. Escolhe «Passa» ou «Chumba» em{" "}
              <Link href="/previsoes" className="font-bold text-ink underline">
                Passa ou chumba?
              </Link>{" "}
              e defende a tua escolha na conversa dessa votação: a tua previsão aparece ao lado do teu nome.
            </p>
          </div>
        ) : (
          <NewThreadForm board={board.board} boardName={boardTitle(board)} link={link} />
        )}
        <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
          Texto simples, sem formatação. Sê civilizado e não publiques dados pessoais de ninguém. As mensagens podem ser denunciadas e
          removidas pela moderação.
        </p>
      </aside>
    </div>
  );
}
