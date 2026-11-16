import type { Metadata } from "next";
import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { loadHighlights } from "@/components/Highlights";
import { BlogSpotlight, loadNewsSidebar, MostCommented, PowerNow } from "@/components/NewsSidebar";
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

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

export default async function HomePage({ searchParams }: Props) {
  await connection();
  const [{ partido }, parties] = await Promise.all([searchParams, getParties().catch(() => [])]);
  // Only a party we know filters the feed; anything else shows every party.
  const party = parties.find((item) => item.slug === partido) ?? null;
  const [page, highlights, sidebar] = await Promise.all([getFeedPage({ party: party?.slug }), loadHighlights(), loadNewsSidebar()]);
  // The blog has one box beside the news, so it never pushes the news down.
  const spotlight = highlights[0] ?? null;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          {SOURCE_COUNT} órgãos de comunicação · {party ? party.name : "todos os partidos"}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {party ? (
            <>
              Notícias do <span className={MARKER}>{party.acronym}</span>
            </>
          ) : (
            <>
              Últimas <span className={MARKER}>notícias</span>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          {party
            ? `Tudo o que se publica sobre o ${party.acronym}, num só lugar e por ordem de publicação. Lê, compara e comenta.`
            : "Tudo o que se publica sobre os partidos portugueses, num só lugar e por ordem de publicação. Lê, compara e comenta."}
        </p>
      </header>

      <PartyChipBar parties={parties} active={party?.slug ?? null} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <p className="mb-4 font-mono text-xs text-muted">
            {party ? `Notícias do ${party.acronym}` : "Todas as notícias"}, mais recentes primeiro
          </p>
          {/* On smaller screens the blog's box comes before the news, and the rest of the column is left out. */}
          {spotlight && (
            <div className="mb-6 xl:hidden">
              <BlogSpotlight post={spotlight} />
            </div>
          )}
          <Feed key={party?.slug ?? "todas"} initialPage={page} partySlug={party?.slug} />
        </div>
        <aside aria-label="Ao lado das notícias" className="hidden xl:block">
          <div className="sticky top-20 flex flex-col gap-4">
            {spotlight && <BlogSpotlight post={spotlight} />}
            <PowerNow figures={sidebar.power} />
            <MostCommented articles={sidebar.mostCommented} />
          </div>
        </aside>
      </div>
    </div>
  );
}
