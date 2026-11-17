import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { OG_BASE } from "@/lib/seo";
import type { ReactNode } from "react";
import { cache } from "react";
import { DeputyPortrait } from "@/components/DeputyProfile";
import { ElectionMap, type MapPlace } from "@/components/ElectionMap";
import { PartyLogo } from "@/components/PartyLogo";
import { ApiError, getElections, getParties } from "@/lib/api/client";
import { getPlaceDetail, getPlaces, type CouncilOrgan, type Mayor, type PlaceDetail, type PlaceSummary } from "@/lib/api/places";
import { electionPath, listColor, ORGAN_LABELS, tidyName } from "@/lib/elections";
import { formatLongDate, formatNumber, formatPercent } from "@/lib/format";
import { placeMap } from "@/lib/maps";
import { partyPath } from "@/lib/parties";
import {
  electionName,
  formatEuros,
  initialsOf,
  INDEPENDENT_LABEL,
  mainParty,
  mayorColor,
  mayorLegend,
  mayorListLabel,
  PLACE_KEY,
  placePath,
} from "@/lib/places";
import { SITE_URL } from "@/lib/site";
import type { Election, Party, Place } from "@/lib/types";

type Props = { params: Promise<{ key: string }> };

const LEVEL_LABELS: Record<string, string> = { district: "Distrito", municipality: "Concelho", parish: "Freguesia" };

/** One request per render, shared by the metadata and the page. */
const loadPlace = cache(async (key: string): Promise<PlaceDetail> => {
  if (!PLACE_KEY.test(key)) notFound();
  try {
    return await getPlaceDetail(key);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
});

/** District → municipality → parish, ending with the place itself. A parish asks for its municipality to find the district. */
const loadTrail = cache(async (place: PlaceDetail): Promise<{ trail: Place[]; municipality: PlaceDetail | null }> => {
  const local = (item: Place | null) => item && (item.level === "district" || item.level === "municipality");
  if (place.level !== "parish") return { trail: [...(local(place.parent) ? [place.parent!] : []), place], municipality: null };
  const municipality = place.parent?.level === "municipality" ? await loadPlace(place.parent.key).catch(() => null) : null;
  const above = municipality
    ? [...(local(municipality.parent) ? [municipality.parent!] : []), municipality]
    : place.parent
      ? [place.parent]
      : [];
  return { trail: [...above, place], municipality };
});

const districtName = (place: PlaceDetail) => (place.parent?.level === "district" ? place.parent.name : null);

function titleOf(place: PlaceDetail, municipality: PlaceDetail | null): string {
  if (place.level === "district") return `Distrito de ${place.name}: presidentes de câmara, deputados e eleições`;
  if (place.level === "parish")
    return `Freguesia de ${place.name}${municipality ? ` (${municipality.name})` : ""}: assembleia de freguesia e eleições`;
  // The mayor's name in the title: people search for the name as much as for the town.
  if (place.mayor) return `Quem governa ${place.name}? ${place.mayor.name}, presidente da câmara`;
  return `Quem governa ${place.name}? Presidente da câmara, vereadores, deputados e contratos`;
}

function describe(place: PlaceDetail, municipality: PlaceDetail | null): string {
  const deputies = place.deputies?.items.length ?? 0;
  const circle = place.deputies ? ` Os ${deputies} deputados eleitos por ${place.deputies.circle.name}` : "";
  if (place.level === "district") {
    return `Quem governa os ${place.children.length} concelhos do distrito de ${place.name}: presidentes de câmara por partido.${circle}, os resultados eleitorais e os contratos públicos.`;
  }
  if (place.level === "parish") {
    return `A freguesia de ${place.name}${municipality ? `, no concelho de ${municipality.name}` : ""}: a composição da assembleia de freguesia, os resultados eleitorais${
      municipality?.mayor ? ` e quem preside à câmara (${municipality.mayor.name})` : ""
    }.`;
  }
  const mayor = place.mayor ? `${place.mayor.name} preside à Câmara Municipal de ${place.name}. ` : "";
  return `${mayor}Composição da câmara e da assembleia municipal.${circle}, resultados eleitorais e contratos públicos de ${place.name}.`;
}

const DEPUTIES_SHOWN = 12;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await loadPlace((await params).key);
  if (place.level !== "district" && place.level !== "municipality" && place.level !== "parish") return { title: place.name };
  const { municipality } = await loadTrail(place);
  const title = titleOf(place, municipality);
  const description = describe(place, municipality);
  return {
    title,
    description,
    alternates: { canonical: placePath(place.key) },
    openGraph: { ...OG_BASE, title, description, url: placePath(place.key) },
  };
}

/** Structured data: the place inside its parent, and the breadcrumb. "<" is escaped so no text can close the script tag. */
function jsonLd(place: PlaceDetail, trail: Place[]) {
  const url = (item: Place) => `${SITE_URL}${placePath(item.key)}`;
  const parent = trail.at(-2);
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "AdministrativeArea",
      name: place.name,
      url: url(place),
      containedInPlace: parent
        ? { "@type": "AdministrativeArea", name: parent.name, url: url(parent) }
        : { "@type": "Country", name: "Portugal" },
    },
    // Who presides over the câmara: the person people search for, tied to the place.
    ...(place.level === "municipality" && place.mayor
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "@id": `${url(place)}#presidente-camara`,
            name: place.mayor.name,
            jobTitle: `Presidente da Câmara Municipal de ${place.name}`,
            nationality: { "@type": "Country", name: "Portugal" },
            worksFor: { "@type": "GovernmentOrganization", name: `Câmara Municipal de ${place.name}`, url: url(place) },
            ...(place.mayor.parties[0]
              ? { memberOf: { "@type": "PoliticalParty", name: place.mayor.label, url: `${SITE_URL}${partyPath(place.mayor.parties[0])}` } }
              : {}),
          },
        ]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Quem governa", item: `${SITE_URL}/sitios` },
        ...trail.map((item) => ({ name: item.name, item: url(item) })),
      ].map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
    },
  ];
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function PlacePage({ params }: Props) {
  await connection();
  const place = await loadPlace((await params).key);
  if (place.level !== "district" && place.level !== "municipality" && place.level !== "parish") redirect("/sitios");

  const [{ trail, municipality }, parties, elections, municipalities] = await Promise.all([
    loadTrail(place),
    getParties().catch((): Party[] => []),
    getElections().catch((): Election[] => []),
    place.level === "district" ? getPlaces({ level: "municipality", parent: place.key }).catch((): PlaceSummary[] => []) : null,
  ]);
  const imported = new Set(elections.filter((election) => election.imported).map((election) => election.id));
  const district = districtName(place);

  return (
    <div data-wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(place, trail) }} />
      <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
        <Link href="/sitios" className="underline hover:text-ink">
          Quem governa
        </Link>
        {trail.map((item) => (
          <span key={item.key} className="contents">
            <span aria-hidden="true">›</span>
            <Link
              href={placePath(item.key)}
              aria-current={item.key === place.key ? "page" : undefined}
              className="hover:text-ink hover:underline"
            >
              {item.name}
            </Link>
          </span>
        ))}
      </nav>

      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          {LEVEL_LABELS[place.level]}
          {place.level === "municipality" && district && <> · Distrito de {district}</>}
          {place.level === "parish" && municipality && <> · Concelho de {municipality.name}</>}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{place.name}</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">{intro(place, municipality, parties)}</p>
      </header>

      {place.level === "municipality" && place.mayor && (
        <Section id="presidente" title={`Quem preside à Câmara de ${place.name}`}>
          <MayorCard mayor={place.mayor} placeKey={place.key} parties={parties} imported={imported} />
        </Section>
      )}

      {place.level === "parish" && municipality && (
        <Section id="concelho" title={`O concelho de ${municipality.name}`}>
          <Link href={placePath(municipality.key)} className="flex items-center gap-4 rounded-2xl border border-line p-4 hover:bg-surface">
            {municipality.mayor && <Initials mayor={municipality.mayor} size="sm" />}
            <span className="min-w-0">
              <span className="block font-mono text-[11px] uppercase tracking-widest text-muted">Presidente da câmara</span>
              <span className="block font-bold">{municipality.mayor?.name ?? municipality.name}</span>
              {municipality.mayor && (
                <span className="block font-mono text-xs text-muted">{mayorListLabel(municipality.mayor, parties)}</span>
              )}
            </span>
            <span aria-hidden="true" className="ml-auto font-mono text-sm">
              →
            </span>
          </Link>
          <p className="mt-2 font-mono text-[11px] text-muted">
            Os presidentes de junta não são publicados com os resultados; mostramos a lista mais votada na assembleia de freguesia.
          </p>
        </Section>
      )}

      {place.level === "district" && municipalities && municipalities.length > 0 && (
        <DistrictMunicipalities district={place} municipalities={municipalities} parties={parties} />
      )}

      {place.level !== "district" && place.council && (
        <Section
          id="orgaos"
          title={place.level === "parish" ? "Assembleia de freguesia" : "Vereadores e assembleia municipal"}
          note={`resultados das ${electionName(place.council.election)}`}
        >
          <div className="grid gap-6 md:grid-cols-2">
            {place.council.organs.map((organ) => (
              <CouncilCard key={organ.organ} organ={organ} parties={parties} />
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted">
            {place.mayor?.election && place.mayor.election !== place.council.election && (
              <>
                A composição é a das {electionName(place.council.election)}: os resultados das {electionName(place.mayor.election)} ainda
                não estão disponíveis.{" "}
              </>
            )}
            Os nomes dos vereadores e deputados municipais não vêm nos resultados oficiais; mostramos os mandatos de cada lista.
          </p>
        </Section>
      )}

      {place.deputies && place.deputies.items.length > 0 && (
        <Section id="deputados" title={`Deputados eleitos por ${place.deputies.circle.name}`} note="Quem te representa no Parlamento">
          {/* On a phone a big circle (Lisboa elects 48) shows the first 12; the rest open with a press, without scripts. */}
          <div className="group/deps">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {place.deputies.items.map((deputy, index) => (
                <li
                  key={deputy.id}
                  className={index >= DEPUTIES_SHOWN ? "max-sm:hidden max-sm:group-has-[input:checked]/deps:block" : undefined}
                >
                  <Link
                    href={`/deputados/${deputy.id}`}
                    className="flex h-full items-center gap-3 rounded-2xl border border-line p-3 hover:bg-surface"
                  >
                    <DeputyPortrait
                      deputy={{ id: deputy.id, name: deputy.name, photoUrl: deputy.photoUrl, partySlug: deputy.party?.slug ?? null }}
                      size="xs"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-snug">{deputy.name}</span>
                      {deputy.party && (
                        <span className="block font-mono text-[11px] text-muted">
                          {acronymOf(deputy.party.slug, parties) ?? deputy.party.acronym}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {place.deputies.items.length > DEPUTIES_SHOWN && (
              <label className="mt-3 inline-flex cursor-pointer rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface has-[:focus-visible]:outline has-[:focus-visible]:outline-2 sm:hidden group-has-[input:checked]/deps:hidden">
                <input type="checkbox" className="sr-only" />
                Ver os {place.deputies.items.length} deputados
              </label>
            )}
          </div>
        </Section>
      )}

      {place.elections.length > 0 && (
        <Section id="eleicoes" title={`Últimas eleições em ${place.name}`}>
          <ul className="divide-y divide-line">
            {place.elections.map((item) => (
              <li key={`${item.election}-${item.organ}`}>
                <Link
                  href={electionPath(item.election, place.key)}
                  className="-mx-2 grid grid-cols-1 items-baseline gap-x-3 rounded px-2 py-2.5 hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{item.name}</span>
                    <span className="block font-mono text-[11px] text-muted">
                      {formatLongDate(item.date)}
                      {item.turnoutPct !== null && <> · participação {formatPercent(item.turnoutPct)}</>}
                    </span>
                  </span>
                  {item.winner && (
                    <span className="mt-1 font-mono text-xs sm:mt-0 sm:text-right">
                      <span className="sr-only">Mais votado: </span>
                      <span className="font-bold">{shortList(item.winner.label)}</span> {formatPercent(item.winner.validPct)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(place.contracts.council || (place.contracts.carriedOut && place.contracts.carriedOut.count > 0)) && (
        <Section
          id="contratos"
          title={`Contratos públicos ${place.level === "district" ? "no distrito" : place.level === "parish" ? "" : "da câmara"}`.trim()}
        >
          <ContractsBox place={place} />
        </Section>
      )}

      {place.children.length > 0 && place.level === "municipality" && (
        <Section id="freguesias" title={`Freguesias de ${place.name}`} note={`${place.children.length}`}>
          <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {place.children.map((child) => (
              <li key={child.key}>
                <Link href={placePath(child.key)} className="-mx-2 block rounded px-2 py-1 hover:bg-surface hover:underline">
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fontes: resultados eleitorais do Ministério da Administração Interna; deputados da Assembleia da República; contratos do Portal BASE
        / IMPIC.
      </p>
    </div>
  );
}

function intro(place: PlaceDetail, municipality: PlaceDetail | null, parties: Party[]): string {
  if (place.level === "district") {
    return `O distrito de ${place.name} tem ${place.children.length} concelhos${
      place.deputies ? ` e elege ${place.deputies.items.length} deputados à Assembleia da República` : ""
    }. Carrega num concelho para ver quem o governa.`;
  }
  if (place.level === "parish") {
    const winner = place.council?.organs.find((organ) => organ.organ === "AF")?.seats[0];
    return `${winner ? `Nas ${electionName(place.council!.election)}, a lista mais votada para a assembleia de freguesia foi ${shortList(winner.label)}.` : ""}${
      municipality?.mayor ? ` A Câmara de ${municipality.name} é presidida por ${municipality.mayor.name}.` : ""
    }`.trim();
  }
  if (!place.mayor) return `Quem governa ${place.name}: a câmara, a assembleia municipal, os deputados e os contratos públicos.`;
  const party = mainParty(place.mayor, parties);
  const list =
    place.mayor.parties.length > 1
      ? `de ${mayorListLabel(place.mayor, parties)}`
      : party
        ? `do ${party}`
        : `do movimento ${tidyName(place.mayor.label)}`;
  const when = place.mayor.election ? ` nas ${electionName(place.mayor.election)}` : "";
  return `A Câmara Municipal de ${place.name} é presidida por ${place.mayor.name}, cabeça de lista ${list}${when}.`;
}

const acronymOf = (slug: string, parties: Party[]) => parties.find((party) => party.slug === slug)?.acronym ?? null;

/** "AD - COLIGAÇÃO PSD/CDS" → "AD"; long ballot names in capitals become readable, without their quotes. */
function shortList(label: string): string {
  const bare = label.replace(/^["“'\s]+|["”'\s]+$/g, "");
  const head = bare.split(" - ")[0]!.trim();
  return head !== bare && head.length <= 6 ? head : tidyName(bare);
}

/** A list of exactly one of our parties goes by that party's name; any other by its name on the ballot. */
function seatName(seat: { label: string; parties: string[] }, parties: Party[]): string {
  const party = seat.parties.length === 1 ? parties.find((candidate) => candidate.slug === seat.parties[0]) : undefined;
  return party ? tidyName(party.name) : shortList(seat.label);
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-12">
      <h2 id={id} className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
        {title}
        {note && <span className="font-normal normal-case tracking-normal text-muted"> · {note}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Initials in a ring of the party's colour: the source has no photos of mayors. */
function Initials({ mayor, size }: { mayor: Mayor; size: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface font-bold ${size === "lg" ? "size-20 text-2xl" : "size-12 text-base"}`}
      style={{ boxShadow: `0 0 0 3px ${mayorColor(mayor)}` }}
    >
      {initialsOf(mayor.name)}
    </span>
  );
}

function MayorCard({ mayor, placeKey, parties, imported }: { mayor: Mayor; placeKey: string; parties: Party[]; imported: Set<string> }) {
  const ours = mayor.parties.flatMap((slug) => {
    const party = parties.find((candidate) => candidate.slug === slug);
    return party ? [party] : [];
  });
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line p-5 sm:flex-row sm:items-center">
      <Initials mayor={mayor} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Presidente da câmara</p>
        <p className="text-2xl font-bold leading-tight">{mayor.name}</p>
        <p className="mt-1 text-sm">
          Lista <span className="font-bold">{tidyName(mayor.label)}</span>
          {mayor.label !== mayor.list && <span className="font-mono text-xs text-muted"> ({mayor.list})</span>}
          {mayor.parties.length === 0 && <span className="text-muted"> · grupo de cidadãos ({INDEPENDENT_LABEL.toLowerCase()})</span>}
        </p>
        {ours.length > 0 && (
          <ul aria-label="Partidos da lista" className="mt-3 flex flex-wrap gap-2">
            {ours.map((party) => (
              <li key={party.slug}>
                <Link
                  href={partyPath(party.slug)}
                  className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-3 font-mono text-xs font-bold hover:bg-surface"
                >
                  <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
                  {party.acronym}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {mayor.election && imported.has(mayor.election) && (
        <Link href={electionPath(mayor.election, placeKey)} className="shrink-0 font-mono text-sm text-link underline">
          Resultados das {electionName(mayor.election)} →
        </Link>
      )}
    </div>
  );
}

/** The seats of one council: a bar of seats in the lists' colours, then each list with its mandates. */
function CouncilCard({ organ, parties }: { organ: CouncilOrgan; parties: Party[] }) {
  const seats = organ.seats.flatMap((seat) => Array.from({ length: seat.mandates }, () => listColor({ partySlugs: seat.parties })));
  return (
    <div className="rounded-2xl border border-line p-4">
      <h3 className="font-bold">
        {ORGAN_LABELS[organ.organ] ?? organ.organ}{" "}
        <span className="font-mono text-xs font-normal text-muted">· {organ.totalMandates} mandatos</span>
      </h3>
      <div aria-hidden="true" className="mt-3 flex flex-wrap gap-1">
        {seats.map((color, index) => (
          <span
            key={index}
            className={`rounded-sm ${organ.totalMandates > 20 ? "size-2.5" : "size-4"}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {organ.seats.map((seat) => (
          <li key={seat.list} className="flex items-baseline gap-2 py-1.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 self-center rounded-sm"
              style={{ backgroundColor: listColor({ partySlugs: seat.parties }) }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-bold">{seatName(seat, parties)}</span>
              {seat.parties.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {" "}
                  {seat.parties.map((slug) => acronymOf(slug, parties) ?? slug.toUpperCase()).join("/")}
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-xs">
              <span className="font-bold">{seat.mandates}</span>
              <span className="sr-only"> mandatos</span>
              {seat.validPct !== null && <span className="text-muted"> · {formatPercent(seat.validPct)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContractsBox({ place }: { place: PlaceDetail }) {
  const { council, carriedOut } = place.contracts;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {council && (
        <div className="rounded-2xl border border-line p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">A câmara como compradora</p>
          <p className="mt-1 text-3xl font-bold">{formatNumber(council.count)}</p>
          <p className="mt-1 text-sm leading-relaxed">
            contratos públicos assinados pelo {council.name}, no valor de {formatEuros(council.total)}.{" "}
            {council.count > 0 && (
              <>
                Ajustes diretos: <span className="font-bold">{formatNumber(council.directAwards)}</span> (
                {formatPercent((council.directAwards / council.count) * 100)}).
              </>
            )}
          </p>
          <Link href={`/contratos/entidade/${council.nif}`} className="mt-3 inline-block font-mono text-sm text-link underline">
            Ver os contratos da câmara →
          </Link>
        </div>
      )}
      {carriedOut && carriedOut.count > 0 && (
        <div className="rounded-2xl border border-line p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Executados em {place.name}</p>
          <p className="mt-1 text-3xl font-bold">{formatNumber(carriedOut.count)}</p>
          <p className="mt-1 text-sm leading-relaxed">
            contratos de qualquer entidade pública com execução{" "}
            {place.level === "district" ? "no distrito" : place.level === "parish" ? "na freguesia" : "no concelho"}, no valor de{" "}
            {formatEuros(carriedOut.total)}.
          </p>
          <Link href={`/contratos?local=${place.key}`} className="mt-3 inline-block font-mono text-sm text-link underline">
            Ver contratos executados aqui →
          </Link>
        </div>
      )}
      <p className="font-mono text-[11px] text-muted md:col-span-2">
        Desde 2024, valores sem IVA. Um ajuste direto é legal dentro dos limites da lei. Fonte: Portal BASE / IMPIC.
      </p>
    </div>
  );
}

function DistrictMunicipalities({
  district,
  municipalities,
  parties,
}: {
  district: PlaceDetail;
  municipalities: PlaceSummary[];
  parties: Party[];
}) {
  const sorted = [...municipalities].sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const map = placeMap(
    "municipality",
    sorted.map((place) => place.dicofre),
  );
  const mapPlaces: MapPlace[] = sorted.flatMap((place) =>
    place.dicofre
      ? [
          {
            code: place.dicofre,
            name: place.name,
            href: placePath(place.key),
            color: mayorColor(place.mayor),
            winner: mainParty(place.mayor, parties),
            pct: null,
            label: place.mayor ? `${place.name}: ${place.mayor.name}, ${mainParty(place.mayor, parties) ?? "independente"}` : place.name,
          },
        ]
      : [],
  );
  return (
    <Section id="concelhos" title={`Presidentes de câmara do distrito de ${district.name}`}>
      <div className={map ? "grid items-start gap-8 md:grid-cols-2" : ""}>
        {map && (
          <ElectionMap
            map={map}
            places={mapPlaces}
            solid
            label={`Mapa dos concelhos do distrito de ${district.name}, pelo partido do presidente da câmara`}
            caption={
              <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
                {mayorLegend(sorted, parties).map((item) => (
                  <span key={item.key} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-ink">{item.label}</span> {item.count}
                  </span>
                ))}
              </figcaption>
            }
          />
        )}
        <ul className="divide-y divide-line">
          {sorted.map((place) => (
            <li key={place.key}>
              <Link href={placePath(place.key)} className="-mx-2 flex items-center gap-3 rounded px-2 py-2 hover:bg-surface">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: mayorColor(place.mayor) ?? "var(--line)" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{place.name}</span>
                  {place.mayor && <span className="block truncate text-xs text-muted">{place.mayor.name}</span>}
                </span>
                {place.mayor && <span className="shrink-0 font-mono text-xs font-bold">{mainParty(place.mayor, parties) ?? "Indep."}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
