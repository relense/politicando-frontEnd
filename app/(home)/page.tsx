import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { Highlights, loadHighlights } from "@/components/Highlights";
import { PartyChipBar } from "@/components/PartyNav";
import { getFeedPage, getParties } from "@/lib/api/client";
import { SOURCE_COUNT } from "@/lib/sources";

export default async function HomePage() {
  await connection();
  const [page, parties, highlights] = await Promise.all([getFeedPage(), getParties().catch(() => []), loadHighlights()]);

  return (
    <>
      <PartyChipBar parties={parties} />
      <Highlights posts={highlights} />
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Últimas notícias</h1>
        <p className="mt-2 font-mono text-xs text-muted">
          De {SOURCE_COUNT} órgãos de comunicação, de todos os partidos, por ordem de publicação.
        </p>
      </header>
      <Feed initialPage={page} />
    </>
  );
}
