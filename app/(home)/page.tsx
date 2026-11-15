import type { Metadata } from "next";
import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { Highlights, loadHighlights } from "@/components/Highlights";
import { PartyChipBar } from "@/components/PartyNav";
import { getFeedPage, getParties } from "@/lib/api/client";
import { partyPath } from "@/lib/parties";
import { SOURCE_COUNT } from "@/lib/sources";

type Props = { searchParams: Promise<{ partido?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { partido } = await searchParams;
  // A filtered feed repeats the party's page, which is the one to index.
  return typeof partido === "string" && partido
    ? { alternates: { canonical: partyPath(partido) }, robots: { index: false, follow: true } }
    : {};
}

export default async function HomePage({ searchParams }: Props) {
  await connection();
  const [{ partido }, parties] = await Promise.all([searchParams, getParties().catch(() => [])]);
  // Only a party we know filters the feed; anything else shows every party.
  const party = parties.find((item) => item.slug === partido) ?? null;
  const [page, highlights] = await Promise.all([getFeedPage({ party: party?.slug }), party ? [] : loadHighlights()]);

  return (
    <>
      <PartyChipBar parties={parties} active={party?.slug ?? null} />
      {!party && <Highlights posts={highlights} />}
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{party ? `Notícias do ${party.acronym}` : "Últimas notícias"}</h1>
        <p className="mt-2 font-mono text-xs text-muted">
          {party
            ? `${party.name}, de ${SOURCE_COUNT} órgãos de comunicação, por ordem de publicação.`
            : `De ${SOURCE_COUNT} órgãos de comunicação, de todos os partidos, por ordem de publicação.`}
        </p>
      </header>
      <Feed key={party?.slug ?? "todas"} initialPage={page} partySlug={party?.slug} />
    </>
  );
}
