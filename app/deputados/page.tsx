import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { DeputiesView } from "@/components/DeputiesView";
import { ApiError, getParliament } from "@/lib/api/client";
import { partyColor } from "@/lib/parliament";
import type { Parliament } from "@/lib/types";

type Props = { searchParams: Promise<{ partido?: string | string[]; deputado?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { partido } = await searchParams;
  const parliament = await loadParliament();
  const group = parliament?.groups.find((item) => item.party.slug === partido);
  return {
    title: group ? `Deputados do ${group.party.acronym}` : "Deputados",
    description: group
      ? `Os ${group.seats} deputados do ${group.party.name} na Assembleia da República.`
      : "Os 230 deputados da Assembleia da República, por partido.",
    alternates: { canonical: group ? `/deputados?partido=${group.party.slug}` : "/deputados" },
  };
}

async function loadParliament(): Promise<Parliament | null> {
  try {
    return await getParliament();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function DeputiesPage({ searchParams }: Props) {
  await connection();
  const [parliament, { partido, deputado }] = await Promise.all([loadParliament(), searchParams]);

  if (!parliament) {
    return (
      <>
        <h1 className="mb-6 text-3xl font-bold">Deputados</h1>
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Os dados do Parlamento estarão disponíveis em breve.
        </p>
      </>
    );
  }

  const group = parliament.groups.find((item) => item.party.slug === partido) ?? null;
  const initialDeputy = typeof deputado === "string" && /^\d+$/.test(deputado) ? Number(deputado) : null;
  const shown = group ? parliament.deputies.filter((deputy) => deputy.partySlug === group.party.slug) : parliament.deputies;
  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold ${active ? "border-ink bg-surface" : "border-line hover:bg-surface"}`;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          Assembleia da República · {parliament.legislature} Legislatura
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{group ? `Deputados do ${group.party.acronym}` : "Deputados"}</h1>
        <p className="mt-2 text-muted">
          {group
            ? `${group.party.name} · ${shown.length} ${shown.length === 1 ? "deputado" : "deputados"}`
            : `${shown.length} deputados, por ordem alfabética`}
          {" · carrega num deputado para ver o resumo"}
          {" · "}
          <Link href={group ? `/parlamento?partido=${group.party.slug}` : "/parlamento"} className="text-link underline">
            ver no hemiciclo
          </Link>
        </p>
      </header>

      <nav aria-label="Filtrar por partido" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href="/deputados" aria-current={group ? undefined : "page"} className={chip(!group)}>
              Todos <span className="font-normal text-muted">{parliament.deputies.length}</span>
            </Link>
          </li>
          {parliament.groups.map((item) => (
            <li key={item.party.slug}>
              <Link
                href={`/deputados?partido=${item.party.slug}`}
                aria-current={group?.party.slug === item.party.slug ? "page" : undefined}
                title={item.party.name}
                className={chip(group?.party.slug === item.party.slug)}
              >
                <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: partyColor(item.party.slug) }} />
                {item.party.acronym} <span className="font-normal text-muted">{item.seats}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <DeputiesView key={group?.party.slug ?? ""} deputies={shown} groups={parliament.groups} initialDeputy={initialDeputy} />

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">Fonte: Assembleia da República (dados abertos).</p>
    </div>
  );
}
