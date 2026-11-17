import type { Metadata } from "next";
import { connection } from "next/server";
import { MayorMap, type MayorMapPlace, type SearchItem } from "@/components/MayorMap";
import { PlaceFinder, type FinderGroup } from "@/components/PlaceFinder";
import { ApiError, getParties } from "@/lib/api/client";
import { getPlaces, type PlaceSummary } from "@/lib/api/places";
import { placeMap } from "@/lib/maps";
import { electionName, mainParty, mayorColor, mayorLegend, mayorListLabel, placePath } from "@/lib/places";
import type { Party } from "@/lib/types";

type Props = { searchParams: Promise<{ mapa?: string | string[]; local?: string | string[] }> };

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
  const [data, { mapa, local }] = await Promise.all([load(), searchParams]);
  if (!data) {
    return (
      <div data-wide>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Quem governa a{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">tua terra</span>
        </h1>
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

  const districtName = new Map(districts.map((district) => [district.key, district.name]));
  const municipalityPlaces: MayorMapPlace[] = municipalities.flatMap((place) =>
    place.dicofre
      ? [
          {
            key: place.key,
            code: place.dicofre,
            name: place.name,
            href: placePath(place.key),
            district: place.parentKey ? (districtName.get(place.parentKey) ?? null) : null,
            color: mayorColor(place.mayor),
            group: place.mayor ? (place.mayor.parties[0] ?? "independentes") : null,
            listLabel: place.mayor ? mayorListLabel(place.mayor, parties) : null,
            mayor: place.mayor?.name ?? null,
          },
        ]
      : [],
  );
  const districtPlaces: MayorMapPlace[] = districts.flatMap((district) => {
    if (!district.dicofre) return [];
    const breakdown = mayorLegend(inDistrict(district.key), parties);
    const top = breakdown[0];
    return [
      {
        key: district.key,
        code: district.dicofre,
        name: district.name,
        href: placePath(district.key),
        district: null,
        color: top?.color ?? null,
        group: top?.key ?? null,
        listLabel: top ? `${top.label} lidera ${top.count} de ${inDistrict(district.key).length} câmaras` : null,
        mayor: null,
        breakdown,
      },
    ];
  });

  const level = byDistrict ? "district" : "municipality";
  const shown = byDistrict ? districtPlaces : municipalityPlaces;
  const map = placeMap(
    level,
    shown.map((place) => place.code),
  );
  const searchItems: SearchItem[] = [
    ...municipalityPlaces.map((place) => ({
      key: place.key,
      name: place.name,
      kind: "municipality" as const,
      district: place.district,
      mayor: place.mayor,
      color: place.color,
    })),
    ...districtPlaces.map((place) => ({
      key: place.key,
      name: place.name,
      kind: "district" as const,
      district: null,
      mayor: null,
      color: place.color,
    })),
  ];

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
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Quem governa a{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">tua terra</span>
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Os presidentes das {withMayor.length} câmaras municipais, pelo partido da lista que venceu. Carrega num concelho para ver a câmara
          e a assembleia municipal, os deputados eleitos pelo distrito, as últimas eleições e os contratos públicos.
        </p>
      </header>

      {map ? (
        <MayorMap
          key={level}
          map={map}
          places={shown}
          level={level}
          legend={byDistrict ? mayorLegend(municipalities, parties) : legend}
          total={withMayor.length}
          initialKey={typeof local === "string" ? local : null}
          label={
            byDistrict ? "Mapa dos distritos, pelo partido com mais câmaras" : "Mapa dos concelhos, pelo partido do presidente da câmara"
          }
          caption={`${
            byDistrict
              ? "Cada distrito com a cor do partido que lidera mais câmaras."
              : "Cor do partido principal da lista vencedora; coligações pelo primeiro partido."
          } Limites: ${map.source}.`}
          searchItems={searchItems}
          views={[
            { href: "/sitios", label: "Concelhos", current: !byDistrict },
            { href: "/sitios?mapa=distritos", label: "Distritos", current: byDistrict },
          ]}
        />
      ) : (
        <p className="mb-12 text-muted">Mapa indisponível.</p>
      )}

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
