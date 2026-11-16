import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CorrectionList } from "@/components/CorrectionList";
import { getCorrections } from "@/lib/api/feedback";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Registo de correções",
  description: "Todas as correções feitas no Politicando, com a data e o que estava errado.",
  alternates: { canonical: "/feedback/correcoes" },
};

export default async function CorrectionsPage({ searchParams }: Props) {
  await connection();
  const after = (await searchParams).depois;
  const page = await getCorrections(typeof after === "string" ? after : undefined).catch(() => null);

  return (
    <div className="pb-4">
      <nav aria-label="Caminho" className="mb-4 font-mono text-xs text-muted">
        <Link href="/feedback" className="hover:text-ink hover:underline">
          ← Feedback
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Registo de correções</h1>
        <p className="mt-2 leading-relaxed text-muted">
          Quando um leitor nos aponta um erro e o confirmamos numa fonte, corrigimos a página e deixamos aqui a nota, com a data. Os pedidos
          ainda por confirmar aparecem como «A verificar».
        </p>
      </header>
      {!page ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">O registo estará disponível em breve.</p>
      ) : page.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Ainda não há correções.</p>
      ) : (
        <>
          <CorrectionList items={page.items} />
          {page.nextCursor && (
            <Link
              href={`/feedback/correcoes?depois=${encodeURIComponent(page.nextCursor)}`}
              className="mt-4 block rounded-2xl border border-line p-3 text-center font-mono text-xs font-bold hover:bg-surface"
            >
              Mais antigas →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
