import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BoardBadge } from "@/components/forum/BoardBadge";
import { RelativeTime } from "@/components/RelativeTime";
import { ApiError } from "@/lib/api/client";
import { getBoards, IDEAS_BOARD, type Board } from "@/lib/api/forums";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Fórum",
  description: "Discussões sobre política portuguesa: um fórum geral e um por cada partido.",
  alternates: { canonical: "/forum" },
};

/** Empty while the API doesn't serve forums yet, so the page can say so calmly. */
async function loadBoards(): Promise<Board[]> {
  try {
    return await getBoards();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

export default async function ForumIndexPage() {
  await connection();
  const boards = await loadBoards();
  // Ideas for the site have their own page, with votes.
  const general = boards.filter((board) => board.acronym === null && board.board !== IDEAS_BOARD);
  const hasIdeas = boards.some((board) => board.board === IDEAS_BOARD);
  const parties = boards.filter((board) => board.acronym !== null);

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Discussão</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Fórum</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Um fórum geral e um por cada partido. Cada pessoa recebe um ID diferente em cada discussão, para se perceber quem diz o quê sem
          ser seguida de discussão em discussão; com conta, escreves com o teu nome público. O endereço IP não é guardado.
        </p>
      </header>

      {boards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          O fórum ainda não está disponível. Volta em breve.
        </p>
      ) : (
        <>
          {general.length > 0 && <BoardList boards={general} label="Fórum geral" featured />}
          {hasIdeas && (
            <p className="mt-4 text-sm text-muted">
              Tens uma ideia para o site?{" "}
              <Link href="/feedback/ideias" className="font-bold text-link underline">
                Propõe-a e vota nas outras →
              </Link>
            </p>
          )}
          {parties.length > 0 && (
            <section aria-labelledby="partidos" className="mt-10">
              <h2 id="partidos" className="mb-4 font-mono text-sm font-bold uppercase tracking-widest text-muted">
                Por partido
              </h2>
              <BoardList boards={parties} label="Fóruns dos partidos" />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BoardList({ boards, label, featured = false }: { boards: Board[]; label: string; featured?: boolean }) {
  return (
    <ul aria-label={label} className={featured ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {boards.map((board) => (
        <li key={board.board}>
          <Link
            href={`/forum/${board.board}`}
            className="flex h-full items-center gap-4 rounded-2xl border border-line p-4 hover:bg-surface"
          >
            <BoardBadge board={board} size={featured ? 48 : 40} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-snug">{board.acronym ? `${board.acronym} · ${board.name}` : board.name}</span>
              <span className="block font-mono text-xs text-muted">
                {board.threads === 1 ? "1 discussão" : `${formatNumber(board.threads)} discussões`} ·{" "}
                {board.posts === 1 ? "1 mensagem" : `${formatNumber(board.posts)} mensagens`}
              </span>
              <span className="block font-mono text-xs text-muted">
                {board.lastActivity ? (
                  <>
                    Última atividade <RelativeTime value={board.lastActivity} />
                  </>
                ) : (
                  "Ainda sem discussões"
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
