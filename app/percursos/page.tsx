import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CareerTimeline } from "@/components/CareerPath";
import { DeputyPortrait } from "@/components/DeputyProfile";
import { GovernmentPortrait } from "@/components/GovernmentPortrait";
import { type FeaturedPerson, getFeaturedPeople, personHref, tryPersonPath } from "@/lib/api/people";
import { partyColor } from "@/lib/parliament";

export const metadata: Metadata = {
  title: "Percursos: como chegaram lá",
  description:
    "O percurso do Presidente da República, do Primeiro-Ministro, do Presidente da Assembleia e dos líderes partidários: cargos no Parlamento, no Governo e na Presidência, com fontes oficiais.",
  alternates: { canonical: "/percursos" },
};

const PREVIEW_STEPS = 3;

async function loadFeatured(): Promise<FeaturedPerson[]> {
  try {
    return await getFeaturedPeople();
  } catch {
    return [];
  }
}

export default async function PathsPage() {
  await connection();
  const people = await loadFeatured();
  const paths = await Promise.all(people.map((person) => tryPersonPath(person.kind, person.id)));

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Percursos</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Como chegaram lá</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Quem ocupa os cargos de topo e o caminho que fizeram até lá: mandatos no Parlamento, cargos no Governo e na Presidência, e as
          listas por que foram eleitos. Tudo vem de fontes oficiais.
        </p>
      </header>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Os percursos ainda não estão disponíveis.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {people.map((person, index) => {
            const path = paths[index];
            const href = personHref(person.kind, person.id);
            return (
              <li
                key={`${person.kind}-${person.id}`}
                className="flex flex-col rounded-2xl border border-t-4 border-line p-5"
                style={{ borderTopColor: person.party ? partyColor(person.party.slug) : "var(--ink)" }}
              >
                <div className="flex items-center gap-4">
                  {person.kind === "deputy" && /^\d+$/.test(person.id) ? (
                    <DeputyPortrait
                      deputy={{
                        id: Number(person.id),
                        name: person.name,
                        photoUrl: person.photoUrl,
                        partySlug: person.party?.slug ?? null,
                      }}
                      size="md"
                    />
                  ) : (
                    <GovernmentPortrait name={person.name} photoUrl={person.photoUrl} size="md" />
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-snug">
                      <Link href={href} className="hover:underline">
                        {person.name}
                      </Link>
                    </h2>
                    {person.role && <p className="text-sm text-muted">{person.role}</p>}
                    {person.party && <p className="font-mono text-xs font-bold">{person.party.acronym}</p>}
                  </div>
                </div>
                <div className="mt-5 flex-1">
                  {path && path.path.length > 0 ? (
                    <CareerTimeline steps={path.path} limit={PREVIEW_STEPS} />
                  ) : (
                    <p className="text-sm text-muted">Sem percurso registado nas fontes oficiais.</p>
                  )}
                </div>
                <Link href={person.kind === "president" ? href : `${href}#percurso`} className="mt-4 font-mono text-sm text-link underline">
                  Ver percurso completo<span className="sr-only"> de {person.name}</span> →
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 border-t border-line pt-4 font-mono text-xs text-muted">
        Fontes: Assembleia da República (dados abertos), portal do Governo e presidencia.pt. Os percursos de quem fez carreira fora do
        Parlamento atual ainda são curtos: as legislaturas e os Governos anteriores estão a ser importados.
      </p>
    </div>
  );
}
