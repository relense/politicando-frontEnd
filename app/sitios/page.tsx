import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ElectionMap, type MapPlace } from "@/components/ElectionMap";
import { PlaceFinder, type FinderGroup } from "@/components/PlaceFinder";
import { ApiError, getParties } from "@/lib/api/client";
import { getPlaces, type PlaceSummary } from "@/lib/api/places";
import { placeMap } from "@/lib/maps";
import { electionName, INDEPENDENT_LABEL, mainParty, mayorColor, mayorLegend, placePath, type LegendItem } from "@/lib/places";
import type { Party } from "@/lib/types";

type Props = { searchParams: Promise<{ mapa?: string | string[] }> };

export const metadata: Metadata = {
  title: "Quem governa a tua terra? Presidentes de câmara dos 308 concelhos",
  description:
    "O mapa dos presidentes de câmara de Portugal, por partido: quem governa cada concelho, a composição da câmara e da assembleia municipal, os deputados eleitos pelo distrito e os contratos públicos.",
  alternates: { canonical: "/sitios" },
};

async function load() {
  try {
    const [municipalities, districts, parties] = await Promise.all([
      getPlaces({ level: "municipality" }),
      getPlaces({ level: "district" }),
      getParties().catch((): Party[] => []),
    ]);
    return { municipalities, districts, parties };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function PlacesPage({ searchParams }: Props) {
  await connection();
  const [data, { mapa }] = await Promise.all([load(), searchParams]);
  if (!data) {
    return (
      <div data-wide>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Quem governa a tua terra</h1>
        <p className="mt-4 text-muted">Em breve: o mapa dos presidentes de câmara ainda não está disponível.</p>
      </div>
    );
  }

  const { municipalities, districts, parties } = data;
  const byDistrict = mapa === "distritos";
  const legend = mayorLegend(municipalities, parties);
  const withMayor = municipalities.filter((place) => place.mayor);
  const election = withMayor.find((place) => place.mayor?.election)?.mayor?.election ?? null;
  const inDistrict = (key: string) => municipalities.filter((place) => place.parentKey === key);

  const municipalityPlaces: MapPlace[] = municipalities.flatMap((place) =>
    place.dicofre
      ? [
          {
            code: place.dicofre,
            name: place.name,
            href: placePath(place.key),
            color: mayorColor(place.mayor),
            winner: mainParty(place.mayor, parties) ?? (place.mayor ? INDEPENDENT_LABEL : null),
            pct: null,
            label: place.mayor ? `${place.name}: ${place.mayor.name}, ${mainParty(place.mayor, parties) ?? "independente"}` : place.name,
          },
        ]
      : [],
  );
  const districtPlaces: MapPlace[] = districts.flatMap((district) => {
    if (!district.dicofre) return [];
    const top = mayorLegend(inDistrict(district.key), parties)[0];
    return [
      {
        code: district.dicofre,
        name: district.name,
        href: placePath(district.key),
        color: top?.color ?? null,
        winner: top?.label ?? null,
        pct: null,
        label: top ? `${district.name}: ${top.label} lidera ${top.count} de ${inDistrict(district.key).length} câmaras` : district.name,
      },
    ];
  });

  const level = byDistrict ? "district" : "municipality";
  const shown = byDistrict ? districtPlaces : municipalityPlaces;
  const map = placeMap(
    level,
    shown.map((place) => place.code),
  );

  const groups: FinderGroup[] = [...districts]
    .sort((a, b) => a.name.localeCompare(b.name, "pt"))
    .map((district) => ({
      key: district.key,
      name: district.name,
      href: placePath(district.key),
      places: inDistrict(district.key)
        .sort((a, b) => a.name.localeCompare(b.name, "pt"))
        .map((place: PlaceSummary) => ({
          key: place.key,
          name: place.name,
          href: placePath(place.key),
          mayor: place.mayor?.name ?? null,
          party: place.mayor ? (mainParty(place.mayor, parties) ?? "Indep.") : null,
          color: mayorColor(place.mayor),
        })),
    }))
    .filter((group) => group.places.length > 0);

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          Poder local{election && <> · {electionName(election)}</>}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Quem governa a tua terra</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Os presidentes das {withMayor.length} câmaras municipais, pelo partido da lista que venceu. Carrega num concelho para ver a câmara
          e a assembleia municipal, os deputados eleitos pelo distrito, as últimas eleições e os contratos públicos.
        </p>
      </header>

      <section aria-labelledby="mapa" className="mb-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-2">
          <h2 id="mapa" className="font-mono text-sm font-bold uppercase tracking-widest">
            Presidentes de câmara por partido
          </h2>
          <nav aria-label="Ver o mapa por" className="flex gap-2">
            {[
              { href: "/sitios", label: "Concelhos", current: !byDistrict },
              { href: "/sitios?mapa=distritos", label: "Distritos", current: byDistrict },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                aria-current={item.current ? "page" : undefined}
                className={`rounded-full border px-3 py-1 font-mono text-xs font-bold ${
                  item.current ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {map ? (
            <ElectionMap
              map={map}
              places={shown}
              solid
              label={
                byDistrict
                  ? "Mapa dos distritos, pelo partido com mais câmaras"
                  : "Mapa dos concelhos, pelo partido do presidente da câmara"
              }
              caption={
                <figcaption className="mt-2 font-mono text-[11px] text-muted">
                  {byDistrict
                    ? "Cada distrito com a cor do partido que lidera mais câmaras."
                    : "Cor do partido principal da lista vencedora; coligações pelo primeiro partido."}{" "}
                  Limites: {map.source}.
                </figcaption>
              }
            />
          ) : (
            <p className="text-muted">Mapa indisponível.</p>
          )}
          <Legend items={legend} total={withMayor.length} />
        </div>
      </section>

      <section aria-labelledby="concelhos" className="mb-12">
        <h2 id="concelhos" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          Todos os concelhos
        </h2>
        <PlaceFinder groups={groups} />
      </section>

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: resultados oficiais do Ministério da Administração Interna{election && <> ({electionName(election)})</>}.
      </p>
    </div>
  );
}

/** Câmaras per party, biggest first, as bars. */
function Legend({ items, total }: { items: LegendItem[]; total: number }) {
  if (items.length === 0) return null;
  const top = items[0]!.count;
  return (
    <div>
      <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-muted">Câmaras por partido</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 font-mono text-xs">
            <span className="truncate font-bold">{item.label}</span>
            <span aria-hidden="true" className="h-3 overflow-hidden rounded-sm bg-surface">
              <span className="block h-full rounded-sm" style={{ width: `${(item.count / top) * 100}%`, backgroundColor: item.color }} />
            </span>
            <span className="text-right">
              {item.count}
              <span className="sr-only"> de {total} câmaras</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[11px] text-muted">De {total} câmaras. Independentes: listas de grupos de cidadãos.</p>
    </div>
  );
}
