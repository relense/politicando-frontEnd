import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { PartyLogo } from "@/components/PartyLogo";
import { getFeedPage, getParties } from "@/lib/api/client";
import { findPartyByParam, partyPath } from "@/lib/parties";

type Props = { params: Promise<{ name: string }> };

async function resolveParty(param: string) {
  return findPartyByParam(await getParties(), param);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const party = await resolveParty((await params).name);
  if (!party) return { title: "Partido não encontrado" };
  const title = `${party.acronym}: ${party.name}`;
  return {
    title,
    description: `As últimas notícias sobre ${party.name}.`,
    alternates: { canonical: partyPath(party.slug) },
    openGraph: { title, url: partyPath(party.slug) },
  };
}

export default async function PartyPage({ params }: Props) {
  await connection();
  const { name } = await params;
  const party = await resolveParty(name);
  if (!party) notFound();
  // Old links such as /partido/l keep working and move to the current address.
  if (name !== party.slug) permanentRedirect(partyPath(party.slug));

  const page = await getFeedPage({ party: party.slug });

  return (
    <>
      <header className="mb-8 flex items-center gap-4 border-b border-line pb-6">
        <PartyLogo slug={party.slug} acronym={party.acronym} size={72} />
        <div>
          <h1 className="text-2xl font-bold">{party.acronym}</h1>
          <p className="text-muted">{party.name}</p>
          {party.website && (
            <a href={party.website} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-link underline">
              Site oficial
            </a>
          )}
        </div>
      </header>
      <Feed key={party.slug} partySlug={party.slug} initialPage={page} />
    </>
  );
}
