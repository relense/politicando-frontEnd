import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getLegislatures, legislaturePath } from "@/lib/api/legislatures";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Legislaturas",
  description:
    "Todas as legislaturas da Assembleia da República, da Constituinte de 1975 até hoje: quem governou, o que se aprovou e o que aconteceu.",
  alternates: { canonical: "/legislaturas" },
};

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

export default async function LegislaturesPage() {
  await connection();
  const legislatures = await getLegislatures().catch(() => []);

  return (
    <div data-wide className="pb-4">
      <header className="mb-8 max-w-3xl">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Assembleia da República · desde 1975</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          As <span className={MARKER}>legislaturas</span>
        </h1>
        <p className="mt-2 leading-relaxed text-muted">
          Cada legislatura é o tempo de um Parlamento, da primeira reunião depois de umas eleições até à primeira do seguinte. Abre uma para
          ver quem foi eleito, quem governou, o que se propôs e aprovou, e o que aconteceu nesses anos.
        </p>
      </header>

      {legislatures.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          As legislaturas estarão disponíveis em breve.
        </p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {legislatures.map((legislature) => {
            const from = legislature.start.slice(0, 4);
            const to = legislature.end ? legislature.end.slice(0, 4) : "hoje";
            return (
              <li key={legislature.id}>
                <Link
                  href={legislaturePath(legislature.id)}
                  className={`flex h-full flex-col rounded-2xl border p-4 hover:bg-surface ${legislature.current ? "border-ink" : "border-line"}`}
                >
                  <span className="flex items-baseline justify-between gap-2 font-mono text-xs text-muted">
                    <span>
                      {from}–{to}
                    </span>
                    {legislature.current && <span className="font-bold text-[var(--stage-law)]">Em funções</span>}
                  </span>
                  <span className="mt-1 text-xl font-bold leading-snug">{legislature.name}</span>
                  {legislature.primeMinisters.length > 0 && (
                    <span className="mt-1 text-sm text-muted">{legislature.primeMinisters.join(", ")}</span>
                  )}
                  <span className="mt-auto flex flex-wrap gap-x-3 pt-3 font-mono text-[11px] text-muted">
                    {legislature.initiatives > 0 && <span>{formatNumber(legislature.initiatives)} iniciativas</span>}
                    {legislature.events > 0 && <span>{legislature.events} acontecimentos</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
